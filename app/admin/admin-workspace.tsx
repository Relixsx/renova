import { AdminCatalogue, type AdminSection } from "../components/admin-catalogue";
import { categories } from "../lib/catalog";
import { requireOwnerPage } from "../lib/admin-auth";
import {
  getAdminOrders,
  getAdminReviews,
  getProducts,
} from "../lib/server-catalog";

export async function AdminWorkspace({
  section,
  category = "all",
}: {
  section: AdminSection;
  category?: string;
}) {
  const { user, authorised } = await requireOwnerPage();
  if (!authorised) {
    return (
      <main className="admin-access">
        <img src="/renova-mark.svg" alt="" />
        <span className="eyebrow">Protected workspace</span>
        <h1>This owner console is private.</h1>
        <p>
          You are signed in as {user.email}. Sign in with an approved Renova
          owner account to continue.
        </p>
        <a className="button espresso" href="/admin/login">
          Change account
        </a>
      </main>
    );
  }

  const [products, reviews, orders] = await Promise.all([
    getProducts({ includeDrafts: true }),
    getAdminReviews(),
    getAdminOrders(),
  ]);

  return (
    <AdminCatalogue
      initialProducts={products}
      initialReviews={reviews}
      initialOrders={orders}
      categories={categories}
      ownerName={user.name || "Lateef"}
      activeSection={section}
      initialCategory={category}
    />
  );
}
