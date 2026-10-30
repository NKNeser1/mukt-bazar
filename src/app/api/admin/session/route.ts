
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "mukt_bazar_admin_session";
const SESSION_DURATION = 5 * 24 * 60 * 60 * 1000;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const idToken =
      typeof body?.idToken === "string" ? body.idToken : "";

    if (!idToken) {
      return fail("লগইন টোকেন পাওয়া যায়নি।", 400);
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const uid = decoded.uid;

    if (decoded.role === "root_admin") {
      // Root Admin-এর বর্তমান সরাসরি লগইন বজায় থাকবে।
    } else if (decoded.role === "sub_admin") {
      // এই claim শুধু OTP যাচাইয়ের পর server তৈরি করবে।
      const user = await adminAuth.getUser(uid);
      const snap = await adminDb.collection("admins").doc(uid).get();
      const data = snap.data();

      if (
        user.disabled ||
        !snap.exists ||
        data?.active !== true ||
        data?.uid !== uid ||
        String(data?.email ?? "").toLowerCase() !==
          String(user.email ?? "").toLowerCase()
      ) {
        return fail("Sub-admin অ্যাকাউন্ট সক্রিয় নয়।", 403);
      }
    } else {
      return fail("লগইনের অনুমতি নেই।", 403);
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION,
    });

    const response = NextResponse.json({
      success: true,
      role: decoded.role,
    });

    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION / 1000),
    });

    return response;
  } catch {
    return fail("সেশন তৈরি হয়নি। আবার লগইন করুন।", 401);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
