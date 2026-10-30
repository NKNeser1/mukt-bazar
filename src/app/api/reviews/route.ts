import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validToken(order: FirebaseFirestore.DocumentData, token: string) {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret || secret.length < 32 || !/^[a-f0-9]{64}$/.test(token)) return false;
  const stored = order.review?.tokenHash;
  if (typeof stored !== "string" || !/^[a-f0-9]{64}$/.test(stored)) return false;
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(stored, "hex");
  return timingSafeEqual(actual, expected);
}

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId")?.trim() ?? "";
    const token = request.nextUrl.searchParams.get("token") ?? "";
    if (!orderId || orderId.length > 150 || !token) return fail("রিভিউ লিংক সঠিক নয়।");

    const snapshot = await adminDb.collection("orders").doc(orderId).get();
    if (!snapshot.exists) return fail("অর্ডার পাওয়া যায়নি।", 404);

    const order = snapshot.data()!;
    if (!validToken(order, token)) return fail("রিভিউ লিংক সঠিক নয়।", 403);
    if (order.status !== "delivered" || order.review?.eligible !== true) {
      return fail("ডেলিভারি সম্পন্ন হওয়ার পর রিভিউ দেওয়া যাবে।", 403);
    }
    if (order.review?.submitted === true) return fail("এই অর্ডারের রিভিউ আগেই জমা হয়েছে।", 409);

    const items = Array.isArray(order.items) ? order.items : [];
    return NextResponse.json({
      success: true,
      orderId,
      items: items.map((item: Record<string, unknown>) => ({
        id: typeof item.id === "string" ? item.id : "",
        name: typeof item.name === "string" ? item.name : "",
        quantity: Number(item.quantity) || 0,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Review verification failed:", error);
    return fail("রিভিউ তথ্য যাচাই করা যায়নি।", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const token = typeof body?.token === "string" ? body.token : "";
    const productRating = body?.productRating;
    const deliveryRating = body?.deliveryRating;
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

    if (!orderId || orderId.length > 150 || !token) return fail("রিভিউ লিংক সঠিক নয়।");
    if (!Number.isInteger(productRating) || productRating < 1 || productRating > 5 ||
        !Number.isInteger(deliveryRating) || deliveryRating < 1 || deliveryRating > 5) {
      return fail("পণ্য ও ডেলিভারির রেটিং ১ থেকে ৫ স্টার দিতে হবে।");
    }
    if (comment.length > 1000) return fail("মন্তব্য ১০০০ অক্ষরের মধ্যে রাখুন।");

    const orderRef = adminDb.collection("orders").doc(orderId);
    const reviewRef = adminDb.collection("reviews").doc(orderId);

    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

      const order = orderSnapshot.data()!;
      if (!validToken(order, token)) throw new Error("INVALID_TOKEN");
      if (order.status !== "delivered" || order.review?.eligible !== true) {
        throw new Error("NOT_ELIGIBLE");
      }
      if (order.review?.submitted === true) throw new Error("ALREADY_SUBMITTED");

      const existingReview = await transaction.get(reviewRef);
      if (existingReview.exists) throw new Error("ALREADY_SUBMITTED");

      const items = Array.isArray(order.items) ? order.items : [];
      const productIds = [...new Set(items
        .map((item: Record<string, unknown>) => item.id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0))];

      if (!productIds.length || productIds.length > 50) throw new Error("INVALID_ITEMS");

      const queries = productIds.map((id) =>
        adminDb.collection("products").where("productId", "==", id).limit(1),
      );
      const productSnapshots = await Promise.all(
        queries.map((query) => transaction.get(query)),
      );

      const productRefs = productSnapshots.map((snapshot) => {
        if (snapshot.empty) throw new Error("PRODUCT_NOT_FOUND");
        return snapshot.docs[0].ref;
      });

      const now = FieldValue.serverTimestamp();
      transaction.create(reviewRef, {
        orderId,
        productIds,
        productRating,
        deliveryRating,
        comment,
        createdAt: now,
      });

      for (const ref of productRefs) {
        const productSnapshot = productSnapshots[productRefs.indexOf(ref)].docs[0];
        const summary = productSnapshot.data().ratingSummary ?? {};
        const count = Number(summary.count) || 0;
        const total = Number(summary.total) || 0;
        const distribution = summary.distribution ?? {};
        const key = String(productRating);

        transaction.update(ref, {
          ratingSummary: {
            count: count + 1,
            total: total + productRating,
            distribution: {
              "1": Number(distribution["1"]) || 0,
              "2": Number(distribution["2"]) || 0,
              "3": Number(distribution["3"]) || 0,
              "4": Number(distribution["4"]) || 0,
              "5": (Number(distribution["5"]) || 0) + (key === "5" ? 1 : 0),
              ...(key !== "5" ? { [key]: (Number(distribution[key]) || 0) + 1 } : {}),
            },
          },
          updatedAt: now,
        });
      }

      transaction.update(orderRef, {
        "review.submitted": true,
        "review.submittedAt": now,
      });
    });

    return NextResponse.json({ success: true, message: "আপনার রিভিউ জমা হয়েছে। ধন্যবাদ!" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, [string, number]> = {
      ORDER_NOT_FOUND: ["অর্ডার পাওয়া যায়নি।", 404],
      INVALID_TOKEN: ["রিভিউ লিংক সঠিক নয়।", 403],
      NOT_ELIGIBLE: ["শুধু ডেলিভারি সম্পন্ন অর্ডারে রিভিউ দেওয়া যাবে।", 403],
      ALREADY_SUBMITTED: ["এই অর্ডারের রিভিউ আগেই জমা হয়েছে।", 409],
      INVALID_ITEMS: ["অর্ডারের পণ্যের তথ্য সঠিক নয়।", 400],
      PRODUCT_NOT_FOUND: ["অর্ডারের একটি পণ্য পাওয়া যায়নি।", 409],
    };
    if (errors[code]) return fail(errors[code][0], errors[code][1]);
    console.error("Review submission failed:", error);
    return fail("রিভিউ জমা দেওয়া যায়নি।", 500);
  }
}
