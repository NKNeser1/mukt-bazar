
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminPermission("cloudinary.upload");

    if (!process.env.CLOUDINARY_URL) {
      return errorResponse("Cloudinary সেটিংস পাওয়া যায়নি।", 500);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse("একটি ছবি নির্বাচন করুন।", 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse("JPG, PNG, WebP অথবা AVIF ছবি দিন।", 400);
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return errorResponse("ছবির আকার ৫ MB-এর মধ্যে হতে হবে।", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const result = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "mukt-bazar/products",
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        },
        (error, result) => {
          if (error || !result) {
            console.error("[Cloudinary SDK Error]", error);
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

    return NextResponse.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return errorResponse("লগইন করুন।", 401);
      }

      if (error.message === "FORBIDDEN") {
        return errorResponse("ছবি আপলোডের অনুমতি নেই।", 403);
      }

      console.error("[Cloudinary Upload Error]", error.message);
    }

    return errorResponse("ছবি আপলোড হয়নি। সার্ভার লগ পরীক্ষা করুন।", 500);
  }
}
