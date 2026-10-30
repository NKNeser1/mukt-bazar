import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_IDS = [
  "mc1000",
  "food", "vegetables", "fish", "meat", "fruits",
  "spices", "snacks", "dairy", "frozen", "drinks",
  "fashion", "women-fashion", "kids", "accessories", "beauty",
  "electronics", "appliances", "kitchen", "cleaning", "home",
  "stationery", "toys", "sports", "tools", "misc",
];

const categories = [
  ["mc1000", "স্পেশাল"],
  ["food", "খাদ্যপণ্য"], ["vegetables", "শাকসবজি"],
  ["fish", "মাছ"], ["meat", "মাংস"], ["fruits", "ফলমূল"],
  ["spices", "মসলা"], ["snacks", "স্ন্যাকস"], ["dairy", "দুগ্ধজাত"],
  ["frozen", "হিমায়িত খাবার"], ["drinks", "পানীয়"],
  ["fashion", "পুরুষদের ফ্যাশন"], ["women-fashion", "নারীদের ফ্যাশন"],
  ["kids", "শিশুদের পণ্য"], ["accessories", "অ্যাক্সেসরিজ"],
  ["beauty", "বিউটি ও কসমেটিকস"], ["electronics", "ইলেকট্রনিকস"],
  ["appliances", "গৃহস্থালি যন্ত্রপাতি"], ["kitchen", "রান্নাঘর"],
  ["cleaning", "পরিষ্কার-পরিচ্ছন্নতা"], ["home", "ঘর সাজানোর পণ্য"],
  ["stationery", "স্টেশনারি"], ["toys", "খেলনা"],
  ["sports", "খেলাধুলার পণ্য"], ["tools", "যন্ত্রপাতি"],
  ["misc", "অন্যান্য"],
].map(([id, name]) => ({ id, name }));

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function authorize() {
  try {
    await requireAdminPermission("banners.manage");
    return null;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return fail(
      code === "UNAUTHORIZED" ? "আবার লগইন করুন।" : "এই কাজের অনুমতি নেই।",
      code === "UNAUTHORIZED" ? 401 : 403,
    );
  }
}

function collectionFor(type: string) {
  if (type === "banner") return adminDb.collection("specialBanners");
  if (type === "brand") return adminDb.collection("brands");
  return null;
}

function validImage(url: unknown, publicId: unknown, folder: string) {
  return (
    typeof url === "string" &&
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) &&
    typeof publicId === "string" &&
    publicId.startsWith(`mukt-bazar/${folder}/`) &&
    publicId.length <= 300
  );
}

