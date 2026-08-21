import { requireChatGPTUser } from "../chatgpt-auth";
import { AdminCatalogue } from "../components/admin-catalogue";
import { categories } from "../lib/catalog";
import { getAdminOrders, getAdminReviews, getProducts } from "../lib/server-catalog";
import { isOwnerEmail } from "../lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!isOwnerEmail(user.email.toLowerCase())) {
    return <main className="admin-access"><img src="/renova-mark.svg" alt=""/><span className="eyebrow">Protected workspace</span><h1>This owner console is private.</h1><p>You are signed in as {user.email}. Sign in with an approved Renova owner account to continue.</p><a className="button espresso" href="/signout-with-chatgpt?return_to=/admin">Change account</a></main>;
  }
  const [products, reviews, orders] = await Promise.all([getProducts({ includeDrafts: true }), getAdminReviews(), getAdminOrders()]);
  return <AdminCatalogue initialProducts={products} initialReviews={reviews} initialOrders={orders} categories={categories} ownerName={user.displayName || "Lateef"} />;
}
