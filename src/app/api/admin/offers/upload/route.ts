import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminPermission("banners.manage");

    if (!process.env.CLOUDINARY_URL) {
      return fail("Cloudinary সেটিংস পাওয়া যায়নি।", 500);
    }

    const form = await request.formData();
    const file = form.get("file");
    const type = form.get("type");

    if (type !== "banner" && type !== "brand") {
      return fail("ব্যানার অথবা ব্র্যান্ড নির্বাচন করুন।", 400);
    }
    if (!(file instanceof File)) {
      return fail("একটি ছবি নির্বাচন করুন।", 400);
    }
    if (!TYPES.includes(file.type)) {
      return fail("JPG, PNG, WebP অথবা AVIF ছবি দিন।", 400);
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return fail("ছবির আকার ৫ MB-এর মধ্যে হতে হবে।", 400);
    }

    const folder = type === "banner" ? "banners" : "brands";
    const bytes = Buffer.from(await file.arrayBuffer());

    const result = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `mukt-bazar/${folder}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error || new Error("Upload failed"));
            return;
          }
          resolve({
            secure_url: uploaded.secure_url,
            public_id: uploaded.public_id,
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
    const code = error instanceof Error ? error.message : "";
    if (code === "UNAUTHORIZED") return fail("আবার লগইন করুন।", 401);
    if (code === "FORBIDDEN") return fail("ছবি আপলোডের অনুমতি নেই।", 403);

    console.error("[Offers Image Upload]", error);
    return fail("ছবি আপলোড করা যায়নি।", 500);
  }
}
