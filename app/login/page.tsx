import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/membership";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/auth/continue");
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Nihongo Class</p>
        <h1>Masuk ke dashboard</h1>
        <p className="muted">Kelola jadwal, booking, dan kelas bahasa Jepang dalam satu tempat.</p>
        <LoginForm />
      </section>
    </main>
  );
}
