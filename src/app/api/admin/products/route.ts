import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-access";
import type { AdminPermission } from "@/lib/admin-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const products = () => adminDb.collection("products");
const UNIT_OPTIONS = ["পিস", "ডজন", "জোড়া", "প্যাকেট", "বাক্স", "কার্টন", "বস্তা", "বোতল", "ক্যান", "রোল", "সেট", "কেজি", "গ্রাম", "মিলিগ্রাম", "টন", "লিটার", "মিলিলিটার", "মিটার", "সেন্টিমিটার", "ফুট", "ইঞ্চি"] as const;
const registry = () => adminDb.collection("productIdRegistry");
const counters = () => adminDb.collection("productIdCounters");

const CATEGORY_CODES: Record<string, string> = {
  food: "GROC", vegetables: "VEGE", fish: "FISH", meat: "MEAT",
  fruits: "FRUT", spices: "SPIC", snacks: "SNCK", dairy: "DAIR",
  frozen: "FROZ", drinks: "DRNK", fashion: "MENS",
  "women-fashion": "WMNS", kids: "KIDS", accessories: "FASH",
  beauty: "COSM", electronics: "ELEC", appliances: "APPL",
  kitchen: "KICH", cleaning: "CLEN", home: "HOME",
  stationery: "STAT", toys: "TOYS", sports: "SPRT",
  tools: "TOOL", misc: "MISC",
  mc1000: "SP",
};

function errorResponse(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { success: false, message, ...extra },
    { status },
  );
}

async function authorize(permission: AdminPermission) {
  try {
    await requireAdminPermission(permission);
    return null;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    return errorResponse(
      code === "UNAUTHORIZED"
        ? "আবার অ্যাডমিন লগইন করুন।"
        : "এই কাজের অনুমতি নেই।",
      code === "UNAUTHORIZED" ? 401 : 403,
    );
  }
}

function validImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
      value.trim(),
    )
  );
}

