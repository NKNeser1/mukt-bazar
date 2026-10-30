import { requireRootAdmin } from "@/lib/admin-auth";
import EmailTestClientPage from "./ClientPage";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmailTestPage() {
  const admin = await requireRootAdmin();

  if (!admin) redirect("/admin");

  return <EmailTestClientPage />;
}
