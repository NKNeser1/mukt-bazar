import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

const SESSION_COOKIE = "mukt_bazar_admin_session";

export async function requireRootAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );

    if (decoded.role !== "root_admin") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
