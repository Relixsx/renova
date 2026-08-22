import { redirect } from "next/navigation";
import { AdminLoginForm } from "../../components/admin-login-form";
import { currentUser, isOwnerEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user && isOwnerEmail(user.email)) redirect("/admin");
  return <main className="admin-access">
    <img src="/renova-mark.svg" alt="" />
    <span className="eyebrow">Renova owner access</span>
    <h1>Sign in to manage the store.</h1>
    <p>Use the owner account created in Neon Auth. Customer checkout does not require an account.</p>
    <AdminLoginForm />
  </main>;
}
