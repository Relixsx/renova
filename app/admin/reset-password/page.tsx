import { AdminResetPasswordForm } from "../../components/admin-reset-password-form";

export default function AdminResetPasswordPage() {
  return <main className="admin-access">
    <img src="/renova-mark.svg" alt="" />
    <span className="eyebrow">Renova owner recovery</span>
    <h1>Create a new password.</h1>
    <p>Choose a secure password of at least eight characters for your owner account.</p>
    <AdminResetPasswordForm />
  </main>;
}
