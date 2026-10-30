
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type StatusEntry = {
  status: string;
  message: string;
  updatedAt: string | null;
};

type TrackedOrder = {
  id: string;
  status: string;
  statusMessage: string;
  createdAt: string | null;
  updatedAt: string | null;
  total: number;
  currency: string;
  items: { name: string; quantity: number }[];
  statusHistory: StatusEntry[];
};

const statusLabels: Record<string, string> = {
  pending_confirmation: "অর্ডার অপেক্ষমাণ",
  confirmed: "অর্ডার নিশ্চিত",
  packing: "প্যাকিং চলছে",
  shipped: "ডেলিভারির পথে",
  delivered: "ডেলিভারি সম্পন্ন",
  cancelled: "অর্ডার বাতিল",
};

const steps = [
  "pending_confirmation",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
];

function formatDate(value: string | null) {
  if (!value) return "তারিখ পাওয়া যায়নি";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "তারিখ পাওয়া যায়নি";

  return date.toLocaleString("bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), phone: phone.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "অর্ডার খুঁজে পাওয়া যায়নি।");
      }

      setOrder(data.order);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setLoading(false);
    }
  }

  const cancelled = order?.status === "cancelled";
  const delivered = order?.status === "delivered";
  const currentStep = order ? steps.indexOf(order.status) : -1;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold text-green-700">
          ← মুক্ত বাজারে ফিরে যান
        </Link>

        <header className="mb-8 mt-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-3xl">
            📦
          </div>
          <h1 className="text-3xl font-bold">অর্ডার ট্র্যাক করুন</h1>
          <p className="mt-2 text-sm text-gray-600">
            আপনার অর্ডারের বর্তমান অবস্থা ও অ্যাডমিনের আপডেট দেখুন।
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label htmlFor="orderId" className="mb-2 block text-sm font-semibold">
              অর্ডার নম্বর
            </label>
            <input
              id="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              required
              maxLength={150}
              autoComplete="off"
              placeholder="আপনার অর্ডার নম্বর লিখুন"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-semibold">
              অর্ডারের সময় দেওয়া ফোন নম্বর
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              maxLength={20}
              autoComplete="tel"
              placeholder="যেমন: 01XXXXXXXXX"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? "খোঁজা হচ্ছে..." : "অর্ডার খুঁজুন"}
          </button>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>

        {order && (
          <section className="mt-6 space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">অর্ডার নম্বর</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">
                {order.id}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-2 text-sm font-bold ${
                    cancelled
                      ? "bg-red-100 text-red-700"
                      : delivered
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {statusLabels[order.status] || order.status}
                </span>
                <span className="font-bold">
                  ৳{order.total.toLocaleString("bn-BD")}
                </span>
              </div>

              {order.statusMessage && (
                <div
                  className={`mt-4 rounded-xl p-4 ${
                    cancelled ? "bg-red-50" : "bg-green-50"
                  }`}
                >
                  <h2 className="font-bold">
                    {cancelled ? "অর্ডার বাতিলের কারণ" : "অ্যাডমিনের বার্তা"}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {order.statusMessage}
                  </p>
                </div>
              )}

              {!cancelled && (
                <div className="mt-6">
                  <h2 className="mb-4 font-bold">অর্ডারের অগ্রগতি</h2>
                  <ol className="space-y-4">
                    {steps.map((step, index) => {
                      const active = currentStep >= index;

                      return (
                        <li key={step} className="flex items-start gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              active
                                ? "bg-green-700 text-white"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {active ? "✓" : index + 1}
                          </span>
                          <div className="pt-1">
                            <p className={active ? "font-semibold text-green-800" : "text-gray-500"}>
                              {statusLabels[step]}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <p className="mt-5 text-xs text-gray-500">
                অর্ডার তৈরি: {formatDate(order.createdAt)}
              </p>
              {order.updatedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  সর্বশেষ আপডেট: {formatDate(order.updatedAt)}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">পণ্যের তালিকা</h2>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0"
                  >
                    <span className="text-sm">{item.name}</span>
                    <span className="shrink-0 text-sm font-semibold">
                      × {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">স্ট্যাটাসের ইতিহাস</h2>
              {order.statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500">
                  এখনো অতিরিক্ত কোনো স্ট্যাটাস আপডেট নেই।
                </p>
              ) : (
                <ol className="space-y-4">
                  {[...order.statusHistory].reverse().map((entry, index) => (
                    <li
                      key={`${entry.status}-${entry.updatedAt}-${index}`}
                      className="border-l-2 border-green-200 pl-4"
                    >
                      <p className="font-semibold">
                        {statusLabels[entry.status] || entry.status}
                      </p>
                      {entry.message && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {entry.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(entry.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-gray-500">
          মুক্ত বাজার · আপনার কেনাকাটা, আপনার নিয়ন্ত্রণে
        </footer>
      </div>
    </main>
  );
}
