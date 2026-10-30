
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = () => adminDb.collection("categories");

const SPECIAL_CATEGORY = {
  id: "mc1000",
  code: "SP",
  name: "স্পেশাল",
  english: "Special",
  bn: "স্পেশাল",
  en: "Special",
  icon: "⭐",
  description: "",
  order: -1,
  active: true,
} as const;

const FIXED_CATEGORIES = [
  { id: "food", code: "GROC", name: "চাল, ডাল ও নিত্যপ্রয়োজনীয় মুদি", english: "Groceries", icon: "🛒" },
  { id: "vegetables", code: "VEGE", name: "কাঁচাবাজার ও শাকসবজি", english: "Vegetables", icon: "🥦" },
  { id: "fish", code: "FISH", name: "মাছ ও সামুদ্রিক খাবার", english: "Fish & Seafood", icon: "🐟" },
  { id: "meat", code: "MEAT", name: "মাংস ও পোলট্রি", english: "Meat & Poultry", icon: "🍗" },
  { id: "fruits", code: "FRUT", name: "ফলমূল", english: "Fruits", icon: "🍎" },
  { id: "spices", code: "SPIC", name: "মসলা ও রান্নার উপকরণ", english: "Spices & Cooking", icon: "🌶️" },
  { id: "snacks", code: "SNCK", name: "বেকারি, স্ন্যাকস ও শুকনো খাবার", english: "Bakery & Snacks", icon: "🍪" },
  { id: "dairy", code: "DAIR", name: "দুধ, ডিম ও দুগ্ধজাত খাবার", english: "Dairy & Eggs", icon: "🥚" },
  { id: "frozen", code: "FROZ", name: "হিমায়িত ও প্রস্তুত খাবার", english: "Frozen Foods", icon: "🧊" },
  { id: "drinks", code: "DRNK", name: "পানীয় ও জুস", english: "Drinks & Juice", icon: "🧃" },
  { id: "fashion", code: "MENS", name: "পুরুষদের পোশাক", english: "Men's Clothing", icon: "👔" },
  { id: "women-fashion", code: "WMNS", name: "নারীদের পোশাক", english: "Women's Clothing", icon: "👗" },
  { id: "kids", code: "KIDS", name: "শিশুদের পোশাক ও বেবি পণ্য", english: "Kids & Baby", icon: "🧸" },
  { id: "accessories", code: "FASH", name: "জুতা, ব্যাগ ও ফ্যাশন অ্যাকসেসরিজ", english: "Shoes & Accessories", icon: "👜" },
  { id: "beauty", code: "COSM", name: "কসমেটিকস ও ব্যক্তিগত পরিচর্যা", english: "Beauty & Personal Care", icon: "🧴" },
  { id: "electronics", code: "ELEC", name: "মোবাইল ও ইলেকট্রনিক্স", english: "Mobile & Electronics", icon: "📱" },
  { id: "appliances", code: "APPL", name: "গৃহস্থালি ইলেকট্রিক যন্ত্রপাতি", english: "Home Appliances", icon: "🔌" },
  { id: "kitchen", code: "KICH", name: "রান্নাঘর ও ডাইনিং সামগ্রী", english: "Kitchen & Dining", icon: "🍽️" },
  { id: "cleaning", code: "CLEN", name: "পরিষ্কার-পরিচ্ছন্নতা ও লন্ড্রি", english: "Cleaning & Laundry", icon: "🧹" },
  { id: "home", code: "HOME", name: "ঘর সাজানো ও গৃহস্থালি সামগ্রী", english: "Home & Living", icon: "🏠" },
  { id: "stationery", code: "STAT", name: "স্টেশনারি, বই ও অফিস সামগ্রী", english: "Books & Stationery", icon: "📚" },
  { id: "toys", code: "TOYS", name: "খেলনা ও শিশুদের বিনোদন", english: "Toys & Games", icon: "🪀" },
  { id: "sports", code: "SPRT", name: "খেলাধুলা ও ফিটনেস", english: "Sports & Fitness", icon: "⚽" },
  { id: "tools", code: "TOOL", name: "বাগান, হার্ডওয়্যার ও মেরামতের সরঞ্জাম", english: "Tools & Hardware", icon: "🛠️" },
  { id: "misc", code: "MISC", name: "পোষা প্রাণী ও বিবিধ প্রয়োজনীয় পণ্য", english: "Pets & Essentials", icon: "🐾" },
] as const;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : "";

  if (code === "UNAUTHORIZED") {
    return errorResponse("অ্যাডমিন অনুমতি প্রয়োজন।", 401);
  }

  if (code === "FORBIDDEN") {
    return errorResponse("এই কাজের অনুমতি নেই।", 403);
  }

  return null;
}

