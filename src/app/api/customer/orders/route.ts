import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "mukt_bazar_customer_session";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function timestamp(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE)?.value;
    if (!sessionCookie) return fail("Customer লগইন করা নেই।", 401);

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.role) return fail("Customer সেশন অনুমোদিত নয়।", 403);

    const [user, adminDoc, profileSnap] = await Promise.all([
      adminAuth.getUser(decoded.uid),
      adminDb.collection("admins").doc(decoded.uid).get(),
      adminDb.collection("customers").doc(decoded.uid).get(),
    ]);

    if (user.disabled || !user.email || adminDoc.exists || !profileSnap.exists) {
      return fail("Customer প্রোফাইল পাওয়া যায়নি।", 403);
    }

    const snapshot = await adminDb
      .collection("orders")
      .where("customerUid", "==", decoded.uid)
      .limit(100)
      .get();

    const orders = snapshot.docs
      .map((doc) => {
        const order = doc.data();

        return {
          id: doc.id,
          name: typeof order.customer?.name === "string"
            ? order.customer.name
            : "",
          status: typeof order.status === "string"
            ? order.status
            : "pending_confirmation",
          statusMessage: typeof order.statusMessage === "string"
            ? order.statusMessage
            : "",
          total: typeof order.total === "number" ? order.total : 0,
          currency: "BDT",
          createdAt: timestamp(order.createdAt),
          items: Array.isArray(order.items)
            ? order.items.map((item: Record<string, unknown>) => ({
                id: typeof item.id === "string" ? item.id : "",
                name: typeof item.name === "string" ? item.name : "",
                quantity: Number.isInteger(item.quantity)
                  ? item.quantity
                  : 0,
                unit: typeof item.unit === "string" ? item.unit : "পিস",
                subtotal: typeof item.subtotal === "number"
                  ? item.subtotal
                  : 0,
              }))
            : [],
          reviewSubmitted: order.review?.submitted === true,
        };
      })
      .sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );

    return NextResponse.json(
      { success: true, orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return fail("অর্ডারের তথ্য পাওয়া যায়নি। আবার লগইন করুন।", 401);
  }
}
