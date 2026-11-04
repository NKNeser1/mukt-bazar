import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireRootAdmin } from "@/lib/admin-auth";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orders = () => adminDb.collection("orders");
const products = () => adminDb.collection("products");
const reservations = () => adminDb.collection("cartReservations");
const allowedStatuses = [
  "pending_confirmation", "confirmed", "packing",
  "shipped", "delivered", "cancelled",
] as const;
type OrderStatus = (typeof allowedStatuses)[number];

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHORIZED") return errorResponse("অ্যাডমিন অনুমতি প্রয়োজন।", 401);
  if (code === "FORBIDDEN") return errorResponse("এই কাজের অনুমতি নেই।", 403);
  return null;
}

export async function GET() {
  try {
    await requireAdminPermission("orders.read");
    const snapshot = await orders().orderBy("createdAt", "desc").limit(200).get();
    return NextResponse.json({
      success: true,
      orders: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    return authError(error) ??
      (console.error("Admin orders load failed:", error),
      errorResponse("অর্ডার লোড করা যায়নি।", 500));
  }
}

export async function PATCH(request: NextRequest) {
  let admin: { uid: string; email: string };
  try {
    admin = await requireAdminPermission("orders.update");
  } catch (error) {
    return authError(error) ?? errorResponse("অর্ডার আপডেট করা যায়নি।", 500);
  }

  let customerPhone = "";
  try {
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const status = body?.status;
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!orderId || orderId.length > 150) return errorResponse("সঠিক অর্ডার নম্বর দিন।", 400);
    if (typeof status !== "string" || !allowedStatuses.includes(status as OrderStatus)) {
      return errorResponse("অর্ডারের সঠিক অবস্থা নির্বাচন করুন।", 400);
    }
    if (message.length > 500) return errorResponse("আপডেট বার্তা ৫০০ অক্ষরের মধ্যে রাখুন।", 400);

    const orderRef = orders().doc(orderId);
    const historyEntry = { status, message, updatedAt: new Date().toISOString() };

    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

      const order = orderSnapshot.data()!;
      customerPhone = typeof order.customer?.phone === "string" ? order.customer.phone : "";
      const previousStatus = order.status;

      if (previousStatus === "delivered" || previousStatus === "cancelled") {
        throw new Error("ORDER_TERMINAL");
      }
      if (previousStatus === status) throw new Error("SAME_STATUS");

      const transitions: Record<string, string[]> = {
        pending_confirmation: ["confirmed", "cancelled"],
        confirmed: ["packing", "cancelled"],
        packing: ["shipped", "cancelled"],
        shipped: ["delivered"],
      };
      if (!transitions[previousStatus]?.includes(status)) throw new Error("INVALID_TRANSITION");

      const isConfirm = status === "confirmed";
      const isCancel = status === "cancelled";
      const items = order.items as {
        id?: unknown;
        quantity?: unknown;
        productDocumentId?: unknown;
        reservationId?: unknown;
        name?: unknown;
      }[];

      if ((isConfirm || isCancel) && (!Array.isArray(items) || items.length === 0)) {
        throw new Error("INVALID_ORDER_ITEMS");
      }

      const linkedItems = (isConfirm || isCancel) ? items : [];
      const seenProducts = new Set<string>();
      const productRefs: FirebaseFirestore.DocumentReference[] = [];
      const reservationRefs: (FirebaseFirestore.DocumentReference | null)[] = [];

      for (const item of linkedItems) {
        if (
          typeof item.id !== "string" ||
          !Number.isSafeInteger(item.quantity) ||
          Number(item.quantity) < 1
        ) throw new Error("INVALID_ORDER_ITEMS");

        const productId = item.id;
        let productRef: FirebaseFirestore.DocumentReference;

        if (typeof item.productDocumentId === "string" && item.productDocumentId) {
          productRef = products().doc(item.productDocumentId);
        } else {
          const found = await transaction.get(
            products().where("productId", "==", productId).limit(1),
          );
          if (found.empty) throw new Error("PRODUCT_NOT_FOUND");
          productRef = found.docs[0].ref;
        }

        if (seenProducts.has(productRef.id)) throw new Error("DUPLICATE_ORDER_PRODUCT");
        seenProducts.add(productRef.id);
        productRefs.push(productRef);

        reservationRefs.push(
          typeof item.reservationId === "string" && item.reservationId
            ? reservations().doc(item.reservationId)
            : null,
        );
      }

      const productSnapshots = await Promise.all(
        productRefs.map((ref) => transaction.get(ref)),
      );
      const reservationSnapshots = await Promise.all(
        reservationRefs.map((ref) => ref ? transaction.get(ref) : Promise.resolve(null)),
      );

      const productUpdates: {
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        quantity: number;
        stock: number;
        reserved: number;
        nextStock: number;
        nextReserved: number;
      }[] = [];

      const categoryIds = new Set<string>();

      for (let i = 0; i < linkedItems.length; i++) {
        const item = linkedItems[i];
        const snapshot = productSnapshots[i];
        if (!snapshot.exists) throw new Error("PRODUCT_NOT_FOUND");

        const data = snapshot.data()!;
        const quantity = Number(item.quantity);
        const stock = Number(data.stock ?? 0);
        const reserved = Number(data.reservedStock ?? 0);
        const reservationSnapshot = reservationSnapshots[i];
        const reservationId = item.reservationId;
        const linkedReservation = typeof reservationId === "string" && reservationId.length > 0;

        if (
          !Number.isSafeInteger(stock) || stock < 0 ||
          !Number.isSafeInteger(reserved) || reserved < 0 || reserved > stock
        ) throw new Error("INVALID_STOCK");

        if (linkedReservation) {
          const reservation = reservationSnapshot;
          const reservationData = reservation?.data();
          if (
            !reservation?.exists ||
            reservationData?.productDocumentId !== snapshot.id ||
            reservationData?.productId !== item.id ||
            reservationData?.quantity !== quantity ||
            reservationData?.orderId !== orderId
          ) throw new Error("RESERVATION_MISMATCH");

          if (isConfirm && reservationData?.status !== "order_linked") {
            throw new Error("RESERVATION_MISMATCH");
          }
          if (
            isCancel &&
            previousStatus === "pending_confirmation" &&
            reservationData?.status !== "order_linked"
          ) throw new Error("RESERVATION_MISMATCH");
        }

        let nextStock = stock;
        let nextReserved = reserved;

        if (isConfirm) {
          if (data.published !== true) throw new Error("PRODUCT_UNAVAILABLE");
          if (reserved < quantity || stock < quantity) throw new Error("INSUFFICIENT_STOCK");
          const categoryId = typeof data.category === "string" ? data.category : "";
          if (!categoryId || typeof data.name !== "string" || !data.name ||
              typeof data.english !== "string" || !data.english ||
              typeof data.imageUrl !== "string" ||
              !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(data.imageUrl)) {
            throw new Error("PRODUCT_UNAVAILABLE");
          }
          categoryIds.add(categoryId);
          nextStock = stock - quantity;
          nextReserved = reserved - quantity;
        } else if (isCancel && previousStatus === "pending_confirmation" && linkedReservation) {
          if (reserved < quantity) throw new Error("INVALID_STOCK");
          nextReserved = reserved - quantity;
        } else if (isCancel && order.stockDeducted === true) {
          nextStock = stock + quantity;
          if (!Number.isSafeInteger(nextStock)) throw new Error("INVALID_STOCK");
        }

        productUpdates.push({
          ref: snapshot.ref, data, quantity, stock, reserved, nextStock, nextReserved,
        });
      }

      const categorySnapshots = isConfirm
        ? await Promise.all(
            Array.from(categoryIds).map((id) =>
              transaction.get(adminDb.collection("categories").doc(id)),
            ),
          )
        : [];

      if (categorySnapshots.some((s) => !s.exists || s.data()?.active !== true)) {
        throw new Error("CATEGORY_UNAVAILABLE");
      }

      // All Firestore reads are complete before writes begin.
      for (let i = 0; i < productUpdates.length; i++) {
        const item = productUpdates[i];

        if (item.nextStock !== item.stock || item.nextReserved !== item.reserved) {
          transaction.update(item.ref, {
            stock: item.nextStock,
            reservedStock: item.nextReserved,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        if (isConfirm || (isCancel && order.stockDeducted === true)) {
          const historyRef = adminDb.collection("stockHistory").doc();
          transaction.create(historyRef, {
            productDocumentId: item.ref.id,
            productId: item.data.productId ?? item.ref.id,
            productName: item.data.name ?? "",
            category: item.data.category ?? "",
            action: isConfirm ? "decrease" : "increase",
            amount: item.quantity,
            previousStock: item.stock,
            newStock: item.nextStock,
            reason: isConfirm ? "order_confirmation" : "order_cancellation",
            orderId,
            adminUid: admin.uid,
            adminEmail: admin.email ?? "",
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        const reservationRef = reservationRefs[i];
        if (reservationRef && isConfirm) {
          transaction.update(reservationRef, {
            status: "consumed",
            consumedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else if (
          reservationRef &&
          isCancel &&
          previousStatus === "pending_confirmation"
        ) {
          transaction.update(reservationRef, {
            status: "released",
            releasedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(orderRef, {
        status,
        statusMessage: message,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry),
        ...(isConfirm ? {
          stockDeducted: true,
          stockDeductedAt: FieldValue.serverTimestamp(),
        } : {}),
        ...(isCancel && order.stockDeducted === true ? {
          stockDeducted: false,
          stockRestored: true,
          stockRestoredAt: FieldValue.serverTimestamp(),
        } : {}),
        ...(status === "delivered" ? {
          "review.eligible": true,
          "review.eligibleAt": FieldValue.serverTimestamp(),
        } : {}),
      });
    });

    let whatsappUrl: string | null = null;
    if (status === "confirmed" || status === "delivered") {
      const digits = customerPhone.replace(/\D/g, "");
      const phone = digits.startsWith("880") ? digits :
        digits.startsWith("0") ? `88${digits}` : `880${digits}`;

      if (digits.length >= 10 && digits.length <= 15) {
        const text = status === "confirmed"
          ? [
              "আসসালামু আলাইকুম।",
              "মুক্ত বাজার থেকে আপনার অর্ডারটি নিশ্চিত করা হয়েছে।",
              `অর্ডার নম্বর: ${orderId}`,
              "আপনার পণ্যটি দ্রুত ডেলিভারির জন্য প্রস্তুত করা হবে।",
              "ধন্যবাদ।",
            ].join("\n")
          : [
              "আসসালামু আলাইকুম।",
              "মুক্ত বাজার থেকে আপনার অর্ডারটি গ্রহণ করার জন্য ধন্যবাদ।",
              `অর্ডার নম্বর: ${orderId}`,
              "আপনার অভিজ্ঞতা কেমন ছিল, তা আমাদের জানালে খুশি হব।",
              "আপনার মতামত আমাদের কাছে মূল্যবান।",
              "ধন্যবাদ।",
            ].join("\n");
        whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      }
    }

    return NextResponse.json({
      success: true,
      message: status === "confirmed"
        ? "অর্ডার নিশ্চিত হয়েছে এবং স্টক কমানো হয়েছে।"
        : status === "cancelled"
          ? "অর্ডার বাতিল হয়েছে এবং প্রযোজ্য স্টক ফেরত দেওয়া হয়েছে।"
          : "অর্ডারের অবস্থা সংরক্ষণ হয়েছে।",
      orderId,
      status,
      whatsappUrl,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, { message: string; status: number }> = {
      ORDER_NOT_FOUND: { message: "অর্ডার পাওয়া যায়নি।", status: 404 },
      ORDER_TERMINAL: { message: "সম্পন্ন বা বাতিল অর্ডারের অবস্থা পরিবর্তন করা যাবে না।", status: 409 },
      SAME_STATUS: { message: "এই অবস্থা আগে থেকেই নির্বাচিত আছে।", status: 400 },
      INVALID_TRANSITION: { message: "অর্ডারটি এই ধাপে পরিবর্তন করা যাবে না।", status: 400 },
      INVALID_ORDER_ITEMS: { message: "অর্ডারের পণ্যের তথ্য সঠিক নয়।", status: 400 },
      DUPLICATE_ORDER_PRODUCT: { message: "একই পণ্য অর্ডারে একাধিকবার আছে।", status: 409 },
      PRODUCT_NOT_FOUND: { message: "অর্ডারের একটি পণ্য আর পাওয়া যাচ্ছে না।", status: 409 },
      PRODUCT_UNAVAILABLE: { message: "অর্ডারের একটি পণ্য লুকানো বা বিক্রির অনুপযুক্ত।", status: 409 },
      INSUFFICIENT_STOCK: { message: "পর্যাপ্ত সংরক্ষিত স্টক নেই।", status: 409 },
      INVALID_STOCK: { message: "পণ্যের স্টক বা সংরক্ষিত স্টকের তথ্য সঠিক নয়।", status: 409 },
      RESERVATION_MISMATCH: { message: "অর্ডারের স্টক রিজার্ভেশন যাচাই করা যায়নি।", status: 409 },
      CATEGORY_UNAVAILABLE: { message: "অর্ডারের একটি ক্যাটাগরি বর্তমানে চালু নেই।", status: 409 },
    };
    const known = errors[code];
    if (known) return errorResponse(known.message, known.status);
    console.error("Admin order update failed:", error);
    return errorResponse("অর্ডার আপডেট করা যায়নি।", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await requireRootAdmin())) return errorResponse("অ্যাডমিন অনুমতি প্রয়োজন।", 401);
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId || orderId.length > 150) return errorResponse("সঠিক অর্ডার নম্বর দিন।", 400);

    const ref = orders().doc(orderId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
      const status = snapshot.data()?.status;
      if (!["cancelled", "delivered"].includes(String(status))) {
        throw new Error("ORDER_MUST_BE_CLOSED");
      }
      transaction.delete(ref);
    });

    return NextResponse.json({
      success: true,
      message: "নিষ্পত্তি হওয়া অর্ডার Firebase থেকে মুছে ফেলা হয়েছে।",
      orderId,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ORDER_NOT_FOUND") return errorResponse("অর্ডারটি পাওয়া যায়নি।", 404);
    if (code === "ORDER_MUST_BE_CLOSED") {
      return errorResponse("অর্ডার মুছতে হলে আগে Cancel অথবা Delivered করতে হবে।", 409);
    }
    console.error("Admin order delete failed:", error);
    return errorResponse("অর্ডার মুছে ফেলা যায়নি।", 500);
  }
}
