import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  isAdminPermission,
  type AdminPermission,
} from "@/lib/admin-permissions";

export async function requireAdminPageAccess(
  permission: AdminPermission,
) {
  const cookieStore = await cookies();
  const session = cookieStore.get(
    "mukt_bazar_admin_session",
  )?.value;

  if (!session) redirect("/admin/login");

  let decoded;

  try {
    decoded = await adminAuth.verifySessionCookie(session, true);
  } catch {
    redirect("/admin/login");
  }

  if (decoded.role === "root_admin") {
    return { role: "root_admin" as const, uid: decoded.uid };
  }

  if (decoded.role !== "sub_admin") {
    redirect("/admin/login");
  }

  const user = await adminAuth.getUser(decoded.uid).catch(() => null);
  const snap = await adminDb
    .collection("admins")
    .doc(decoded.uid)
    .get();

  const data = snap.data();

  if (
    !user ||
    user.disabled ||
    !snap.exists ||
    data?.active !== true ||
    data?.uid !== decoded.uid ||
    String(data?.email ?? "").toLowerCase() !==
      String(user.email ?? "").toLowerCase()
  ) {
    redirect("/admin/login");
  }

  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter(isAdminPermission)
    : [];

  if (!permissions.includes(permission)) {
    redirect("/admin/subadmin");
  }

  return {
    role: "sub_admin" as const,
    uid: decoded.uid,
    permissions,
  };
}
