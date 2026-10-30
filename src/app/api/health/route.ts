import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  console.log("[HEALTH] Firestore read starting");

  try {
    const snapshot = await adminDb
      .collection("orders")
      .limit(1)
      .get();

    console.log("[HEALTH] Firestore read completed");

    return NextResponse.json({
      success: true,
      documentCount: snapshot.size,
      message: "Firestore read successful",
    });
  } catch (error: unknown) {
    const e = error as {
      name?: string;
      message?: string;
      code?: string | number;
      stack?: string;
    };

    console.error("[HEALTH] FIRESTORE ERROR NAME:", e.name);
    console.error("[HEALTH] FIRESTORE ERROR CODE:", e.code);
    console.error("[HEALTH] FIRESTORE ERROR MESSAGE:", e.message);
    console.error("[HEALTH] FIRESTORE ERROR STACK:", e.stack);

    return NextResponse.json(
      {
        success: false,
        errorName: e.name ?? "UnknownError",
        errorCode: e.code ?? null,
        errorMessage: e.message ?? "Unknown Firestore error",
      },
      { status: 500 },
    );
  }
}
