import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizeBangladeshMobile } from "@/lib/customer-mobile";

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
        emailVerified: user.emailVerified,
        address: typeof profile.address === "string" ? profile.address : "",
        photoURL:
          typeof profile.photoURL === "string" && profile.photoURL
            ? profile.photoURL
            : user.photoURL || "",
        mobileVerified: profile.mobileVerified === true,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Customer সেশন যাচাই করা যায়নি।", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const idToken = typeof body?.idToken === "string" ? body.idToken : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const mobile = typeof body?.mobile === "string" ? body.mobile.trim() : "";

    if (!idToken) return fail("লগইন টোকেন পাওয়া যায়নি।", 400);

    const isLogin = !name && !mobile;

    if (!isLogin && (!name || name.length < 2 || name.length > 100)) {
      return fail("নাম সঠিক নয়।", 400);
    }

    if (!isLogin && !normalizeBangladeshMobile(mobile)) {
      return fail("সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।", 400);
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
      user.email.toLowerCase() !== String(decoded.email ?? "").toLowerCase() ||
      adminDoc.exists
    ) {
      return fail("এই অ্যাকাউন্ট Customer হিসেবে অনুমোদিত নয়।", 403);
    }

    const customers = adminDb.collection("customers");
    const profileRef = customers.doc(uid);
    const profileSnap = await profileRef.get();

    if (isLogin && !profileSnap.exists) {
      return fail("এই ইমেইলে কোনো Customer অ্যাকাউন্ট পাওয়া যায়নি। আগে রেজিস্ট্রেশন করুন।", 403);
    }

    const profile = profileSnap.data() || {};
    const mobileToClaim = isLogin
      ? typeof profile.mobile === "string" ? profile.mobile : ""
      : mobile;
    const canonicalMobile = normalizeBangladeshMobile(mobileToClaim);

    if (!canonicalMobile) {
      return fail("সঠিক বাংলাদেশি মোবাইল নম্বর প্রয়োজন। প্রোফাইল আপডেট করুন।", 400);
    }

    const indexRef = adminDb
      .collection("customerMobileIndex")
      .doc(canonicalMobile.slice(1));

    const initialIndex = await indexRef.get();

    if (initialIndex.exists && initialIndex.data()?.uid !== uid) {
      return fail("এই মোবাইল নম্বরটি অন্য Customer অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", 409);
    }

    if (!initialIndex.exists) {
      const allCustomers = await customers.get();

      const duplicate = allCustomers.docs.some((doc) => {
        if (doc.id === uid) return false;
        const existingMobile = doc.data().mobile;
        return (
          typeof existingMobile === "string" &&
          normalizeBangladeshMobile(existingMobile) === canonicalMobile
        );
      });

      if (duplicate) {
        return fail("এই মোবাইল নম্বরটি অন্য Customer অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", 409);
      }
    }

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const indexSnap = await transaction.get(indexRef);
      const currentProfileSnap = await transaction.get(profileRef);

      if (indexSnap.exists && indexSnap.data()?.uid !== uid) {
        return "duplicate";
      }

      const currentProfile = currentProfileSnap.data() || {};
      const oldMobile =
        typeof currentProfile.mobile === "string"
          ? normalizeBangladeshMobile(currentProfile.mobile)
          : null;

      const oldIndexRef =
        oldMobile && oldMobile !== canonicalMobile
          ? adminDb.collection("customerMobileIndex").doc(oldMobile.slice(1))
          : null;

      const oldIndexSnap = oldIndexRef
        ? await transaction.get(oldIndexRef)
        : null;

      const now = new Date();

      transaction.set(indexRef, {
        uid,
        mobile: canonicalMobile,
        updatedAt: now,
        ...(indexSnap.exists ? {} : { createdAt: now }),
      }, { merge: true });

      transaction.set(profileRef, {
        uid,
        mobile: canonicalMobile,
        mobileVerified: oldMobile === canonicalMobile
          ? currentProfile.mobileVerified === true
          : false,
        updatedAt: now,
        ...(!isLogin
          ? {
              name,
              email: user.email!.toLowerCase(),
              ...(currentProfileSnap.exists ? {} : { createdAt: now }),
            }
          : {}),
      }, { merge: true });

      if (oldIndexRef && oldIndexSnap?.data()?.uid === uid) {
        transaction.delete(oldIndexRef);
      }

      return "ok";
    });

    if (transactionResult === "duplicate") {
      return fail("এই মোবাইল নম্বরটি অন্য Customer অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", 409);
    }

    const savedProfile = (await profileRef.get()).data() || {};
    const customerName = typeof savedProfile.name === "string" ? savedProfile.name : "";

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: DURATION,
    });

    const response = NextResponse.json({
      success: true,
      customer: {
        uid,
        name: customerName,
        mobile: canonicalMobile,
        email: user.email.toLowerCase(),
        emailVerified: user.emailVerified,
        address: typeof savedProfile.address === "string" ? savedProfile.address : "",
        photoURL:
          typeof savedProfile.photoURL === "string" && savedProfile.photoURL
            ? savedProfile.photoURL
            : user.photoURL || "",
        mobileVerified: savedProfile.mobileVerified === true,
      },
    }, { headers: { "Cache-Control": "no-store" } });

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
