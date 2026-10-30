
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const orderId =
      typeof body?.orderId === "string"
        ? body.orderId.trim()
        : "";

    const phone =
      typeof body?.phone === "string"
        ? body.phone.replace(/[\s()-]/g, "")
        : "";

    if (
      !orderId ||
      orderId.length > 150 ||
      !phone ||
      phone.length < 7 ||
      phone.length > 20 ||
      !/^[0-9+]+$/.test(phone)
    ) {
      return fail("অর্ডার নম্বর ও সঠিক ফোন নম্বর দিন।", 400);
    }

    const snapshot = await adminDb
      .collection("orders")
      .doc(orderId)
      .get();

    if (!snapshot.exists) {
      return fail(
        "অর্ডার পাওয়া যায়নি। অর্ডার নম্বর যাচাই করুন।",
        404,
      );
    }

    const order = snapshot.data()!;
    const savedPhone =
      typeof order.customer?.phone === "string"
        ? order.customer.phone.replace(/[\s()-]/g, "")
        : "";

    if (savedPhone !== phone) {
      return fail(
        "ফোন নম্বর ও অর্ডার নম্বর মিলছে না।",
        404,
      );
    }

    const timestamp = (value: unknown): string | null => {
      if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof value.toDate === "function"
      ) {
        return value.toDate().toISOString();
      }

      return typeof value === "string" ? value : null;
    };

    const history = Array.isArray(order.statusHistory)
      ? order.statusHistory.map((entry: Record<string, unknown>) => ({
          status:
            typeof entry.status === "string" ? entry.status : "",
          message:
            typeof entry.message === "string" ? entry.message : "",
          updatedAt: timestamp(entry.updatedAt),
        }))
      : [];

    return NextResponse.json({
      success: true,
      order: {
        id: snapshot.id,
        status:
          typeof order.status === "string"
            ? order.status
            : "pending_confirmation",
        statusMessage:
          typeof order.statusMessage === "string"
            ? order.statusMessage
            : "",
        createdAt: timestamp(order.createdAt),
        updatedAt: timestamp(order.updatedAt),
        items: Array.isArray(order.items)
          ? order.items.map((item: Record<string, unknown>) => ({
              name: typeof item.name === "string" ? item.name : "",
              quantity:
                Number.isInteger(item.quantity) ? item.quantity : 0,
            }))
          : [],
        total: typeof order.total === "number" ? order.total : 0,
        currency: "BDT",
        statusHistory: history,
      },
    });
  } catch {
    return fail("অর্ডারের তথ্য পাওয়া যায়নি। আবার চেষ্টা করুন।", 500);
  }
}
