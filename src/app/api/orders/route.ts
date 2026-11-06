import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  CART_SESSION_COOKIE,
  createCartReservationId,
  hashCartSessionToken,
  isValidCartSessionToken,
} from "@/lib/cart-reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmittedItem = { id: string; quantity: number };

function moneyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("অর্ডারের তথ্য সঠিক নয়।", 400);
    }

    const data = body as Record<string, unknown>;

    let customerUid: string | null = null;
    const sessionCookie = request.cookies.get(
      "mukt_bazar_customer_session",
    )?.value;

    if (sessionCookie) {
      try {
        const decoded = await adminAuth.verifySessionCookie(
          sessionCookie,
          true,
        );

        if (decoded.role) {
          return fail("Customer সেশন অনুমোদিত নয়।", 403);
        }

        const [user, adminDoc, profileSnap] = await Promise.all([
          adminAuth.getUser(decoded.uid),
          adminDb.collection("admins").doc(decoded.uid).get(),
          adminDb.collection("customers").doc(decoded.uid).get(),
        ]);

        if (
          user.disabled ||
          !user.email ||
          adminDoc.exists ||
          !profileSnap.exists
        ) {
          return fail("Customer সেশন যাচাই করা যায়নি।", 403);
        }

        customerUid = decoded.uid;
      } catch {
        return fail("Customer লগইন সেশনের মেয়াদ শেষ। আবার লগইন করুন।", 401);
      }
    }
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const address = typeof data.address === "string" ? data.address.trim() : "";
    const note = typeof data.note === "string" ? data.note.trim() : "";
    const paymentMethod = data.paymentMethod;
    const whatsappNumberId =
      typeof data.whatsappNumberId === "string"
        ? data.whatsappNumberId.trim()
        : "";
    const submittedItems = data.items;

    if (
      !name || name.length > 100 ||
      !phone || phone.length > 20 ||
      !/^[0-9+\s()-]{7,20}$/.test(phone) ||
      !address || address.length > 500 ||
      note.length > 1000
    ) {
      return fail("নাম, মোবাইল নম্বর বা ঠিকানা যাচাই করুন।", 400);
    }

    if (paymentMethod !== "cod") {
      return fail("এই মুহূর্তে শুধু ক্যাশ অন ডেলিভারি চালু আছে।", 400);
    }

    if (!whatsappNumberId) {
      return fail("একটি WhatsApp নম্বর নির্বাচন করুন।", 400);
    }

    if (
      !Array.isArray(submittedItems) ||
      submittedItems.length === 0 ||
      submittedItems.length > 50
    ) {
      return fail("কার্টে বৈধ পণ্য নেই।", 400);
    }

    const token = request.cookies.get(CART_SESSION_COOKIE)?.value;
    if (!isValidCartSessionToken(token)) {
      return fail("কার্টের স্টক সংরক্ষণের সময় শেষ। কার্ট আবার যাচাই করুন।", 409);
    }
    const ownerHash = hashCartSessionToken(token);

    const seen = new Set<string>();
    const items = submittedItems as SubmittedItem[];

    for (const item of items) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99 ||
        seen.has(item.id)
      ) {
        return fail("কার্টের পণ্যের তথ্য সঠিক নয়।", 400);
      }
      seen.add(item.id);
    }

    const settingsSnapshot = await adminDb
      .collection("siteSettings")
      .doc("specialSite")
      .get();

    const configuredNumbers = settingsSnapshot.data()?.whatsappNumbers;
    const selectedNumber = Array.isArray(configuredNumbers)
      ? configuredNumbers.find((item: unknown) => {
          if (!item || typeof item !== "object") return false;
          const option = item as Record<string, unknown>;
          return option.id === whatsappNumberId && option.active === true;
        })
      : undefined;

    const whatsappNumber =
      selectedNumber && typeof selectedNumber === "object"
        ? (selectedNumber as Record<string, unknown>).number
        : null;

    if (
      typeof whatsappNumber !== "string" ||
      !/^[0-9]{8,15}$/.test(whatsappNumber)
    ) {
      return fail("নির্বাচিত WhatsApp নম্বরটি সক্রিয় নেই। অন্য নম্বর নির্বাচন করুন।", 400);
    }

    const whatsappLabel =
      selectedNumber && typeof selectedNumber === "object" &&
      typeof (selectedNumber as Record<string, unknown>).label === "string"
        ? (selectedNumber as Record<string, unknown>).label
        : "";

    const reviewSecret = process.env.REVIEW_TOKEN_SECRET;
    if (!reviewSecret || reviewSecret.length < 32) {
      return fail("রিভিউ নিরাপত্তা সেটিংস প্রস্তুত নয়।", 500);
    }

    const orderRef = adminDb.collection("orders").doc();
    const reviewToken = createHmac("sha256", reviewSecret)
      .update(`mukt-bazar-review:${orderRef.id}`)
      .digest("hex");
    const reviewTokenHash = createHash("sha256")
      .update(reviewToken)
      .digest("hex");

    const now = Date.now();
    const orderItems: {
      id: string;
      name: string;
      price: number;
      unit: string;
      quantity: number;
      subtotal: number;
      productDocumentId: string;
      reservationId: string;
    }[] = [];

    await adminDb.runTransaction(async (transaction) => {
      orderItems.length = 0;
      const productQueries = items.map((item) =>
        adminDb.collection("products")
          .where("productId", "==", item.id)
          .limit(1),
      );

      const productSnapshots = await Promise.all(
        productQueries.map((query) => transaction.get(query)),
      );

      const productDocs = productSnapshots.map((snapshot) => {
        if (snapshot.empty) throw new Error("PRODUCT_NOT_FOUND");
        return snapshot.docs[0];
      });

      const reservationRefs = productDocs.map((doc) =>
        adminDb.collection("cartReservations").doc(
          createCartReservationId(ownerHash, doc.id),
        ),
      );

      const categoryIds = productDocs.map((doc) => {
        const categoryId = doc.data().category;
        if (typeof categoryId !== "string" || !categoryId) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }
        return categoryId;
      });

      const categoryRefs = Array.from(new Set(categoryIds)).map((id) =>
        adminDb.collection("categories").doc(id),
      );

      const [reservationSnapshots, categorySnapshots] = await Promise.all([
        Promise.all(reservationRefs.map((ref) => transaction.get(ref))),
        Promise.all(categoryRefs.map((ref) => transaction.get(ref))),
      ]);

      const categories = new Map(
        categorySnapshots.map((snapshot) => [snapshot.id, snapshot]),
      );

      for (let index = 0; index < items.length; index++) {
        const submitted = items[index];
        const productDoc = productDocs[index];
        const product = productDoc.data();
        const reservation = reservationSnapshots[index];
        const reservationData = reservation.data();
        const categoryId = categoryIds[index];

        if (
          product.published !== true ||
          typeof product.name !== "string" || !product.name ||
          typeof product.english !== "string" || !product.english ||
          typeof product.imageUrl !== "string" ||
          !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
            product.imageUrl,
          )
        ) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }

        if (categories.get(categoryId)?.data()?.active !== true) {
          throw new Error("CATEGORY_UNAVAILABLE");
        }

        const price = Number(product.price);
        const oldPrice = Number(product.oldPrice ?? product.price);
        const stock = Number(product.stock);
        const reservedStock = Number(product.reservedStock ?? 0);

        if (
          !Number.isFinite(price) || price <= 0 ||
          !Number.isFinite(oldPrice) || oldPrice < price ||
          !Number.isSafeInteger(stock) || stock < 0 ||
          !Number.isSafeInteger(reservedStock) ||
          reservedStock < submitted.quantity ||
          reservedStock > stock
        ) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        if (
          !reservation.exists ||
          reservationData?.ownerHash !== ownerHash ||
          reservationData?.productDocumentId !== productDoc.id ||
          reservationData?.productId !== submitted.id ||
          reservationData?.status !== "active" ||
          !(reservationData.expiresAt instanceof Timestamp) ||
          reservationData.expiresAt.toMillis() <= now ||
          reservationData.quantity !== submitted.quantity
        ) {
          throw new Error("RESERVATION_INVALID");
        }

        const finalPrice = moneyAmount(price);
        orderItems.push({
          id: submitted.id,
          name: product.name,
          price: finalPrice,
          unit: typeof product.unit === "string" && product.unit
            ? product.unit
            : "পিস",
          quantity: submitted.quantity,
          subtotal: moneyAmount(finalPrice * submitted.quantity),
          productDocumentId: productDoc.id,
          reservationId: reservation.id,
        });
      }

      const total = moneyAmount(
        orderItems.reduce((sum, item) => sum + item.subtotal, 0),
      );

      transaction.create(orderRef, {
        ...(customerUid ? { customerUid } : {}),
        customer: { name, phone, address, note },
        whatsapp: {
          numberId: whatsappNumberId,
          label: whatsappLabel,
          number: whatsappNumber,
        },
        items: orderItems,
        total,
        currency: "BDT",
        paymentMethod: "cod",
        status: "pending_confirmation",
        stockDeducted: false,
        review: {
          tokenHash: reviewTokenHash,
          submitted: false,
          eligible: false,
          createdAt: FieldValue.serverTimestamp(),
        },
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(
          new Date(now + 30 * 24 * 60 * 60 * 1000),
        ),
      });

      for (const item of orderItems) {
        transaction.update(
          adminDb.collection("cartReservations").doc(item.reservationId),
          {
            status: "order_linked",
            orderId: orderRef.id,
            expiresAt: null,
            linkedAt: Timestamp.fromMillis(now),
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
      }
    });

    const total = moneyAmount(
      orderItems.reduce((sum, item) => sum + item.subtotal, 0),
    );

    const message = [
      "মুক্ত বাজার - নতুন অর্ডার",
      `অর্ডার নম্বর: ${orderRef.id}`,
      `নাম: ${name}`,
      `মোবাইল: ${phone}`,
      `ঠিকানা: ${address}`,
      "",
      "পণ্যের তালিকা:",
      ...orderItems.map(
        (item) =>
          `${item.name} (${item.id}) × ${item.quantity} ${item.unit} = ৳${formatMoney(item.subtotal)}`,
      ),
      "",
      `সর্বমোট: ৳${formatMoney(total)}`,
      "পেমেন্ট: ক্যাশ অন ডেলিভারি",
      ...(note ? [`নোট: ${note}`] : []),
    ].join("\n");

    const internationalNumber = whatsappNumber.startsWith("880")
      ? whatsappNumber
      : whatsappNumber.startsWith("0")
        ? `88${whatsappNumber}`
        : `880${whatsappNumber}`;

    const whatsappUrl =
      `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;

    return NextResponse.json(
      {
        success: true,
        orderId: orderRef.id,
        reviewToken,
        total,
        whatsappUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, { message: string; status: number }> = {
      PRODUCT_NOT_FOUND: {
        message: "কার্টে অজানা পণ্য রয়েছে।",
        status: 400,
      },
      PRODUCT_UNAVAILABLE: {
        message: "একটি পণ্য এখন অর্ডার করার উপযুক্ত নয়।",
        status: 409,
      },
      INSUFFICIENT_STOCK: {
        message: "একটি পণ্যের স্টক বা দাম পরিবর্তিত হয়েছে। কার্ট যাচাই করুন।",
        status: 409,
      },
      CATEGORY_UNAVAILABLE: {
        message: "একটি পণ্যের ক্যাটাগরি বর্তমানে চালু নেই।",
        status: 409,
      },
      RESERVATION_INVALID: {
        message: "কার্টের স্টক সংরক্ষণের সময় শেষ বা পরিমাণ মেলেনি। কার্ট আবার যাচাই করুন।",
        status: 409,
      },
    };

    const knownError = errors[code];
    if (knownError) return fail(knownError.message, knownError.status);

    console.error("Order creation failed:", error);
    return fail("অর্ডার জমা দেওয়া যায়নি। আবার চেষ্টা করুন।", 500);
  }
}