export async function GET(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;

  try {
    const type = request.nextUrl.searchParams.get("type") || "banner";
    const collection = collectionFor(type);
    if (!collection) return fail("তথ্যের ধরন সঠিক নয়।", 400);

    const snapshot = await collection.orderBy("createdAt", "desc").get();

    return NextResponse.json({
      success: true,
      categories,
      items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch {
    return fail("তথ্য লোড করা যায়নি।", 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;

  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? body.type : "";
    const collection = collectionFor(type);
    if (!collection) return fail("ব্যানার অথবা ব্র্যান্ড নির্বাচন করুন।", 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const imageUrl = body.imageUrl;
    const publicId = body.publicId;
    const folder = type === "banner" ? "banners" : "brands";

    if (!name || name.length > 120) {
      return fail("নাম লিখুন (সর্বোচ্চ ১২০ অক্ষর)।", 400);
    }

    if (!validImage(imageUrl, publicId, folder)) {
      return fail("এই ধরনের Cloudinary ছবির তথ্য সঠিক নয়।", 400);
    }

    if (type === "banner") {
      const category = typeof body.category === "string" ? body.category : "";
      if (!CATEGORY_IDS.includes(category)) {
        return fail("সঠিক ক্যাটাগরি নির্বাচন করুন।", 400);
      }

      const ref = collection.doc(category);
      await ref.set({
        type,
        name,
        category,
        imageUrl,
        publicId,
        active: body.active === true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: "ক্যাটাগরির ব্যানার সংরক্ষিত হয়েছে।",
        id: ref.id,
      });
    }

    const ref = collection.doc();
    await ref.set({
      type,
      name,
      imageUrl,
      publicId,
      active: body.active === true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { success: true, message: "ব্র্যান্ড যোগ হয়েছে।", id: ref.id },
      { status: 201 },
    );
  } catch {
    return fail("তথ্য সংরক্ষণ করা যায়নি।", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;

  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? body.type : "";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const collection = collectionFor(type);

    if (!collection || !id) {
      return fail("পরিবর্তনের তথ্য সঠিক নয়।", 400);
    }
    if (type === "banner" && !CATEGORY_IDS.includes(id)) {
      return fail("ক্যাটাগরির আইডি সঠিক নয়।", 400);
    }

    const ref = collection.doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return fail("তথ্যটি পাওয়া যায়নি।", 404);

    if (body.action === "edit") {
      const oldData = snapshot.data()!;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const imageUrl = body.imageUrl;
      const publicId = body.publicId;
      const folder = type === "banner" ? "banners" : "brands";

      if (!name || name.length > 120) {
        return fail("নাম লিখুন (সর্বোচ্চ ১২০ অক্ষর)।", 400);
      }
      if (!validImage(imageUrl, publicId, folder)) {
        return fail("Cloudinary ছবির তথ্য সঠিক নয়।", 400);
      }

      if (type === "banner" && body.category !== id) {
        return fail("ব্যানারের ক্যাটাগরি সঠিক নয়।", 400);
      }

      await ref.update({
        name,
        ...(type === "banner" ? { category: id } : {}),
        imageUrl,
        publicId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (
        oldData.publicId &&
        oldData.publicId !== publicId &&
        typeof oldData.publicId === "string" &&
        oldData.publicId.startsWith(`mukt-bazar/${folder}/`) &&
        process.env.CLOUDINARY_URL
      ) {
        try {
          await cloudinary.uploader.destroy(oldData.publicId, {
            resource_type: "image",
            invalidate: true,
          });
        } catch {
          // পুরোনো ছবির পরিষ্কার ব্যর্থ হলেও নতুন তথ্য সংরক্ষিত থাকবে।
        }
      }

      return NextResponse.json({
        success: true,
        message: "তথ্য আপডেট হয়েছে।",
      });
    }

    if (typeof body.active !== "boolean") {
      return fail("সক্রিয়/নিষ্ক্রিয় অবস্থা সঠিক নয়।", 400);
    }

    await ref.update({
      active: body.active,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "অবস্থা পরিবর্তন হয়েছে।",
    });
  } catch {
    return fail("তথ্য পরিবর্তন করা যায়নি।", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;

  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? body.type : "";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const collection = collectionFor(type);

    if (!collection || !id) return fail("মুছে ফেলার তথ্য সঠিক নয়।", 400);
    if (type === "banner" && !CATEGORY_IDS.includes(id)) {
      return fail("ক্যাটাগরির আইডি সঠিক নয়।", 400);
    }

    const ref = collection.doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return fail("তথ্যটি পাওয়া যায়নি।", 404);

    const data = snapshot.data()!;
    const folder = type === "banner" ? "banners" : "brands";
    const publicId = data.publicId;

    if (
      typeof publicId === "string" &&
      publicId.startsWith(`mukt-bazar/${folder}/`)
    ) {
      if (!process.env.CLOUDINARY_URL) {
        return fail("Cloudinary সেটিংস পাওয়া যায়নি।", 500);
      }
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      if (result.result !== "ok" && result.result !== "not found") {
        return fail("Cloudinary-এর ছবি মুছে ফেলা যায়নি।", 502);
      }
    }

    await ref.delete();
    return NextResponse.json({ success: true, message: "তথ্য মুছে ফেলা হয়েছে।" });
  } catch {
    return fail("তথ্য মুছে ফেলা যায়নি।", 500);
  }
}
