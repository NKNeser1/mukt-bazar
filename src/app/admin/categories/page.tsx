import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import CategoriesClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdminPageAccess("categories.read");
  return <CategoriesClientPage />;
}
