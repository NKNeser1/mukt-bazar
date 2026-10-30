import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import ProductsClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdminPageAccess("products.read");
  return <ProductsClientPage />;
}
