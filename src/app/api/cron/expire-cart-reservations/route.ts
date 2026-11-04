import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reservations = () => adminDb.collection("cartReservations");
const products = () => adminDb.collection("products");
const MAX_PER_RUN = 200;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, message: "অনুমতি নেই।" },
      { status: 401 },
    );
  }

  try {
    const now = Date.now();
    const snapshot = await reservations()
      .where("status", "==", "active")
      .limit(MAX_PER_RUN)
      .get();

    let expired = 0;
    let skipped = 0;

    for (const candidate of snapshot.docs) {
      const data = candidate.data();

      if (
        !(data.expiresAt instanceof Timestamp) ||
        data.expiresAt.toMillis() > now
      ) {
        continue;
      }

      const result = await adminDb.runTransaction(async (transaction) => {
        const reservationSnapshot = await transaction.get(candidate.ref);

        if (!reservationSnapshot.exists) return "skipped";

        const reservation = reservationSnapshot.data()!;

        if (
          reservation.status !== "active" ||
          !(reservation.expiresAt instanceof Timestamp) ||
          reservation.expiresAt.toMillis() > Date.now()
        ) {
          return "skipped";
        }

        const quantity = Number(reservation.quantity ?? 0);
        const productDocumentId = reservation.productDocumentId;

        if (
          !Number.isSafeInteger(quantity) ||
          quantity <= 0 ||
          typeof productDocumentId !== "string" ||
          !productDocumentId
        ) {
          return "skipped";
        }

        const productRef = products().doc(productDocumentId);
        const productSnapshot = await transaction.get(productRef);

        if (!productSnapshot.exists) return "skipped";

        const product = productSnapshot.data()!;
        const reservedStock = Number(product.reservedStock ?? 0);

        if (
          !Number.isSafeInteger(reservedStock) ||
          reservedStock < quantity
        ) {
          return "skipped";
        }

        transaction.update(productRef, {
          reservedStock: reservedStock - quantity,
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.update(candidate.ref, {
          status: "expired",
          releasedAt: Timestamp.fromMillis(Date.now()),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return "expired";
      });

      if (result === "expired") expired += 1;
      else skipped += 1;
    }

    return NextResponse.json({
      success: true,
      checked: snapshot.size,
      expired,
      skipped,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "রিজার্ভেশন পরিষ্কার করা যায়নি।" },
      { status: 500 },
    );
  }
}
