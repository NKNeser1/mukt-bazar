
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireRootAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, message: "এই পরীক্ষা শুধু লোকাল ডেভেলপমেন্টে চালানো যাবে।" },
      { status: 403 }
    );
  }

  const admin = await requireRootAdmin();

  if (!admin) {
    return NextResponse.json(
      { success: false, message: "শুধু Root Admin এই পরীক্ষা চালাতে পারবেন।" },
      { status: 403 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.ROOT_ADMIN_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !recipient || !from) {
    return NextResponse.json(
      { success: false, message: "Resend-এর কনফিগারেশন অসম্পূর্ণ।" },
      { status: 500 }
    );
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [recipient],
      subject: "Mukt Bazar - Email Configuration Test",
      text: "মুক্ত বাজারের Resend ইমেইল কনফিগারেশন পরীক্ষা সফল হয়েছে। এটি OTP নয়।",
    });

    if (error) {
      console.error("Resend test email failed:", error.name);
      return NextResponse.json(
        { success: false, message: "ইমেইল পাঠানো যায়নি। Resend-এর sender ও account status পরীক্ষা করুন।" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Resend ইমেইল অনুরোধ গ্রহণ করেছে। Gmail-এর Inbox ও Spam পরীক্ষা করুন।",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "ইমেইল পরীক্ষায় সার্ভার ত্রুটি হয়েছে।" },
      { status: 500 }
    );
  }
}
