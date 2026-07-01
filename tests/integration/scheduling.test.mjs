import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && publishableKey && serviceRoleKey);
const localTarget = Boolean(url && /localhost|127\.0\.0\.1/.test(url));
const remoteAllowed = process.env.ALLOW_REMOTE_INTEGRATION_TESTS === "true";
const safeToRun = configured && (localTarget || remoteAllowed);

test("sensei availability -> student booking -> admin approval", { skip: safeToRun ? false : "Set TEST_SUPABASE_* and use local/staging target" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = "TestPassword-123!";
  const emails = {
    admin: `admin-${suffix}@example.com`,
    sensei: `sensei-${suffix}@example.com`,
    student: `student-${suffix}@example.com`,
  };
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userIds = [];
  let organizationId;

  try {
    for (const [role, email] of Object.entries(emails)) {
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}` } });
      assert.ifError(error);
      assert.ok(data.user);
      userIds.push(data.user.id);
    }

    const makeUserClient = async (email) => {
      const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      assert.ifError(error);
      return client;
    };
    const admin = await makeUserClient(emails.admin);
    const { data: organization, error: organizationError } = await admin.rpc("create_organization", {
      p_name: `Integration ${suffix}`, p_slug: `integration-${suffix}`, p_timezone: "Asia/Jakarta",
    });
    assert.ifError(organizationError);
    organizationId = organization.organization_id;

    const register = async (profileId, role) => {
      const { error } = await admin.rpc("admin_register_member", {
        p_organization_id: organizationId, p_profile_id: profileId, p_role: role,
        p_full_name: `Test ${role}`, p_level: "N5", p_can_self_book: false,
      });
      assert.ifError(error);
    };
    await register(userIds[1], "sensei");
    await register(userIds[2], "murid");

    const [{ data: sensei }, { data: student }] = await Promise.all([
      service.from("senseis").select("id").eq("organization_id", organizationId).single(),
      service.from("students").select("id").eq("organization_id", organizationId).single(),
    ]);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 2);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const senseiClient = await makeUserClient(emails.sensei);
    const { error: availabilityError } = await senseiClient.rpc("open_availability", {
      p_sensei_id: sensei.id, p_starts_at: start.toISOString(), p_ends_at: end.toISOString(), p_level: "N5",
    });
    assert.ifError(availabilityError);
    const { data: slot } = await service.from("classes").select("id").eq("organization_id", organizationId).eq("status", "available").single();

    const studentClient = await makeUserClient(emails.student);
    const { error: bookingError } = await studentClient.rpc("book_available_slot", {
      p_class_id: slot.id, p_notes: "Integration test", p_idempotency_key: crypto.randomUUID(),
    });
    assert.ifError(bookingError);
    const { data: pendingClass } = await service.from("classes").select("status,version,student_id").eq("id", slot.id).single();
    assert.equal(pendingClass.status, "pending_confirmation");
    assert.equal(pendingClass.student_id, student.id);

    const { error: approvalError } = await admin.rpc("decide_booking", {
      p_class_id: slot.id, p_approve: true, p_expected_version: pendingClass.version,
    });
    assert.ifError(approvalError);
    const { data: bookedClass } = await service.from("classes").select("status").eq("id", slot.id).single();
    assert.equal(bookedClass.status, "booked");

    const { error: duplicateError } = await studentClient.rpc("book_available_slot", {
      p_class_id: slot.id, p_notes: null, p_idempotency_key: crypto.randomUUID(),
    });
    assert.ok(duplicateError, "slot booked harus menolak booking kedua");
  } finally {
    if (organizationId) await service.from("organizations").delete().eq("id", organizationId);
    for (const id of userIds.reverse()) await service.auth.admin.deleteUser(id);
  }
});
