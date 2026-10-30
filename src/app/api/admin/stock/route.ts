
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("stock.update");

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const mode = body.mode;
    const amount = body.amount;

    if (
      !id ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      (mode !== "increase" && mode !== "decrease")
    ) {
      return errorResponse("পণ্য, পরিবর্তনের ধরন ও সঠিক সংখ্যা দিন।", 400);
    }

    const productRef = adminDb.collection("products").doc(id);
    const historyRef = adminDb.collection("stockHistory").doc();

    const result = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(productRef);

      if (!snapshot.exists) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const product = snapshot.data()!;
      const previousStock = Number(product.stock ?? 0);

      if (!Number.isSafeInteger(previousStock) || previousStock < 0) {
        throw new Error("INVALID_CURRENT_STOCK");
      }

      const newStock =
        mode === "increase"
          ? previousStock + amount
          : previousStock - amount;

      if (!Number.isSafeInteger(newStock) || newStock < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      transaction.update(productRef, {
        stock: newStock,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.create(historyRef, {
        productDocumentId: id,
        productId: product.productId ?? id,
        productName: product.name ?? "",
        category: product.category ?? "",
        action: mode,
        amount,
        previousStock,
        newStock,
        adminUid: admin.uid,
        adminEmail: admin.email ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { previousStock, newStock };
    });

    return NextResponse.json({
      success: true,
      message: "স্টক আপডেট হয়েছে।",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return errorResponse("লগইন করুন।", 401);
      }

      if (error.message === "FORBIDDEN") {
        return errorResponse("স্টক পরিবর্তনের অনুমতি নেই।", 403);
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return errorResponse("পণ্যটি পাওয়া যায়নি।", 404);
      }

      if (error.message === "INSUFFICIENT_STOCK") {
        return errorResponse("বর্তমান স্টকের চেয়ে বেশি কমানো যাবে না।", 400);
      }

      if (error.message === "INVALID_CURRENT_STOCK") {
        return errorResponse("পণ্যের বর্তমান স্টক পরীক্ষা করা প্রয়োজন।", 400);
      }
    }

    return errorResponse("স্টক আপডেট করা যায়নি।", 500);
  }
}
