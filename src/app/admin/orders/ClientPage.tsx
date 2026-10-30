
"use client";

import { useCallback, useEffect, useState } from "react";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  unit?: string;
  quantity: number;
  subtotal: number;
};

type Order = {
  id: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    note?: string;
  };
  items?: OrderItem[];
  total?: number;
  currency?: string;
  paymentMethod?: string;
  status?: string;
  statusMessage?: string;
  createdAt?: { _seconds?: number } | string | null;
};

const statuses = [
  { value: "pending_confirmation", label: "অর্ডার অপেক্ষমাণ" },
  { value: "confirmed", label: "অর্ডার নিশ্চিত" },
  { value: "packing", label: "প্যাকিং চলছে" },
  { value: "shipped", label: "ডেলিভারির পথে" },
  { value: "delivered", label: "ডেলিভারি সম্পন্ন" },
  { value: "cancelled", label: "অর্ডার বাতিল" },
];

function statusLabel(status?: string) {
  return statuses.find((item) => item.value === status)?.label ?? status ?? "অজানা";
}

function dateLabel(value: Order["createdAt"]) {
  if (!value) return "তারিখ নেই";

  const date =
    typeof value === "string"
      ? new Date(value)
      : typeof value === "object" && "_seconds" in value && value._seconds
        ? new Date(value._seconds * 1000)
        : null;

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("bn-BD")
    : "তারিখ নেই";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/orders", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "অর্ডার লোড করা যায়নি।");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অর্ডার লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadOrders());
  }, [loadOrders]);

  async function updateStatus(order: Order) {
    const status = selected[order.id] || order.status || "pending_confirmation";
    const message = messages[order.id] || "";

    if (status === order.status && message === (order.statusMessage || "")) {
      setNotice("নতুন কোনো পরিবর্তন করা হয়নি।");
      return;
    }

    const whatsappWindow =
      status === "confirmed" || status === "delivered"
        ? window.open("about:blank", "_blank")
        : null;

    setSaving(order.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          status,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "স্ট্যাটাস আপডেট হয়নি।");
      }

      if (data.whatsappUrl && whatsappWindow) {
        whatsappWindow.location.href = data.whatsappUrl;
      } else {
        whatsappWindow?.close();
        setNotice(
          data.whatsappUrl
            ? `অর্ডার ${order.id} আপডেট হয়েছে। WhatsApp খুলতে পপ-আপ অনুমতি দিন।`
            : `অর্ডার ${order.id} আপডেট হয়েছে। WhatsApp নম্বর পাওয়া যায়নি।`,
        );
      }

      if (data.whatsappUrl) {
        setNotice(`অর্ডার ${order.id} আপডেট হয়েছে। WhatsApp খোলা হচ্ছে।`);
      }

      await loadOrders();
    } catch (err) {
      whatsappWindow?.close();
      setError(err instanceof Error ? err.message : "স্ট্যাটাস আপডেট হয়নি।");
    } finally {
      setSaving("");
    }
  }

  async function deleteOrder(order: Order) {
    const confirmed = window.confirm(
      `অর্ডার ${order.id} স্থায়ীভাবে মুছে ফেলবেন? এই কাজ ফেরানো যাবে না।`,
    );
    if (!confirmed) return;

    setSaving(order.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "অর্ডার মুছে ফেলা যায়নি।");
      }

      setOrders((previous) => previous.filter((item) => item.id !== order.id));
      setSelected((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      setMessages((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      setNotice(`অর্ডার ${order.id} Firebase থেকে মুছে ফেলা হয়েছে।`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অর্ডার মুছে ফেলা যায়নি।");
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 pb-28 text-gray-900 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-green-700">মুক্ত বাজার</p>
            <h1 className="mt-1 text-2xl font-bold">অর্ডার ব্যবস্থাপনা</h1>
            <p className="mt-2 text-sm text-gray-500">
              অর্ডার দেখুন, অবস্থা নির্বাচন করুন এবং গ্রাহকের জন্য আপডেট পোস্ট করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "লোড হচ্ছে..." : "রিফ্রেশ"}
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
            {notice}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">মোট অর্ডার</p>
            <p className="mt-2 text-2xl font-bold">{orders.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">অপেক্ষমাণ</p>
            <p className="mt-2 text-2xl font-bold">
              {orders.filter((order) => order.status === "pending_confirmation").length}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">ডেলিভারি সম্পন্ন</p>
            <p className="mt-2 text-2xl font-bold">
              {orders.filter((order) => order.status === "delivered").length}
            </p>
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
            অর্ডার লোড হচ্ছে...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <p className="font-semibold">এখনো কোনো অর্ডার পাওয়া যায়নি।</p>
            <p className="mt-2 text-sm text-gray-500">
              নতুন অর্ডার জমা হলে এখানে দেখা যাবে।
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const terminal =
                order.status === "delivered" || order.status === "cancelled";

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
                    <div>
                      <p className="text-xs text-gray-500">অর্ডার নম্বর</p>
                      <h2 className="mt-1 break-all font-bold">{order.id}</h2>
                      <p className="mt-2 text-xs text-gray-500">
                        {dateLabel(order.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
                    <section>
                      <h3 className="mb-3 font-bold">গ্রাহকের তথ্য</h3>
                      <p className="text-sm">নাম: {order.customer?.name || "—"}</p>
                      <p className="mt-2 text-sm">মোবাইল: {order.customer?.phone || "—"}</p>
                      <p className="mt-2 text-sm leading-6">
                        ঠিকানা: {order.customer?.address || "—"}
                      </p>
                      {order.customer?.note && (
                        <p className="mt-2 text-sm text-gray-600">
                          নোট: {order.customer.note}
                        </p>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-3 font-bold">পণ্যের বিবরণ</h3>
                      <div className="space-y-3">
                        {(order.items || []).map((item, index) => (
                          <div
                            key={`${item.id}-${index}`}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <span>
                              {item.name} × {item.quantity} {item.unit || "পিস"}
                            </span>
                            <span className="shrink-0 font-medium">
                              ৳{Number(item.subtotal || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-between border-t border-gray-100 pt-3 font-bold">
                        <span>সর্বমোট</span>
                        <span>৳{Number(order.total || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        পেমেন্ট: {order.paymentMethod === "cod" ? "ক্যাশ অন ডেলিভারি" : order.paymentMethod || "—"}
                      </p>
                    </section>
                  </div>

                  <div className="border-t border-gray-100 bg-gray-50 p-4 sm:p-5">
                    <h3 className="font-bold">অর্ডারের অবস্থা আপডেট</h3>

                    {terminal ? (
                      <p className="mt-2 text-sm text-gray-600">
                        এই অর্ডার {statusLabel(order.status)} অবস্থায় আছে।
                      </p>
                    ) : (
                      <>
                        <label className="mt-3 block text-sm font-medium" htmlFor={`status-${order.id}`}>
                          নতুন স্ট্যাটাস নির্বাচন করুন
                        </label>
                        <select
                          id={`status-${order.id}`}
                          value={selected[order.id] ?? order.status ?? "pending_confirmation"}
                          onChange={(event) =>
                            setSelected((previous) => ({
                              ...previous,
                              [order.id]: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                        >
                          {statuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>

                        <label className="mt-4 block text-sm font-medium" htmlFor={`message-${order.id}`}>
                          গ্রাহকের জন্য আপডেট বার্তা (ঐচ্ছিক)
                        </label>
                        <textarea
                          id={`message-${order.id}`}
                          value={messages[order.id] ?? order.statusMessage ?? ""}
                          onChange={(event) =>
                            setMessages((previous) => ({
                              ...previous,
                              [order.id]: event.target.value,
                            }))
                          }
                          maxLength={500}
                          rows={2}
                          placeholder="যেমন: আপনার পণ্য কুরিয়ারে পাঠানো হয়েছে।"
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                        />

                        <button
                          type="button"
                          onClick={() => void updateStatus(order)}
                          disabled={saving === order.id}
                          className="mt-4 w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
                        >
                          {saving === order.id ? "সংরক্ষণ হচ্ছে..." : "স্ট্যাটাস পোস্ট করুন"}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => void deleteOrder(order)}
                      disabled={saving === order.id}
                      className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 disabled:opacity-50 sm:w-auto"
                    >
                      {saving === order.id ? "কাজ চলছে..." : "অর্ডার ডিলিট করুন"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
