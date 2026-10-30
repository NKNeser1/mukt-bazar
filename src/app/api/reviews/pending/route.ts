import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validToken(order: FirebaseFirestore.DocumentData, token: string) {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret || secret.length < 32 || !/^[a-f0-9]{64}$/.test(token)) return false;
  const stored = order.review?.tokenHash;
  if (typeof stored !== "string" || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return timingSafeEqual(
    createHash("sha256").update(token).digest(),
    Buffer.from(stored, "hex")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const accesses = Array.isArray(body?.accesses) ? body.accesses.slice(0, 50) : [];

    for (const access of accesses) {
      const orderId = typeof access?.orderId === "string" ? access.orderId.trim() : "";
      const token = typeof access?.token === "string" ? access.token : "";
      if (!orderId || orderId.length > 150 || !token) continue;

      const snapshot = await adminDb.collection("orders").doc(orderId).get();
      if (!snapshot.exists) continue;

      const order = snapshot.data()!;
      if (!validToken(order, token)) continue;
      if (order.status !== "delivered" || order.review?.eligible !== true) continue;
      if (order.review?.submitted === true) continue;

      const items = Array.isArray(order.items) ? order.items : [];
      return NextResponse.json({
        success: true,
        pending: {
          orderId,
          token,
          items: items.map((item: Record<string, unknown>) => ({
            name: typeof item.name === "string" ? item.name : "",
          })),
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { success: true, pending: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Pending review check failed:", error);
    return NextResponse.json(
      { success: false, message: "রিভিউ তথ্য যাচাই করা যায়নি।" },
      { status: 500 }
    );
  }
}
