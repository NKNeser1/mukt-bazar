import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [categorySnapshot, productSnapshot, bannerSnapshot] =
      await Promise.all([
        adminDb.collection("categories").get(),
        adminDb.collection("products").get(),
        adminDb.collection("specialBanners")
          .where("active", "==", true).get(),
      ]);

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
          stock: Number(data.stock ?? 0),
          unit: typeof data.unit === "string" && data.unit ? data.unit : "পিস",
          special: data.special === true,
          published: data.published === true,
        };
      })
      .filter(
        (product) =>
          product.published &&
          product.stock > 0 &&
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
