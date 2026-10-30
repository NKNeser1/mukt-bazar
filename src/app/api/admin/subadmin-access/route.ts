
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isAdminPermission } from "@/lib/admin-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(
      "mukt_bazar_admin_session",
    )?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: "আবার লগইন করুন।" },
        { status: 401 },
      );
    }

    const decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );

    if (decoded.role !== "sub_admin") {
      return NextResponse.json(
        { success: false, message: "সাব-অ্যাডমিনের অনুমতি প্রয়োজন।" },
        { status: 403 },
      );
    }

    const user = await adminAuth.getUser(decoded.uid);
    const snap = await adminDb
      .collection("admins")
      .doc(decoded.uid)
      .get();

    const data = snap.data();

    if (
      user.disabled ||
      !snap.exists ||
      data?.active !== true ||
      data?.uid !== decoded.uid ||
      String(data?.email ?? "").toLowerCase() !==
        String(user.email ?? "").toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, message: "অ্যাকাউন্ট সক্রিয় নয়।" },
        { status: 403 },
      );
    }

    const permissions = Array.isArray(data.permissions)
      ? data.permissions.filter(isAdminPermission)
      : [];

    return NextResponse.json(
      {
        success: true,
        admin: {
          uid: decoded.uid,
          name: String(data.name ?? ""),
          email: String(user.email ?? ""),
          permissions,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "সেশন যাচাই করা যায়নি।" },
      { status: 401 },
    );
  }
}
