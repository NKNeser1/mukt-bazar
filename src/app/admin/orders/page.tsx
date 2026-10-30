import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import OrdersClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireAdminPageAccess("orders.read");
  return <OrdersClientPage />;
}
