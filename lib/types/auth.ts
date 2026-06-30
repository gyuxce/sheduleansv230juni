export const roles = ["admin", "sensei", "murid"] as const;
export type Role = (typeof roles)[number];

export type CurrentMembership = {
  id: string;
  organization_id: string;
  role: Role;
  organization: { slug: string; name: string };
};
