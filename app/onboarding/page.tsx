import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Setup</p><h1>Buat organisasi pertama</h1><p className="muted">Akun Anda akan menjadi admin organisasi ini.</p><OnboardingForm /></section></main>;
}
