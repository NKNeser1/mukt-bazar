
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTP_TTL = 5 * 60 * 1000;
const RESEND_DELAY = 30 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(uid: string, otp: string) {
  const secret = process.env.RESEND_API_KEY;
  if (!secret) throw new Error("OTP configuration missing");
  return createHmac("sha256", secret)
    .update(`${uid}:${otp}`)
    .digest();
}

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!idToken || !name) return fail("নাম ও লগইন তথ্য দিন।");

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (decoded.role === "root_admin") {
      return fail("Root Admin-এর OTP প্রয়োজন নেই।", 403);
    }

    const user = await adminAuth.getUser(decoded.uid);
    const ref = adminDb.collection("admins").doc(decoded.uid);
    const snap = await ref.get();
    const data = snap.data();

    if (
      user.disabled ||
      !snap.exists ||
      data?.active !== true ||
      data?.uid !== decoded.uid ||
      String(data?.name ?? "").trim() !== name ||
      String(data?.email ?? "").toLowerCase() !==
        String(user.email ?? "").toLowerCase()
    ) {
      return fail("Sub-admin-এর তথ্য সঠিক নয় অথবা অ্যাকাউন্ট বন্ধ।", 403);
    }

    const recipient = process.env.ROOT_ADMIN_EMAIL;
    const from = process.env.RESEND_FROM_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;

    if (!recipient || !from || !apiKey) {
      return fail("OTP ইমেইল কনফিগারেশন অসম্পূর্ণ।", 500);
    }

    const otpRef = adminDb.collection("adminLoginOtps").doc(decoded.uid);
    const previous = await otpRef.get();
    const now = Date.now();

    if (
      previous.exists &&
      now - Number(previous.data()?.lastSentAt ?? 0) < RESEND_DELAY
    ) {
      return fail("নতুন OTP নেওয়ার আগে ৩০ সেকেন্ড অপেক্ষা করুন।", 429);
    }

    const otp = String(randomInt(0, 100_000_000)).padStart(8, "0");

    await otpRef.set({
      uid: decoded.uid,
      otpHash: hashOtp(decoded.uid, otp).toString("hex"),
      expiresAt: now + OTP_TTL,
      lastSentAt: now,
      attempts: 0,
    });

    console.log("[OTP-DIAG] POST saved:", (await otpRef.get()).exists);

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: [recipient],
      subject: "Mukt Bazar - Sub-admin Login OTP",
      text:
        `Sub-admin: ${name}\n` +
        `Email: ${user.email}\n\n` +
        `OTP: ${otp}\n` +
        "This code expires in 5 minutes.",
    });

    if (error) {
      await otpRef.delete().catch(() => {});
      console.error("OTP email failed:", error.name);
      return fail("OTP ইমেইল পাঠানো যায়নি।", 502);
    }

    return NextResponse.json({
      success: true,
      message: "Root Admin-এর ইমেইলে OTP পাঠানো হয়েছে।",
      expiresIn: 300,
    });
  } catch {
    return fail("লগইন যাচাই বা OTP পাঠানো যায়নি।", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!idToken || !/^\d{8}$/.test(otp)) {
      return fail("সঠিক ৮ সংখ্যার OTP দিন।");
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (decoded.role === "root_admin") {
      return fail("Root Admin-এর OTP প্রয়োজন নেই।", 403);
    }

    const user = await adminAuth.getUser(decoded.uid);
    const adminSnap = await adminDb.collection("admins")
      .doc(decoded.uid).get();
    const admin = adminSnap.data();

    if (
      user.disabled ||
      !adminSnap.exists ||
      admin?.active !== true ||
      admin?.uid !== decoded.uid ||
      String(admin?.email ?? "").toLowerCase() !==
        String(user.email ?? "").toLowerCase()
    ) {
      return fail("Sub-admin অ্যাকাউন্ট সক্রিয় নয়।", 403);
    }

    const otpRef = adminDb.collection("adminLoginOtps").doc(decoded.uid);
    const otpSnap = await otpRef.get();

    console.log("[OTP-DIAG] PATCH found:", otpSnap.exists);
    if (!otpSnap.exists) return fail("OTP নেই। নতুন OTP নিন।");

    const saved = otpSnap.data()!;
    const now = Date.now();

    if (now >= Number(saved.expiresAt)) {
      await otpRef.delete();
      return fail("OTP-এর মেয়াদ শেষ। নতুন OTP নিন।");
    }

    if (Number(saved.attempts) >= MAX_ATTEMPTS) {
      await otpRef.delete();
      return fail("চেষ্টার সীমা শেষ। নতুন OTP নিন।", 429);
    }

    const expected = Buffer.from(String(saved.otpHash ?? ""), "hex");
    const actual = hashOtp(decoded.uid, otp);

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      await otpRef.update({ attempts: Number(saved.attempts) + 1 });
      return fail("OTP সঠিক নয়।");
    }

    await otpRef.delete();

    const customToken = await adminAuth.createCustomToken(decoded.uid, {
      role: "sub_admin",
    });

    return NextResponse.json({
      success: true,
      message: "OTP যাচাই সফল হয়েছে।",
      customToken,
    });
  } catch (error) {
    console.error("[OTP-DIAG] PATCH error:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return fail("OTP যাচাই করা যায়নি।", 401);
  }
}
