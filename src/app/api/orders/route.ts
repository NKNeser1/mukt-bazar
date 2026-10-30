
import { NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



type SubmittedItem = {
  id: string;
  quantity: number;
};

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
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("অর্ডারের তথ্য সঠিক নয়।", 400);
    }

    const data = body as Record<string, unknown>;
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
      !name ||
      name.length > 100 ||
      !phone ||
      phone.length > 20 ||
      !/^[0-9+\s()-]{7,20}$/.test(phone) ||
      !address ||
      address.length > 500 ||
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

    if (
      !Array.isArray(submittedItems) ||
      submittedItems.length === 0 ||
      submittedItems.length > 50
    ) {
      return fail("কার্টে বৈধ পণ্য নেই।", 400);
    }

    const seen = new Set<string>();
    const orderItems: {
      id: string;
      name: string;
      price: number;
      unit: string;
      quantity: number;
      subtotal: number;
    }[] = [];

    for (const rawItem of submittedItems as SubmittedItem[]) {
      if (
        !rawItem ||
        typeof rawItem.id !== "string" ||
        !Number.isInteger(rawItem.quantity) ||
        rawItem.quantity < 1 ||
        rawItem.quantity > 99 ||
        seen.has(rawItem.id)
      ) {
        return fail("কার্টের পণ্যের তথ্য সঠিক নয়।", 400);
      }

      seen.add(rawItem.id);

      const snapshot = await adminDb
        .collection("products")
        .where("productId", "==", rawItem.id)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return fail("কার্টে অজানা পণ্য রয়েছে।", 400);
      }

      const doc = snapshot.docs[0];
      const product = doc.data();
      const categoryId =
        typeof product.category === "string" ? product.category : "";

      if (
        product.published !== true ||
        !categoryId ||
        !product.name ||
        typeof product.name !== "string" ||
        typeof product.english !== "string" ||
        !product.english ||
        typeof product.imageUrl !== "string" ||
        !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
          product.imageUrl,
        )
      ) {
        return fail("একটি পণ্য এখন অর্ডার করার উপযুক্ত নয়।", 400);
      }

      const price = Number(product.price);
      const oldPrice = Number(product.oldPrice ?? product.price);
      const stock = Number(product.stock);

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(oldPrice) ||
        oldPrice < price ||
        !Number.isInteger(stock) ||
        stock < rawItem.quantity
      ) {
        return fail("একটি পণ্যের স্টক বা দাম পরিবর্তিত হয়েছে। কার্ট যাচাই করুন।", 400);
      }

      const category = await adminDb
        .collection("categories")
        .doc(categoryId)
        .get();

      if (
        !category.exists ||
        category.data()?.active !== true
      ) {
        return fail("একটি পণ্যের ক্যাটাগরি বর্তমানে চালু নেই।", 400);
      }

      const finalPrice = moneyAmount(price);

      orderItems.push({
        id: rawItem.id,
        name: product.name,
        price: finalPrice,
        unit: typeof product.unit === "string" && product.unit ? product.unit : "পিস",
        quantity: rawItem.quantity,
        subtotal: moneyAmount(finalPrice * rawItem.quantity),
      });
    }

    const total = moneyAmount(
      orderItems.reduce((sum, item) => sum + item.subtotal, 0),
    );

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

    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    );

    await orderRef.set({
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
      review: {
        tokenHash: reviewTokenHash,
        submitted: false,
        eligible: false,
        createdAt: FieldValue.serverTimestamp(),
      },
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

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
    console.error("Order creation failed:", error);
    return fail("অর্ডার জমা দেওয়া যায়নি। আবার চেষ্টা করুন।", 500);
  }
}
