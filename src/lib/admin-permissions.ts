export const ADMIN_PERMISSIONS = [
  "products.read",
  "products.create",
  "products.update",
  "products.delete",
  "orders.read",
  "orders.update",
  "stock.read",
  "stock.update",
  "categories.read",
  "categories.update",
  "cloudinary.upload",
  "banners.manage",
  "site.settings.manage",
  "admins.manage",
] as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[number];

export type AdminRole =
  | "root_admin"
  | "product_manager"
  | "order_manager"
  | "stock_category_manager"
  | "custom";

export const ROLE_DEFAULT_PERMISSIONS: Record<
  Exclude<AdminRole, "root_admin" | "custom">,
  readonly AdminPermission[]
> = {
  product_manager: [
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "cloudinary.upload",
  ],

  order_manager: [
    "orders.read",
    "orders.update",
  ],

  stock_category_manager: [
    "stock.read",
    "stock.update",
    "categories.read",
    "categories.update",
  ],
};

export function isAdminPermission(
  value: unknown,
): value is AdminPermission {
  return (
    typeof value === "string" &&
    (ADMIN_PERMISSIONS as readonly string[]).includes(value)
  );
}

export function getRoleDefaultPermissions(
  role: AdminRole,
): readonly AdminPermission[] {
  if (role === "root_admin" || role === "custom") {
    return [];
  }

  return ROLE_DEFAULT_PERMISSIONS[role];
}