import { requireRootAdmin } from "@/lib/admin-auth";
import UsersClientPage from "./ClientPage";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireRootAdmin();

  if (!admin) redirect("/admin");

  return <UsersClientPage />;
}
