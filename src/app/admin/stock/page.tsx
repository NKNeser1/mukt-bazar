import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import StockClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireAdminPageAccess("stock.read");
  return <StockClientPage />;
}
