
import { NextRequest, NextResponse } from "next/server";
import { requireRootAdmin } from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  isAdminPermission,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: AdminRole[] = [
  "product_manager",
  "order_manager",
  "stock_category_manager",
  "custom",
];

function validPermissions(value: unknown): value is AdminPermission[] {
  return (
    Array.isArray(value) &&
    value.every(isAdminPermission) &&
    !value.includes("admins.manage")
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  const root = await requireRootAdmin();

  if (!root) {
    return errorResponse("অনুমতি নেই।", 403);
  }

  try {
    const snapshot = await adminDb.collection("admins").get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        uid: doc.id,
        name: data.name ?? "",
        email: data.email ?? "",
        role: data.role ?? "custom",
        active: data.active === true,
        permissions: Array.isArray(data.permissions)
          ? data.permissions.filter(isAdminPermission)
          : [],
      };
    });

    return NextResponse.json({ success: true, users });
  } catch {
    return errorResponse("অ্যাডমিন তালিকা লোড করা যায়নি।", 500);
  }
}

export async function POST(request: NextRequest) {
  const root = await requireRootAdmin();

  if (!root) {
    return errorResponse("অনুমতি নেই।", 403);
  }

  let createdUid: string | null = null;

  try {
    const body = await request.json();
    const { name, email, password, role, permissions } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !VALID_ROLES.includes(role) ||
      !validPermissions(permissions)
    ) {
      return errorResponse(
        "তথ্য, রোল বা অনুমতি সঠিক নয়। পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।",
        400,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: name.trim(),
      disabled: false,
    });

    createdUid = user.uid;

    await adminDb.collection("admins").doc(user.uid).set({
      uid: user.uid,
      name: name.trim(),
      email: normalizedEmail,
      role,
      permissions,
      active: true,
      createdAt: new Date(),
      createdBy: root.uid,
      updatedAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "সাব-অ্যাডমিন তৈরি হয়েছে।",
        uid: user.uid,
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch {
        console.error("Failed to clean up newly created admin.");
      }
    }

    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

    return errorResponse(
      code === "auth/email-already-exists"
        ? "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।"
        : "সাব-অ্যাডমিন তৈরি করা যায়নি।",
      400,
    );
  }
}

export async function PATCH(request: NextRequest) {
  const root = await requireRootAdmin();

  if (!root) {
    return errorResponse("অনুমতি নেই।", 403);
  }

  let uid = "";
  let previousDisabled: boolean | null = null;
  let authStateChanged = false;

  try {
    const body = await request.json();
    const { active, role, permissions } = body;

    uid = typeof body.uid === "string" ? body.uid.trim() : "";

    if (!uid || uid === root.uid) {
      return errorResponse("অ্যাকাউন্ট আইডি সঠিক নয়।", 400);
    }

    if (
      active === undefined &&
      role === undefined &&
      permissions === undefined
    ) {
      return errorResponse("পরিবর্তনের তথ্য দেওয়া হয়নি।", 400);
    }

    if (active !== undefined && typeof active !== "boolean") {
      return errorResponse("সক্রিয় অবস্থার মান সঠিক নয়।", 400);
    }

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return errorResponse("রোল সঠিক নয়।", 400);
    }

    if (permissions !== undefined && !validPermissions(permissions)) {
      return errorResponse("অনুমতির তালিকা সঠিক নয়।", 400);
    }

    const ref = adminDb.collection("admins").doc(uid);
    const doc = await ref.get();

    if (!doc.exists) {
      return errorResponse("সাব-অ্যাডমিন পাওয়া যায়নি।", 404);
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: root.uid,
    };

    if (active !== undefined) {
      const authUser = await adminAuth.getUser(uid);
      previousDisabled = authUser.disabled ?? false;

      await adminAuth.updateUser(uid, { disabled: !active });
      authStateChanged = true;

      if (!active) {
        await adminAuth.revokeRefreshTokens(uid);
      }

      updates.active = active;
    }

    if (role !== undefined) {
      updates.role = role;
    }

    if (permissions !== undefined) {
      updates.permissions = permissions;
    }

    await ref.update(updates);

    return NextResponse.json({
      success: true,
      message: "সাব-অ্যাডমিন আপডেট হয়েছে।",
    });
  } catch {
    if (authStateChanged && uid && previousDisabled !== null) {
      try {
        await adminAuth.updateUser(uid, {
          disabled: previousDisabled,
        });
      } catch {
        console.error("Failed to restore admin Authentication state.");
      }
    }

    return errorResponse(
      "সাব-অ্যাডমিন আপডেট করা যায়নি। অ্যাকাউন্টের অবস্থা যাচাই করুন।",
      500,
    );
  }
}