export async function GET() {
  const denied = await authorize("products.read");
  if (denied) return denied;

  try {
    const snapshot = await products().orderBy("createdAt", "desc").get();

    return NextResponse.json({
      success: true,
      products: snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
    });
  } catch {
    return errorResponse("পণ্যের তালিকা লোড করা যায়নি।", 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorize("products.create");
  if (denied) return denied;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const english = typeof body.english === "string" ? body.english.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    const price = Number(body.price);
    const stock = Number(body.stock);
    const unit = typeof body.unit === "string" ? body.unit : "পিস";
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!name || !english || !CATEGORY_CODES[category]) {
      return errorResponse("পণ্যের নাম ও সঠিক ক্যাটাগরি দিন।", 400);
    }

    if (
      !Number.isFinite(price) || price <= 0 ||
      !Number.isInteger(stock) || stock < 0 ||
      !UNIT_OPTIONS.includes(unit as (typeof UNIT_OPTIONS)[number])
    ) {
      return errorResponse("দাম ও স্টকের সংখ্যা সঠিক দিন।", 400);
    }

    if (!validImageUrl(imageUrl)) {
      return errorResponse("Cloudinary-এর বৈধ পণ্যের ছবি দিতে হবে।", 400);
    }

    const oldPrice = body.oldPrice == null ? price : Number(body.oldPrice);
    if (!Number.isFinite(oldPrice) || oldPrice < price) {
      return errorResponse("আগের দাম বর্তমান দামের সমান বা বেশি হতে হবে।", 400);
    }

    const code = CATEGORY_CODES[category];
    const productRef = products().doc();
    const counterRef = counters().doc(code);

    const productId = await adminDb.runTransaction(async (transaction) => {
      const counterSnapshot = await transaction.get(counterRef);
      const previousCount = Number(counterSnapshot.data()?.lastNumber ?? 0);

      if (
        !Number.isSafeInteger(previousCount) ||
        previousCount < 0 ||
        previousCount >= 99999998
      ) {
        throw new Error("PRODUCT_ID_COUNTER_INVALID");
      }

      let nextNumber = previousCount + 1;
      let newProductId = "";
      let registryRef: FirebaseFirestore.DocumentReference | undefined;
      let registrySnapshot: FirebaseFirestore.DocumentSnapshot | undefined;

      while (nextNumber <= 99999998) {
        newProductId = `${code}-${String(nextNumber).padStart(4, "0")}`;
        registryRef = registry().doc(newProductId);
        registrySnapshot = await transaction.get(registryRef);

        if (!registrySnapshot.exists) break;
        nextNumber++;
      }

      if (
        nextNumber > 99999998 ||
        !registryRef ||
        !registrySnapshot ||
        registrySnapshot.exists
      ) {
        throw new Error("PRODUCT_ID_COUNTER_INVALID");
      }

      transaction.set(counterRef, {
        category,
        code,
        lastNumber: nextNumber,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.create(registryRef, {
        productId: newProductId,
        name,
        category,
        productDocumentId: productRef.id,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.create(productRef, {
        productId: newProductId,
        name,
        english,
        description:
          typeof body.description === "string" ? body.description.trim() : "",
        englishDescription:
          typeof body.englishDescription === "string"
            ? body.englishDescription.trim()
            : "",
        category,
        price,
        oldPrice,
        stock,
        unit,
        imageUrl,
        published: body.published === true && stock > 0,
        special: body.special === true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return newProductId;
    });

    return NextResponse.json(
      {
        success: true,
        message: "পণ্য যোগ হয়েছে।",
        product: { id: productRef.id, productId },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_ID_COUNTER_INVALID") {
      return errorResponse("পণ্যের আইডি কাউন্টার পরীক্ষা করা প্রয়োজন।", 500);
    }

    return errorResponse("পণ্য যোগ করা যায়নি।", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await authorize("products.update");
  if (denied) return denied;

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";

    const allowed = [
      "name", "english", "description", "englishDescription",
      "price", "oldPrice", "stock", "unit", "imageUrl", "published", "special",
    ] as const;

    if (
      !id ||
      !Object.keys(body).some((key) =>
        allowed.includes(key as (typeof allowed)[number]),
      )
    ) {
      return errorResponse("পণ্যের ID ও পরিবর্তনের তথ্য দিন।", 400);
    }

    const ref = products().doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return errorResponse("পণ্যটি পাওয়া যায়নি।", 404);
    }

    const current = snapshot.data()!;
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates[key] = body[key];
      }
    }

    for (const key of ["name", "english", "description", "englishDescription"] as const) {
      if (key in updates && typeof updates[key] !== "string") {
        return errorResponse("পণ্যের নাম বা বিবরণের তথ্য সঠিক নয়।", 400);
      }
      if (key in updates) updates[key] = (updates[key] as string).trim();
    }

    for (const key of ["published", "special"] as const) {
      if (key in updates && typeof updates[key] !== "boolean") {
        return errorResponse("পণ্যের প্রকাশ বা বিশেষ অফারের মান সঠিক নয়।", 400);
      }
    }

    if ("unit" in updates && (typeof updates.unit !== "string" || !UNIT_OPTIONS.includes(updates.unit as (typeof UNIT_OPTIONS)[number]))) {
      return errorResponse("পণ্যের একক সঠিকভাবে নির্বাচন করুন।", 400);
    }

    const nextPrice = "price" in updates ? Number(updates.price) : Number(current.price);
    const nextOldPrice = "oldPrice" in updates
      ? Number(updates.oldPrice)
      : Number(current.oldPrice ?? current.price);
    const nextStock = "stock" in updates ? Number(updates.stock) : Number(current.stock ?? 0);

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      return errorResponse("দাম সঠিক নয়।", 400);
    }
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      return errorResponse("স্টকের সংখ্যা সঠিক নয়।", 400);
    }
    if (!Number.isFinite(nextOldPrice) || nextOldPrice < nextPrice) {
      return errorResponse("আগের দাম বর্তমান দামের সমান বা বেশি হতে হবে।", 400);
    }
    if ("imageUrl" in updates && !validImageUrl(updates.imageUrl)) {
      return errorResponse("Cloudinary-এর বৈধ ছবির লিংক দিন।", 400);
    }
    if (updates.published === true && nextStock <= 0) {
      return errorResponse("স্টক শূন্য হলে পণ্য প্রকাশ করা যাবে না।", 400);
    }
    if (updates.published === true && !("imageUrl" in updates) && !current.imageUrl) {
      return errorResponse("ছবি ছাড়া পণ্য প্রকাশ করা যাবে না।", 400);
    }

    updates.price = nextPrice;
    updates.oldPrice = nextOldPrice;
    updates.stock = nextStock;

    if (nextStock <= 0 || ("imageUrl" in updates && !updates.imageUrl)) {
      updates.published = false;
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    await ref.update(updates);

    return NextResponse.json({ success: true, message: "পণ্য আপডেট হয়েছে।" });
  } catch {
    return errorResponse("পণ্য আপডেট করা যায়নি।", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await authorize("products.delete");
  if (denied) return denied;

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (!id) return errorResponse("পণ্যের ID দিন।", 400);

    const ref = products().doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) return errorResponse("পণ্যটি পাওয়া যায়নি।", 404);

    const product = snapshot.data()!;
    const productId = typeof product.productId === "string" ? product.productId : "";

    await adminDb.runTransaction(async (transaction) => {
      const freshProduct = await transaction.get(ref);
      if (!freshProduct.exists) throw new Error("PRODUCT_NOT_FOUND");

      if (productId) {
        const registryRef = registry().doc(productId);
        const registrySnapshot = await transaction.get(registryRef);

        if (registrySnapshot.exists) {
          transaction.update(registryRef, {
            status: "deleted",
            deletedAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.create(registryRef, {
            productId,
            name: product.name ?? "অজানা পণ্য",
            category: product.category ?? "",
            productDocumentId: id,
            status: "deleted",
            createdAt: FieldValue.serverTimestamp(),
            deletedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.delete(ref);
    });

    return NextResponse.json({
      success: true,
      message: "পণ্য মুছে ফেলা হয়েছে। আইডির ইতিহাস সংরক্ষিত আছে।",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return errorResponse("পণ্যটি পাওয়া যায়নি।", 404);
    }
    return errorResponse("পণ্য মুছে ফেলা যায়নি।", 500);
  }
}