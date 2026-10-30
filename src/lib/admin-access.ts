import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  isAdminPermission,
  type AdminPermission,
} from "@/lib/admin-permissions";

export type AdminAccess = {
  uid: string;
  email: string;
  role: string;
  permissions: AdminPermission[];
};

export async function requireAdminPermission(
  permission: AdminPermission,
): Promise<AdminAccess> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(
    "mukt_bazar_admin_session",
  )?.value;

  if (!sessionCookie) {
    throw new Error("UNAUTHORIZED");
  }

  let decoded;

  try {
    decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  if (decoded.role === "root_admin") {
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      role: "root_admin",
      permissions: [],
    };
  }

  const adminDoc = await adminDb
    .collection("admins")
    .doc(decoded.uid)
    .get();

  if (!adminDoc.exists) {
    throw new Error("FORBIDDEN");
  }

  const adminData = adminDoc.data();

  if (
    !adminData ||
    adminData.active !== true ||
    adminData.uid !== decoded.uid
  ) {
    throw new Error("FORBIDDEN");
  }

  const rawPermissions: unknown = adminData.permissions;

  const permissions: AdminPermission[] = Array.isArray(
    rawPermissions,
  )
    ? rawPermissions.filter(isAdminPermission)
    : [];

  if (!permissions.includes(permission)) {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    role:
      typeof adminData.role === "string"
        ? adminData.role
        : "custom",
    permissions,
  };
}