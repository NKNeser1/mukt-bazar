import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  CART_SESSION_COOKIE,
  hashCartSessionToken,
  isValidCartSessionToken,
} from "@/lib/cart-reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const [categorySnapshot, productSnapshot, bannerSnapshot, reservationSnapshot] =
      await Promise.all([
        adminDb.collection("categories").get(),
        adminDb.collection("products").get(),
        adminDb.collection("specialBanners")
          .where("active", "==", true).get(),
        adminDb.collection("cartReservations").get(),
      ]);

    const now = Date.now();
    const includeCart = request.nextUrl.searchParams.get("includeCart") === "1";
    const sessionToken = request.cookies.get(CART_SESSION_COOKIE)?.value;
    const ownerHash = includeCart && isValidCartSessionToken(sessionToken)
      ? hashCartSessionToken(sessionToken)
      : null;
    const reservedByProduct = new Map<string, number>();
    const ownReservedByProduct = new Map<string, number>();

    for (const doc of reservationSnapshot.docs) {
      const reservation = doc.data();
      const status = reservation.status;
      const isActive = status === "active" &&
        reservation.expiresAt instanceof Timestamp &&
        reservation.expiresAt.toMillis() > now;
      const isOrderLinked = status === "order_linked";
      const quantity = Number(reservation.quantity ?? 0);
      const productDocumentId = reservation.productDocumentId;

      if (
        (isActive || isOrderLinked) &&
        typeof productDocumentId === "string" &&
        Number.isSafeInteger(quantity) &&
        quantity > 0
      ) {
        reservedByProduct.set(
          productDocumentId,
          (reservedByProduct.get(productDocumentId) ?? 0) + quantity,
        );

        if (
          isActive &&
          ownerHash &&
          reservation.ownerHash === ownerHash
        ) {
          ownReservedByProduct.set(
            productDocumentId,
            (ownReservedByProduct.get(productDocumentId) ?? 0) + quantity,
          );
        }
      }
    }

    const categories = categorySnapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          bn: typeof data.name === "string" ? data.name : "",
          en: typeof data.english === "string" ? data.english : "",
          icon: typeof data.icon === "string" ? data.icon : "🛍️",
          color: typeof data.color === "string" ? data.color : "green",
          description:
            typeof data.description === "string" ? data.description : "",
          order: Number(data.order ?? 0),
          active: data.active === true,
        };
      })
      .filter((category) => category.active && category.bn && category.en)
      .sort((a, b) => a.order - b.order);

    const activeCategoryIds = new Set(
      categories.map((category) => category.id),
    );

    const products = productSnapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: typeof data.productId === "string" && data.productId
            ? data.productId
            : doc.id,
          name: typeof data.name === "string" ? data.name : "",
          english: typeof data.english === "string" ? data.english : "",
          description:
            typeof data.description === "string" ? data.description : "",
          englishDescription:
            typeof data.englishDescription === "string"
              ? data.englishDescription
              : "",
          category: typeof data.category === "string" ? data.category : "",
          price: Number(data.price),
          oldPrice: Number(data.oldPrice ?? data.price),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
          stock: Math.max(
            0,
            Number(data.stock ?? 0) - (reservedByProduct.get(doc.id) ?? 0),
          ),
          ownReservedQuantity: ownReservedByProduct.get(doc.id) ?? 0,
          unit: typeof data.unit === "string" && data.unit ? data.unit : "পিস",
          special: data.special === true,
          published: data.published === true,
          ratingSummary: {
            count: Math.max(0, Number(data.ratingSummary?.count ?? 0)),
            total: Math.max(0, Number(data.ratingSummary?.total ?? 0)),
            distribution: {
              1: Math.max(0, Number(data.ratingSummary?.distribution?.[1] ?? 0)),
              2: Math.max(0, Number(data.ratingSummary?.distribution?.[2] ?? 0)),
              3: Math.max(0, Number(data.ratingSummary?.distribution?.[3] ?? 0)),
              4: Math.max(0, Number(data.ratingSummary?.distribution?.[4] ?? 0)),
              5: Math.max(0, Number(data.ratingSummary?.distribution?.[5] ?? 0)),
            },
          },
        };
      })
      .filter(
        (product) =>
          product.published &&
          (product.stock > 0 ||
            (includeCart && product.ownReservedQuantity > 0)) &&
          product.name &&
          product.english &&
          Number.isFinite(product.price) &&
          product.price > 0 &&
          Number.isFinite(product.oldPrice) &&
          product.oldPrice >= product.price &&
          activeCategoryIds.has(product.category) &&
          /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
            product.imageUrl,
          ),
      );

    const bannerCategoryIds = new Set(categories.map((item) => item.id));
    const specialBanners: Record<string, { imageUrl: string; name: string }> = {};

    for (const doc of bannerSnapshot.docs) {
      const data = doc.data();
      const category = typeof data.category === "string"
        ? data.category : doc.id;
      const imageUrl = typeof data.imageUrl === "string"
        ? data.imageUrl : "";

      if (
        bannerCategoryIds.has(category) &&
        data.active === true &&
        /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(imageUrl)
      ) {
        specialBanners[category] = {
          imageUrl,
          name: typeof data.name === "string" ? data.name : "",
        };
      }
    }

    return NextResponse.json(
      { success: true, categories, products, specialBanners },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "দোকানের তথ্য লোড করা যায়নি।" },
      { status: 500 },
    );
  }
}
