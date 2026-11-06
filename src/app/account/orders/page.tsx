"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Order = {
  id: string;
  status: string;
  statusMessage: string;
  total: number;
  createdAt: string | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    subtotal: number;
  }[];
  reviewSubmitted: boolean;
};

const labels: Record<string, string> = {
  pending_confirmation: "অর্ডার অপেক্ষমাণ",
  confirmed: "অর্ডার নিশ্চিত",
  packing: "প্যাকিং চলছে",
  shipped: "ডেলিভারির পথে",
  delivered: "ডেলিভারি সম্পন্ন",
  cancelled: "অর্ডার বাতিল",
};

function dateLabel(value: string | null) {
  if (!value) return "তারিখ পাওয়া যায়নি";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "তারিখ পাওয়া যায়নি"
    : date.toLocaleString("bn-BD", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch("/api/customer/orders", {
          cache: "no-store",
        });
        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
          setLoggedOut(true);
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(result.message || "অর্ডার লোড করা যায়নি।");
        }

        setOrders(Array.isArray(result.orders) ? result.orders : []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "অর্ডারের তথ্য পাওয়া যায়নি।",
        );
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-semibold text-green-700"
        >
          ← মুক্ত বাজারে ফিরে যান
        </Link>

        <header className="mb-7 mt-5">
          <h1 className="text-2xl font-bold">আমার অর্ডার</h1>
          <p className="mt-2 text-sm text-gray-600">
            আপনার অ্যাকাউন্টে করা অর্ডারগুলোর তালিকা।
          </p>
        </header>

        {loading && (
          <p className="rounded-xl bg-white p-5 text-center">
            অর্ডার লোড হচ্ছে...
          </p>
        )}

        {loggedOut && (
          <section className="rounded-2xl border bg-white p-6 text-center">
            <p className="font-semibold">
              অর্ডার দেখতে Customer অ্যাকাউন্টে লগইন করুন।
            </p>
            <Link
              href="/account/login"
              className="mt-4 inline-block rounded-xl bg-green-700 px-6 py-3 font-semibold text-white"
            >
              লগইন করুন
            </Link>
            <p className="mt-4 text-sm text-gray-600">
              অতিথি হিসেবে করা অর্ডার দেখতে{" "}
              <Link
                href="/track-order"
                className="font-semibold text-green-700"
              >
                অর্ডার ট্র্যাক
              </Link>{" "}
              ব্যবহার করুন।
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {!loading && !loggedOut && !error && orders.length === 0 && (
          <section className="rounded-2xl border bg-white p-7 text-center">
            <p className="text-3xl">📦</p>
            <h2 className="mt-3 font-bold">এখনো কোনো অর্ডার নেই</h2>
            <p className="mt-2 text-sm text-gray-600">
              পছন্দের পণ্য কিনে আপনার প্রথম অর্ডারটি করুন।
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-green-700 px-6 py-3 font-semibold text-white"
            >
              কেনাকাটা শুরু করুন
            </Link>
          </section>
        )}

        <div className="space-y-4">
          {orders.map((order) => {
            const cancelled = order.status === "cancelled";
            const delivered = order.status === "delivered";

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">অর্ডার নম্বর</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold">
                      {order.id}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-2 text-xs font-bold ${
                      cancelled
                        ? "bg-red-100 text-red-700"
                        : delivered
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {labels[order.status] || order.status}
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  {dateLabel(order.createdAt)}
                </p>

                <div className="my-4 space-y-2 border-y border-gray-100 py-3">
                  {order.items.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>{item.name}</span>
                      <span className="shrink-0 text-gray-600">
                        × {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600">সর্বমোট</span>
                  <strong>
                    ৳{order.total.toLocaleString("bn-BD")}
                  </strong>
                </div>

                {order.statusMessage && (
                  <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
                    {order.statusMessage}
                  </p>
                )}

                <Link
                  href={`/track-order`}
                  className="mt-4 inline-block text-sm font-semibold text-green-700"
                >
                  অর্ডার ট্র্যাক করুন →
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
