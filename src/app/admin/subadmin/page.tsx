
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Permission =
  | "products.read"
  | "orders.read"
  | "categories.read"
  | "stock.read"
  | "banners.manage";

type AdminInfo = {
  uid: string;
  name: string;
  email: string;
  permissions: string[];
};

const cards: {
  title: string;
  description: string;
  icon: string;
  permission: Permission;
  href: string;
  color: string;
}[] = [
  {
    title: "পণ্য ব্যবস্থাপনা",
    description: "পণ্য দেখা ও অনুমোদিত কাজ",
    icon: "📦",
    permission: "products.read",
    href: "/admin/products",
    color: "from-emerald-500 to-green-700",
  },
  {
    title: "অর্ডার ব্যবস্থাপনা",
    description: "অর্ডার দেখা ও পরিচালনা",
    icon: "🛒",
    permission: "orders.read",
    href: "/admin/orders",
    color: "from-blue-500 to-indigo-700",
  },
  {
    title: "ক্যাটাগরি ব্যবস্থাপনা",
    description: "ক্যাটাগরি দেখা ও পরিচালনা",
    icon: "🗂️",
    permission: "categories.read",
    href: "/admin/categories",
    color: "from-violet-500 to-purple-700",
  },
  {
    title: "অফার ব্যবস্থাপনা",
    description: "অফার ও বিশেষ পণ্য",
    icon: "🏷️",
    permission: "banners.manage",
    href: "/admin/offers",
    color: "from-orange-500 to-rose-600",
  },
  {
    title: "স্টক ব্যবস্থাপনা",
    description: "পণ্যের মজুত দেখা ও পরিচালনা",
    icon: "🏬",
    permission: "stock.read",
    href: "/admin/stock",
    color: "from-cyan-500 to-teal-700",
  },
];

export default function SubadminHomePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeId, setNoticeId] = useState(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) router.replace("/admin/login");
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/admin/subadmin-access", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success || !result?.admin) {
          await signOut(auth).catch(() => {});
          if (active) router.replace("/admin/login");
          return;
        }

        if (active) setAdmin(result.admin as AdminInfo);
      } catch {
        if (active) {
          setNotice("অ্যাকাউন্ট যাচাই করা যায়নি। ইন্টারনেট পরীক্ষা করুন।");
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  function showNotice(message: string) {
    const nextId = noticeId + 1;
    setNoticeId(nextId);
    setNotice(message);

    window.setTimeout(() => {
      setNotice((current) => (noticeId + 1 === nextId ? "" : current));
    }, 2000);
  }

  function openCard(permission: Permission, href: string) {
    if (!admin) {
      showNotice("আপনার অ্যাকাউন্ট যাচাই হচ্ছে। একটু অপেক্ষা করুন।");
      return;
    }

    if (!admin.permissions.includes(permission)) {
      showNotice("এই ফাইলে আপনার অনুমতি নেই।");
      return;
    }

    router.push(href);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] p-5">
        <p className="font-semibold text-green-800">অনুমতি যাচাই হচ্ছে...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8f5] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 rounded-3xl bg-gradient-to-br from-green-900 to-green-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-green-100">মুক্ত বাজার</p>
              <h1 className="mt-1 text-2xl font-extrabold">
                Sub-admin প্যানেল
              </h1>
              <p className="mt-2 text-sm text-green-50">
                {admin?.name || "Sub-admin"}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl">
              🛡️
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-green-50">
            আপনার জন্য অনুমোদিত বিভাগে প্রবেশ করুন।
          </p>
        </header>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-gray-900">
              আপনার কাজের বিভাগ
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              অনুমতি ছাড়া অন্য বিভাগ খোলা যাবে না।
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const allowed = admin?.permissions.includes(card.permission) ?? false;

              return (
                <button
                  key={card.permission}
                  type="button"
                  onClick={() => openCard(card.permission, card.href)}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  aria-label={`${card.title}${allowed ? "" : " (অনুমতি নেই)"}`}
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-2xl text-white shadow-sm`}
                  >
                    {card.icon}
                  </div>

                  <h3 className="font-extrabold text-gray-900">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {card.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        allowed
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {allowed ? "অনুমতি আছে" : "অনুমতি নেই"}
                    </span>
                    <span className="text-lg text-gray-400" aria-hidden="true">
                      →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">⚠️</span>
            <div>
              <h2 className="font-extrabold text-amber-900">
                গুরুত্বপূর্ণ সতর্কবার্তা
              </h2>
              <p className="mt-2 text-sm leading-7 text-amber-900">
                আপনাকে যে ফাইল ও কাজের অনুমতি দেওয়া হয়েছে, শুধু সেই কাজ করুন।
                অনুমতি ছাড়া অন্য ফাইলে প্রবেশের চেষ্টা করবেন না। বারবার
                অনুমতিহীন প্রবেশের চেষ্টা করলে আপনার Sub-admin পদ বাতিল হতে
                পারে। অনুমতি পরিবর্তন বা বাতিলের দায়িত্ব Root Admin-এর।
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-gray-400">
          Mukt Bazar · Sub-admin Access
        </footer>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-md rounded-xl bg-gray-900 px-5 py-4 text-center text-sm font-bold text-white shadow-xl"
        >
          {notice}
        </div>
      )}
    </main>
  );
}
