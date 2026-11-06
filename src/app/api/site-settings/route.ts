import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("siteSettings")
      .doc("specialSite")
      .get();

    const data = snapshot.exists ? snapshot.data() || {} : {};
    const numbers = Array.isArray(data.whatsappNumbers)
      ? data.whatsappNumbers
      : [];
    const branding = data.branding || {};

    return NextResponse.json({
      success: true,
      whatsappNumbers: numbers
        .filter((item): item is {
          id: string;
          label: string;
          number: string;
          active: true;
          primary?: boolean;
        } =>
          typeof item === "object" &&
          item !== null &&
          "active" in item &&
          item.active === true &&
          "id" in item &&
          typeof item.id === "string" &&
          "label" in item &&
          typeof item.label === "string" &&
          "number" in item &&
          typeof item.number === "string" &&
          /^\d{8,15}$/.test(item.number)
        )
        .map((item) => ({
          id: item.id,
          label: item.label,
          number: item.number,
          primary: item.primary === true,
        })),
      branding: {
        logo: branding.logo || { imageUrl: "/logo.png", publicId: "default-logo" },
        socialBanner: branding.socialBanner || { imageUrl: "/social-banner.png", publicId: "default-social-banner" },
        intro: {
          image: branding.intro?.image || { imageUrl: "/logo.png", publicId: "default-intro-image" },
          title: branding.intro?.title || "মুক্ত বাজার",
          tagline:
            branding.intro?.tagline ||
            "সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।",
          loadingText:
            branding.intro?.loadingText ||
            "আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে...",
        },
      },
    });
  } catch (error) {
    console.error("[Public Site Settings API]", error);
    return NextResponse.json(
      { success: false, message: "সাইটের তথ্য লোড করা যায়নি।" },
      { status: 500 },
    );
  }
}
