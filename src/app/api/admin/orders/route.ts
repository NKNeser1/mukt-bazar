
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireRootAdmin } from "@/lib/admin-auth";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orders = () => adminDb.collection("orders");

const allowedStatuses = [
  "pending_confirmation",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof allowedStatuses)[number];

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

export async function GET() {
  try {
    await requireAdminPermission("orders.read");

    const snapshot = await orders()
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    return NextResponse.json({
      success: true,
      orders: snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Admin orders load failed:", error);
    return errorResponse("অর্ডার লোড করা যায়নি।", 500);
  }
}

export async function PATCH(request: NextRequest) {
  let admin: { uid: string; email: string };

  try {
    admin = await requireAdminPermission("orders.update");
  } catch (error) {
    return (
      authError(error) ??
      errorResponse("অর্ডার আপডেট করা যায়নি।", 500)
    );
  }

  let customerPhone = "";

  try {
    const body = await request.json().catch(() => null);
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const status = body?.status;
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!orderId || orderId.length > 150) {
      return errorResponse("সঠিক অর্ডার নম্বর দিন।", 400);
    }

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status as OrderStatus)
    ) {
      return errorResponse("অর্ডারের সঠিক অবস্থা নির্বাচন করুন।", 400);
    }

    if (message.length > 500) {
      return errorResponse("আপডেট বার্তা ৫০০ অক্ষরের মধ্যে রাখুন।", 400);
    }

    const orderRef = orders().doc(orderId);
    const historyEntry = {
      status,
      message,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

      const order = orderSnapshot.data()!;
      customerPhone =
        typeof order.customer?.phone === "string"
          ? order.customer.phone
          : "";
      const previousStatus = order.status;

      if (previousStatus === "delivered" || previousStatus === "cancelled") {
        throw new Error("ORDER_TERMINAL");
      }

      if (previousStatus === status) {
        throw new Error("SAME_STATUS");
      }

      const validTransitions: Record<string, string[]> = {
        pending_confirmation: ["confirmed", "cancelled"],
        confirmed: ["packing", "cancelled"],
        packing: ["shipped", "cancelled"],
        shipped: ["delivered"],
      };

      if (!validTransitions[previousStatus]?.includes(status)) {
        throw new Error("INVALID_TRANSITION");
      }

      if (status === "confirmed") {
        if (!Array.isArray(order.items) || order.items.length === 0) {
          throw new Error("INVALID_ORDER_ITEMS");
        }

        const items = order.items as {
          id?: unknown;
          quantity?: unknown;
        }[];

        const productQueries = items.map((item) => {
          if (
            typeof item.id !== "string" ||
            !Number.isInteger(item.quantity) ||
            Number(item.quantity) < 1
          ) {
            throw new Error("INVALID_ORDER_ITEMS");
          }

          return adminDb
            .collection("products")
            .where("productId", "==", item.id)
            .limit(1);
        });

        const productSnapshots = await Promise.all(
          productQueries.map((query) => transaction.get(query)),
        );

        const productsToUpdate: {
          ref: FirebaseFirestore.DocumentReference;
          product: FirebaseFirestore.DocumentData;
          quantity: number;
          previousStock: number;
          newStock: number;
        }[] = [];

        const categoryIds = new Set<string>();

        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          const snapshot = productSnapshots[index];

          if (snapshot.empty) throw new Error("PRODUCT_NOT_FOUND");

          const productDoc = snapshot.docs[0];
          const product = productDoc.data();
          const categoryId =
            typeof product.category === "string" ? product.category : "";
          const quantity = Number(item.quantity);
          const stock = Number(product.stock);

          if (
            product.published !== true ||
            !categoryId ||
            typeof product.name !== "string" ||
            !product.name ||
            typeof product.english !== "string" ||
            !product.english ||
            typeof product.imageUrl !== "string" ||
            !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
              product.imageUrl,
            )
          ) {
            throw new Error("PRODUCT_UNAVAILABLE");
          }

          if (
            !Number.isSafeInteger(stock) ||
            stock < quantity ||
            stock < 0
          ) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          categoryIds.add(categoryId);

          productsToUpdate.push({
            ref: productDoc.ref,
            product,
            quantity,
            previousStock: stock,
            newStock: stock - quantity,
          });
        }

        const categorySnapshots = await Promise.all(
          Array.from(categoryIds).map((id) =>
            transaction.get(adminDb.collection("categories").doc(id)),
          ),
        );

        if (
          categorySnapshots.some(
            (snapshot) =>
              !snapshot.exists || snapshot.data()?.active !== true,
          )
        ) {
          throw new Error("CATEGORY_UNAVAILABLE");
        }

        for (const item of productsToUpdate) {
          transaction.update(item.ref, {
            stock: item.newStock,
            updatedAt: FieldValue.serverTimestamp(),
          });

          const stockHistoryRef = adminDb.collection("stockHistory").doc();

          transaction.create(stockHistoryRef, {
            productDocumentId: item.ref.id,
            productId: item.product.productId ?? item.ref.id,
            productName: item.product.name ?? "",
            category: item.product.category ?? "",
            action: "decrease",
            amount: item.quantity,
            previousStock: item.previousStock,
            newStock: item.newStock,
            reason: "order_confirmation",
            orderId,
            adminUid: admin.uid,
            adminEmail: admin.email ?? "",
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(orderRef, {
        status,
        statusMessage: message,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry),
        ...(status === "confirmed"
          ? {
              stockDeducted: true,
              stockDeductedAt: FieldValue.serverTimestamp(),
            }
          : {}),
        ...(status === "delivered"
          ? {
              "review.eligible": true,
              "review.eligibleAt": FieldValue.serverTimestamp(),
            }
          : {}),
      });
    });

    let whatsappUrl: string | null = null;

    if (status === "confirmed" || status === "delivered") {
      const digits = customerPhone.replace(/\\D/g, "");
      const phone =
        digits.startsWith("880")
          ? digits
          : digits.startsWith("0")
            ? `88${digits}`
            : `880${digits}`;

      if (digits.length >= 10 && digits.length <= 15) {
        let message: string;

        if (status === "confirmed") {
          message = [
            "আসসালামু আলাইকুম।",
            "মুক্ত বাজার থেকে আপনার অর্ডারটি নিশ্চিত করা হয়েছে।",
            `অর্ডার নম্বর: ${orderId}`,
            "আপনার পণ্যটি দ্রুত ডেলিভারির জন্য প্রস্তুত করা হবে।",
            "ধন্যবাদ।",
          ].join("\\n");
        } else {
          message = [
            "আসসালামু আলাইকুম।",
            "মুক্ত বাজার থেকে আপনার অর্ডারটি গ্রহণ করার জন্য ধন্যবাদ।",
            `অর্ডার নম্বর: ${orderId}`,
            "আপনার অভিজ্ঞতা কেমন ছিল, তা আমাদের জানালে খুশি হব।",
            "আপনার মতামত আমাদের কাছে মূল্যবান।",
            "ধন্যবাদ।",
          ].join("\\n");
        }

        whatsappUrl =
          `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      }
    }

    return NextResponse.json({
      success: true,
      message:
        status === "confirmed"
          ? "অর্ডার নিশ্চিত হয়েছে এবং স্টক কমানো হয়েছে।"
          : "অর্ডারের অবস্থা সংরক্ষণ হয়েছে।",
      orderId,
      status,
      whatsappUrl,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    const errors: Record<string, { message: string; status: number }> = {
      ORDER_NOT_FOUND: { message: "অর্ডার পাওয়া যায়নি।", status: 404 },
      ORDER_TERMINAL: {
        message: "সম্পন্ন বা বাতিল অর্ডারের অবস্থা পরিবর্তন করা যাবে না।",
        status: 409,
      },
      SAME_STATUS: {
        message: "এই অবস্থা আগে থেকেই নির্বাচিত আছে।",
        status: 400,
      },
      INVALID_TRANSITION: {
        message: "অর্ডারটি এই ধাপে পরিবর্তন করা যাবে না।",
        status: 400,
      },
      INVALID_ORDER_ITEMS: {
        message: "অর্ডারের পণ্যের তথ্য সঠিক নয়।",
        status: 400,
      },
      PRODUCT_NOT_FOUND: {
        message: "অর্ডারের একটি পণ্য আর পাওয়া যাচ্ছে না।",
        status: 409,
      },
      PRODUCT_UNAVAILABLE: {
        message: "অর্ডারের একটি পণ্য লুকানো বা বিক্রির অনুপযুক্ত।",
        status: 409,
      },
      INSUFFICIENT_STOCK: {
        message: "পর্যাপ্ত স্টক নেই। স্টক আপডেট করে আবার চেষ্টা করুন।",
        status: 409,
      },
      CATEGORY_UNAVAILABLE: {
        message: "অর্ডারের একটি ক্যাটাগরি বর্তমানে চালু নেই।",
        status: 409,
      },
    };

    const knownError = errors[code];

    if (knownError) {
      return errorResponse(knownError.message, knownError.status);
    }

    console.error("Admin order update failed:", error);
    return errorResponse("অর্ডার আপডেট করা যায়নি।", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await requireRootAdmin())) {
      return errorResponse("অ্যাডমিন অনুমতি প্রয়োজন।", 401);
    }

    const body = await request.json().catch(() => null);
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    if (!orderId || orderId.length > 150) {
      return errorResponse("সঠিক অর্ডার নম্বর দিন।", 400);
    }

    const ref = orders().doc(orderId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return errorResponse("অর্ডারটি পাওয়া যায়নি।", 404);
    }

    await ref.delete();

    return NextResponse.json({
      success: true,
      message: "অর্ডার Firebase থেকে মুছে ফেলা হয়েছে।",
      orderId,
    });
  } catch (error) {
    console.error("Admin order delete failed:", error);
    return errorResponse("অর্ডার মুছে ফেলা যায়নি।", 500);
  }
}
