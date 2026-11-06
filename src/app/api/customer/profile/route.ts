import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizeBangladeshMobile } from "@/lib/customer-mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "mukt_bazar_customer_session";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE)?.value;
    if (!sessionCookie) return fail("Customer লগইন করা নেই।", 401);

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.role) return fail("Customer সেশন অনুমোদিত নয়।", 403);

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const mobile = typeof body?.mobile === "string" ? body.mobile.trim() : "";
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (name.length < 2 || name.length > 100) {
      return fail("সঠিক নাম লিখুন।", 400);
    }

    const canonicalMobile = normalizeBangladeshMobile(mobile);
    if (!canonicalMobile) {
      return fail("সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।", 400);
    }

    if (!address || address.length > 500) {
      return fail("সঠিক ডেলিভারি ঠিকানা লিখুন (সর্বোচ্চ ৫০০ অক্ষর)।", 400);
    }

    const uid = decoded.uid;
    const [user, adminDoc, profileSnap] = await Promise.all([
      adminAuth.getUser(uid),
      adminDb.collection("admins").doc(uid).get(),
      adminDb.collection("customers").doc(uid).get(),
    ]);

    if (user.disabled || !user.email || adminDoc.exists || !profileSnap.exists) {
      return fail("Customer প্রোফাইল অনুমোদিত নয়।", 403);
    }

    const customers = adminDb.collection("customers");
    const profileRef = customers.doc(uid);
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

    const result = await adminDb.runTransaction(async (transaction) => {
      const currentIndex = await transaction.get(indexRef);
      const currentProfileSnap = await transaction.get(profileRef);

      if (!currentProfileSnap.exists) return "missing";
      if (currentIndex.exists && currentIndex.data()?.uid !== uid) {
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
        ...(currentIndex.exists ? {} : { createdAt: now }),
      }, { merge: true });

      transaction.set(profileRef, {
        name,
        mobile: canonicalMobile,
        address,
        mobileVerified:
          oldMobile === canonicalMobile
            ? currentProfile.mobileVerified === true
            : false,
        updatedAt: now,
      }, { merge: true });

      if (oldIndexRef && oldIndexSnap?.data()?.uid === uid) {
        transaction.delete(oldIndexRef);
      }

      return "ok";
    });

    if (result === "duplicate") {
      return fail("এই মোবাইল নম্বরটি অন্য Customer অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", 409);
    }

    if (result === "missing") {
      return fail("Customer প্রোফাইল পাওয়া যায়নি।", 404);
    }

    return NextResponse.json({
      success: true,
      message: "প্রোফাইল আপডেট হয়েছে।",
      customer: {
        uid,
        name,
        mobile: canonicalMobile,
        address,
        email: user.email.toLowerCase(),
        emailVerified: user.emailVerified,
        mobileVerified:
          normalizeBangladeshMobile(profileSnap.data()?.mobile || "") === canonicalMobile &&
          profileSnap.data()?.mobileVerified === true,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("প্রোফাইল আপডেট করা যায়নি। আবার চেষ্টা করুন।", 500);
  }
}
