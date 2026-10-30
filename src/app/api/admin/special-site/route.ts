import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ref = () => adminDb.collection("siteSettings").doc("specialSite");
const fail = (message: string, status: number) =>
  NextResponse.json({ success: false, message }, { status });

async function authorize() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mukt_bazar_admin_session")?.value;
  if (!token) throw new Error("UNAUTHORIZED");
  const decoded = await adminAuth.verifySessionCookie(token, true);
  if (decoded.role !== "root_admin") throw new Error("FORBIDDEN");
}

function imageValid(value: unknown) {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.imageUrl === "string" &&
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(item.imageUrl) &&
    typeof item.publicId === "string" &&
    item.publicId.startsWith("mukt-bazar/site-assets/") &&
    item.publicId.length <= 300
  );
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHORIZED") return fail("আবার লগইন করুন।", 401);
  if (code === "FORBIDDEN") return fail("শুধু Root Admin এই কাজ করতে পারবেন।", 403);
  console.error("[Special Site API]", error);
  return fail("সেটিংস সংরক্ষণ করা যায়নি।", 500);
}

export async function GET() {
  try {
    await authorize();
    const snapshot = await ref().get();
    return NextResponse.json({
      success: true,
      settings: snapshot.exists ? snapshot.data() : {
        whatsappNumbers: [],
        branding: {
          logo: null,
          intro: {
            image: null,
            title: "মুক্ত বাজার",
            tagline: "সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।",
            loadingText: "আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে...",
          },
          socialBanner: null,
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await authorize();
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.whatsappNumbers !== undefined) {
      const numbers = body.whatsappNumbers;
      if (!Array.isArray(numbers) || numbers.length > 20) {
        return fail("WhatsApp নম্বরের তালিকা সঠিক নয়।", 400);
      }

      const ids = new Set<string>();
      let primaryCount = 0;
      const cleanNumbers = [];

      for (const item of numbers) {
        if (
          !item || typeof item.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,60}$/.test(item.id) ||
          ids.has(item.id) ||
          typeof item.label !== "string" ||
          !item.label.trim() || item.label.length > 50 ||
          typeof item.number !== "string" ||
          !/^\d{8,15}$/.test(item.number) ||
          typeof item.active !== "boolean" ||
          typeof item.primary !== "boolean"
        ) {
          return fail("একটি WhatsApp নম্বরের তথ্য সঠিক নয়।", 400);
        }
        ids.add(item.id);
        if (item.primary) {
          primaryCount++;
          if (!item.active) return fail("Primary নম্বর সক্রিয় হতে হবে।", 400);
        }
        cleanNumbers.push({
          id: item.id,
          label: item.label.trim(),
          number: item.number,
          active: item.active,
          primary: item.primary,
        });
      }

      if (
        (cleanNumbers.length > 0 && primaryCount !== 1) ||
        primaryCount > 1
      ) {
        return fail("একটি মাত্র Primary নম্বর নির্বাচন করুন।", 400);
      }
      updates.whatsappNumbers = cleanNumbers;
    }

    if (body.branding !== undefined) {
      const branding = body.branding;
      if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
        return fail("ব্র্যান্ডিংয়ের তথ্য সঠিক নয়।", 400);
      }

      const clean: Record<string, unknown> = {};
      if ("logo" in branding) {
        if (!imageValid(branding.logo)) return fail("লোগোর ছবির তথ্য সঠিক নয়।", 400);
        clean.logo = branding.logo;
      }
      if ("socialBanner" in branding) {
        if (!imageValid(branding.socialBanner)) {
          return fail("সোশ্যাল ব্যানারের ছবির তথ্য সঠিক নয়।", 400);
        }
        clean.socialBanner = branding.socialBanner;
      }
      if ("intro" in branding) {
        const intro = branding.intro;
        if (!intro || typeof intro !== "object" || Array.isArray(intro)) {
          return fail("ইন্ট্রোর তথ্য সঠিক নয়।", 400);
        }
        const introClean: Record<string, unknown> = {};
        if ("image" in intro) {
          if (!imageValid(intro.image)) return fail("ইন্ট্রোর ছবির তথ্য সঠিক নয়।", 400);
          introClean.image = intro.image;
        }
        for (const key of ["title", "tagline", "loadingText"]) {
          if (key in intro) {
            if (
              typeof intro[key] !== "string" ||
              !intro[key].trim() ||
              intro[key].length > 200
            ) {
              return fail("ইন্ট্রোর লেখার তথ্য সঠিক নয়।", 400);
            }
            introClean[key] = intro[key].trim();
          }
        }
        clean.intro = introClean;
      }
      updates.branding = clean;
    }

    if (Object.keys(updates).length === 0) {
      return fail("পরিবর্তনের কোনো তথ্য পাওয়া যায়নি।", 400);
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    await ref().set(updates, { merge: true });

    return NextResponse.json({
      success: true,
      message: "বিশেষ সাইটের সেটিংস সংরক্ষিত হয়েছে।",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