async function ensureFixedCategories() {
  const collection = categories();
  const snapshot = await collection.get();
  const existingIds = new Set(snapshot.docs.map((doc) => doc.id));
  const batch = adminDb.batch();

  const specialRef = collection.doc(SPECIAL_CATEGORY.id);
  batch.set(
    specialRef,
    {
      ...SPECIAL_CATEGORY,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  for (const [index, category] of FIXED_CATEGORIES.entries()) {
    const ref = collection.doc(category.id);

    if (!existingIds.has(category.id)) {
      batch.set(ref, {
        ...category,
        description: "",
        active: true,
        order: index,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      batch.set(
        ref,
        { ...category, order: index },
        { merge: true },
      );
    }
  }

  await batch.commit();
}

export async function GET() {
  try {
    await requireAdminPermission("categories.read");
    await ensureFixedCategories();

    const snapshot = await categories().get();
    const orderMap = new Map<string, number>([
      [SPECIAL_CATEGORY.id, -1],
      ...FIXED_CATEGORIES.map((category, index) => [category.id, index] as [string, number]),
    ]);

    const result = snapshot.docs
      .filter((doc) => orderMap.has(doc.id))
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort(
        (a, b) =>
          (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999),
      );

    return NextResponse.json({ success: true, categories: result });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Admin categories load failed:", error);
    return errorResponse("ক্যাটাগরি লোড করা যায়নি।", 500);
  }
}

export async function POST() {
  return errorResponse(
    "নতুন ক্যাটাগরি তৈরি করা যাবে না। নির্ধারিত ২৫টি ক্যাটাগরি ব্যবহার করুন।",
    405,
  );
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminPermission("categories.update");

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.id !== "string" ||
      typeof body.active !== "boolean" ||
      Object.keys(body).some(
        (key) => !["id", "active"].includes(key),
      )
    ) {
      return errorResponse(
        "শুধু ক্যাটাগরির Active/Inactive অবস্থা পরিবর্তন করা যাবে।",
        400,
      );
    }

    const id = body.id.trim();
    const fixedCategory = FIXED_CATEGORIES.find(
      (category) => category.id === id,
    );
    const isSpecialCategory = id === SPECIAL_CATEGORY.id;

    if (!fixedCategory && !isSpecialCategory) {
      return errorResponse("এই ক্যাটাগরি নির্ধারিত তালিকায় নেই।", 400);
    }

    const ref = categories().doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return errorResponse(
        "ক্যাটাগরি পাওয়া যায়নি। আগে তালিকা লোড করুন।",
        404,
      );
    }

    await ref.update({
      active: body.active,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: body.active
        ? "ক্যাটাগরি সক্রিয় হয়েছে।"
        : "ক্যাটাগরি বন্ধ করা হয়েছে।",
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Admin category update failed:", error);
    return errorResponse("ক্যাটাগরির অবস্থা পরিবর্তন করা যায়নি।", 500);
  }
}

export async function DELETE() {
  return errorResponse("নির্ধারিত ক্যাটাগরি মুছে ফেলা যাবে না।", 405);
}
