import { AdminWorkspace } from "../admin-workspace";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "all" } = await searchParams;
  return <AdminWorkspace section="products" category={category} />;
}
