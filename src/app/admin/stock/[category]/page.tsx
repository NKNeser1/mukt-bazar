import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import StockCategoryClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function StockCategoryPage() {
  await requireAdminPageAccess("stock.read");
  return <StockCategoryClientPage />;
}
