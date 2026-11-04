import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  CART_SESSION_COOKIE,
  createCartReservationId,
  createCartSessionToken,
  getCartReservationExpiry,
  hashCartSessionToken,
  isValidCartSessionToken,
} from "@/lib/cart-reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const products = () => adminDb.collection("products");
const reservations = () => adminDb.collection("cartReservations");

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function validProductId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

async function updateReservation(
  productId: string,
  quantity: number,
  ownerHash: string,
) {
  const found = await products()
    .where("productId", "==", productId)
    .limit(1)
    .get();

  if (found.empty) throw new Error("PRODUCT_NOT_FOUND");

  const productRef = found.docs[0].ref;
  const reservationRef = reservations().doc(
    createCartReservationId(ownerHash, productRef.id),
  );
  const relatedReservations = reservations().where(
    "productDocumentId",
    "==",
    productRef.id,
  );
  const now = Date.now();

  return adminDb.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    const ownSnapshot = await transaction.get(reservationRef);
    const allReservations = await transaction.get(relatedReservations);

    if (!productSnapshot.exists) throw new Error("PRODUCT_NOT_FOUND");

    const product = productSnapshot.data()!;
    if (product.published !== true) throw new Error("PRODUCT_UNAVAILABLE");

    const stock = Number(product.stock ?? 0);
    const reservedStock = Number(product.reservedStock ?? 0);

    if (
      !Number.isSafeInteger(stock) || stock < 0 ||
      !Number.isSafeInteger(reservedStock) ||
      reservedStock < 0 ||
      reservedStock > stock
    ) {
      throw new Error("INVALID_STOCK");
    }

    let expiredQuantity = 0;
    const expiredRefs: FirebaseFirestore.DocumentReference[] = [];

    for (const doc of allReservations.docs) {
      const data = doc.data();
      if (
        data.status === "active" &&
        data.expiresAt instanceof Timestamp &&
        data.expiresAt.toMillis() <= now
      ) {
        const expired = Number(data.quantity ?? 0);
        if (Number.isSafeInteger(expired) && expired > 0) {
          expiredQuantity += expired;
          expiredRefs.push(doc.ref);
        }
      }
    }

    const own = ownSnapshot.data();
    let ownQuantity = 0;

    if (
      ownSnapshot.exists &&
      own?.status === "active" &&
      own.expiresAt instanceof Timestamp &&
      own.expiresAt.toMillis() > now
    ) {
      ownQuantity = Number(own.quantity ?? 0);
    } else if (
      ownSnapshot.exists &&
      ["order_linked", "consumed"].includes(String(own?.status))
    ) {
      throw new Error("RESERVATION_LOCKED");
    }

    const effectiveReserved = Math.max(0, reservedStock - expiredQuantity);
    const available = stock - Math.max(0, effectiveReserved - ownQuantity);

    if (quantity > available) throw new Error("INSUFFICIENT_STOCK");

    for (const ref of expiredRefs) {
      if (quantity > 0 && ref.path === reservationRef.path) continue;

      transaction.update(ref, {
        status: "expired",
        releasedAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
    }

    const nextReserved = effectiveReserved - ownQuantity + quantity;

    transaction.update(productRef, {
      reservedStock: nextReserved,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const reservationExpiry =
      ownQuantity > 0 && own?.expiresAt instanceof Timestamp
        ? own.expiresAt
        : getCartReservationExpiry(now);

    if (quantity > 0) {
      transaction.set(reservationRef, {
        ownerHash,
        productDocumentId: productRef.id,
        productId,
        quantity,
        status: "active",
        expiresAt: reservationExpiry,
        updatedAt: Timestamp.fromMillis(now),
        createdAt: own?.createdAt ?? Timestamp.fromMillis(now),
      });
    } else if (ownSnapshot.exists && ownQuantity > 0) {
      transaction.update(reservationRef, {
        quantity: 0,
        status: "released",
        releasedAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
    }

    return {
      reserved: quantity,
      available: Math.max(0, stock - nextReserved),
      expiresAt: quantity > 0 ? reservationExpiry.toMillis() : null,
    };
  });
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const errors: Record<string, { message: string; status: number }> = {
    PRODUCT_NOT_FOUND: { message: "পণ্যটি পাওয়া যায়নি।", status: 404 },
    PRODUCT_UNAVAILABLE: { message: "পণ্যটি বর্তমানে পাওয়া যাচ্ছে না।", status: 409 },
    INVALID_STOCK: { message: "পণ্যের স্টক তথ্য সঠিক নয়।", status: 409 },
    INSUFFICIENT_STOCK: { message: "পর্যাপ্ত স্টক নেই। কার্টের পরিমাণ কমান।", status: 409 },
    RESERVATION_LOCKED: { message: "পণ্যটি ইতিমধ্যে অর্ডারের সঙ্গে যুক্ত।", status: 409 },
  };
  const result = errors[code];

  return fail(
    result?.message ?? "রিজার্ভেশন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
    result?.status ?? 500,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const productId = body?.id;
    const quantity = body?.quantity;

    if (
      !validProductId(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 99
    ) {
      return fail("পণ্যের ID অথবা পরিমাণ সঠিক নয়।", 400);
    }

    const existing = request.cookies.get(CART_SESSION_COOKIE)?.value;
    const token = isValidCartSessionToken(existing)
      ? existing
      : createCartSessionToken();

    const result = await updateReservation(
      productId,
      quantity,
      hashCartSessionToken(token),
    );

    const response = NextResponse.json({ success: true, ...result });

    if (token !== existing) {
      response.cookies.set(CART_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("id");
    if (!validProductId(productId)) {
      return fail("পণ্যের ID সঠিক নয়।", 400);
    }

    const token = request.cookies.get(CART_SESSION_COOKIE)?.value;

    if (!isValidCartSessionToken(token)) {
      return NextResponse.json({ success: true, released: 0 });
    }

    const result = await updateReservation(
      productId,
      0,
      hashCartSessionToken(token),
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
