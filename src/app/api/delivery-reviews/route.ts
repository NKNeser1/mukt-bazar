import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("reviews")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const reviews = snapshot.docs.map((doc) => {
      const data = doc.data();
      const timestamp = data.createdAt;

      return {
        id: doc.id,
        deliveryRating:
          Number.isInteger(data.deliveryRating) &&
          data.deliveryRating >= 1 &&
          data.deliveryRating <= 5
            ? data.deliveryRating
            : 0,
        comment:
          typeof data.comment === "string"
            ? data.comment.slice(0, 1000)
            : "",
        createdAt:
          timestamp && typeof timestamp.toDate === "function"
            ? timestamp.toDate().toISOString()
            : null,
      };
    });

    return NextResponse.json(
      { success: true, reviews },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Delivery reviews fetch failed:", error);
    return NextResponse.json(
      { success: false, message: "ডেলিভারি রিভিউ লোড করা যায়নি।" },
      { status: 500 },
    );
  }
}
