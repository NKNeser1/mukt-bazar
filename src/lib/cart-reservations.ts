import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

export const CART_SESSION_COOKIE = "mukt_bazar_cart_session";
export const CART_RESERVATION_MINUTES = 10;
export const CART_RESERVATION_MS = CART_RESERVATION_MINUTES * 60 * 1000;

export function createCartSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidCartSessionToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

export function hashCartSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCartReservationId(
  ownerHash: string,
  productDocumentId: string,
): string {
  return createHash("sha256")
    .update(`${ownerHash}:${productDocumentId}`)
    .digest("hex");
}

export function getCartReservationExpiry(now = Date.now()): Timestamp {
  return Timestamp.fromMillis(now + CART_RESERVATION_MS);
}
