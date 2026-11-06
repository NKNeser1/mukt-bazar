import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "mukt_bazar_customer_session";
const DURATION = 5 * 24 * 60 * 60 * 1000;

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE)?.value;
    if (!sessionCookie) return fail("Customer লগইন করা নেই।", 401);

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.role) return fail("Customer সেশন অনুমোদিত নয়।", 403);

    const [user, adminDoc, profileSnap] = await Promise.all([
      adminAuth.getUser(decoded.uid),
      adminDb.collection("admins").doc(decoded.uid).get(),
      adminDb.collection("customers").doc(decoded.uid).get(),
    ]);

    if (user.disabled || !user.email || adminDoc.exists || !profileSnap.exists) {
      return fail("Customer প্রোফাইল পাওয়া যায়নি।", 403);
    }

    const profile = profileSnap.data() || {};

    return NextResponse.json({
      success: true,
      customer: {
        uid: decoded.uid,
        name: typeof profile.name === "string" ? profile.name : "",
        mobile: typeof profile.mobile === "string" ? profile.mobile : "",
        email: user.email.toLowerCase(),
        photoURL: user.photoURL || "",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Customer সেশন যাচাই করা যায়নি।", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const idToken =
      typeof body?.idToken === "string" ? body.idToken : "";
    const name =
      typeof body?.name === "string" ? body.name.trim() : "";
    const mobile =
      typeof body?.mobile === "string" ? body.mobile.trim() : "";

    if (!idToken) return fail("লগইন টোকেন পাওয়া যায়নি।", 400);

    const isLogin = !name && !mobile;

    if (!isLogin) {
      if (!name || name.length < 2 || name.length > 100) {
        return fail("নাম সঠিক নয়।", 400);
      }

      if (!/^[+\d][\d\s()-]{6,19}$/.test(mobile)) {
        return fail("মোবাইল নম্বর সঠিকভাবে লিখুন।", 400);
      }
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);

    if (typeof decoded.role === "string" && decoded.role) {
      return fail("এই অ্যাকাউন্ট Customer হিসেবে ব্যবহার করা যাবে না।", 403);
    }

    const uid = decoded.uid;
    const [user, adminDoc] = await Promise.all([
      adminAuth.getUser(uid),
      adminDb.collection("admins").doc(uid).get(),
    ]);

    if (
      user.disabled ||
      !user.email ||
      user.email.toLowerCase() !==
        String(decoded.email ?? "").toLowerCase() ||
      adminDoc.exists
    ) {
      return fail("এই অ্যাকাউন্ট Customer হিসেবে অনুমোদিত নয়।", 403);
    }

    const profileRef = adminDb.collection("customers").doc(uid);
    const profileSnap = await profileRef.get();

    if (isLogin && !profileSnap.exists) {
      return fail("এই ইমেইলে কোনো Customer অ্যাকাউন্ট পাওয়া যায়নি। আগে রেজিস্ট্রেশন করুন।", 403);
    }

    if (!isLogin) {
      const now = new Date();

      await profileRef.set(
        {
          uid,
          name,
          mobile,
          email: user.email.toLowerCase(),
          updatedAt: now,
          ...(profileSnap.exists ? {} : { createdAt: now }),
        },
        { merge: true },
      );
    }

    const profile = isLogin ? profileSnap.data() || {} : {};
    const customerName = isLogin
      ? typeof profile.name === "string" ? profile.name : ""
      : name;
    const customerMobile = isLogin
      ? typeof profile.mobile === "string" ? profile.mobile : ""
      : mobile;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: DURATION,
    });

    const response = NextResponse.json(
      {
        success: true,
        customer: {
          uid,
          name: customerName,
          mobile: customerMobile,
          email: user.email.toLowerCase(),
          photoURL: user.photoURL || "",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(DURATION / 1000),
    });

    return response;
  } catch {
    return fail("Customer সেশন তৈরি হয়নি। আবার চেষ্টা করুন।", 401);
  }
}
export async function DELETE() {
  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
