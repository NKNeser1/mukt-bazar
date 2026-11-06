import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "mukt_bazar_customer_session";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function getCustomer(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE)?.value;
  if (!cookie) throw new Error("UNAUTHORIZED");

  const decoded = await adminAuth.verifySessionCookie(cookie, true);
  if (decoded.role) throw new Error("FORBIDDEN");

  const [user, adminDoc, profileSnap] = await Promise.all([
    adminAuth.getUser(decoded.uid),
    adminDb.collection("admins").doc(decoded.uid).get(),
    adminDb.collection("customers").doc(decoded.uid).get(),
  ]);

  if (user.disabled || !user.email || adminDoc.exists || !profileSnap.exists) {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: decoded.uid,
    profileRef: adminDb.collection("customers").doc(decoded.uid),
    profile: profileSnap.data() || {},
  };
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return fail("Customer লগইন করুন।", 401);
    }
    if (error.message === "FORBIDDEN") {
      return fail("Customer প্রোফাইল অনুমোদিত নয়।", 403);
    }
    console.error("[Customer Photo Error]", error.message);
  }
  return fail("ছবির কাজ সম্পন্ন হয়নি। আবার চেষ্টা করুন।", 500);
}

function isOwnedPhoto(publicId: unknown, uid: string): publicId is string {
  return (
    typeof publicId === "string" &&
    publicId.startsWith(`mukt-bazar/customer-profiles/${uid}/`)
  );
}

async function destroyPhoto(publicId: string) {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary photo deletion failed");
  }
}

export async function POST(request: NextRequest) {
  try {
    const customer = await getCustomer(request);

    if (!process.env.CLOUDINARY_URL) {
      return fail("Cloudinary সেটিংস পাওয়া যায়নি।", 500);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("একটি ছবি নির্বাচন করুন।", 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return fail("JPG, PNG, WebP অথবা AVIF ছবি দিন।", 400);
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return fail("ছবির আকার ৫ MB-এর মধ্যে হতে হবে।", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const folder = `mukt-bazar/customer-profiles/${customer.uid}`;

    const uploaded = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Cloudinary upload failed"));
            return;
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        },
      ).end(bytes);
    });

    const oldPublicId = customer.profile.photoPublicId;

    await customer.profileRef.update({
      photoURL: uploaded.secure_url,
      photoPublicId: uploaded.public_id,
      updatedAt: new Date(),
    });

    if (
      isOwnedPhoto(oldPublicId, customer.uid) &&
      oldPublicId !== uploaded.public_id
    ) {
      try {
        await destroyPhoto(oldPublicId);
      } catch (error) {
        console.error("[Old Customer Photo Cleanup Error]", error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "প্রোফাইল ছবি আপডেট হয়েছে।",
        photoURL: uploaded.secure_url,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const customer = await getCustomer(request);

    if (!process.env.CLOUDINARY_URL) {
      return fail("Cloudinary সেটিংস পাওয়া যায়নি।", 500);
    }

    const publicId = customer.profile.photoPublicId;

    if (isOwnedPhoto(publicId, customer.uid)) {
      await destroyPhoto(publicId);
    }

    await customer.profileRef.update({
      photoURL: FieldValue.delete(),
      photoPublicId: FieldValue.delete(),
      updatedAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "প্রোফাইল ছবি মুছে ফেলা হয়েছে।",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
