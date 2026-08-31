import { AdminForgotPasswordForm } from "../../components/admin-forgot-password-form";

export default function AdminForgotPasswordPage() {
  return <main className="admin-access">
    <img src="/renova-mark.svg" alt="" />
    <span className="eyebrow">Renova owner recovery</span>
    <h1>Reset your password.</h1>
    <p>Enter the email connected to your Renova owner account. Neon will send a secure, time-limited recovery link.</p>
    <AdminForgotPasswordForm />
  </main>;
}
