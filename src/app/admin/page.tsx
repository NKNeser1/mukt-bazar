
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "mukt_bazar_admin_session";

const sections = [
  {
    id: "products",
    icon: "📦",
    title: "পণ্য ব্যবস্থাপনা",
    description: "পণ্য, মূল্য, স্টক ও ছবি পরিচালনা",
    href: "/admin/products",
  },
  {
    id: "orders",
    icon: "🧾",
    title: "অর্ডার ব্যবস্থাপনা",
    description: "অর্ডার দেখা ও ডেলিভারি পরিচালনা",
    href: "/admin/orders",
  },
  {
    id: "categories",
    icon: "🗂️",
    title: "ক্যাটাগরি",
    description: "পণ্যের বিভাগ তৈরি ও সাজানো",
    href: "/admin/categories",
  },
  {
    id: "offers",
    icon: "🎁",
    title: "অফার ও ব্যানার",
    description: "অফার ও প্রচারণা পরিচালনা",
    href: "/admin/offers",
  },
  {
    id: "stock",
    icon: "📦",
    title: "স্টক নিয়ন্ত্রণ",
    description: "পণ্যের মজুত, কম স্টক ও স্টক আপডেট পরিচালনা",
    href: "/admin/stock",
  },
  {
    id: "users",
    icon: "🛡️",
    title: "অ্যাডমিন ও অনুমতি",
    description: "সাব-অ্যাডমিন ও কাজের অনুমতি পরিচালনা",
    href: "/admin/users",
  },
  {
    id: "special-site",
    icon: "⚙️",
    title: "বিশেষ সাইট",
    description: "WhatsApp নম্বর, লোগো, ইন্ট্রো ও সোশ্যাল ব্যানার পরিচালনা",
    href: "/admin/special-site",
  },
];

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    redirect("/admin/login");
  }

  let isRootAdmin = false;

  try {
    const decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    isRootAdmin = decoded.role === "root_admin";
  } catch {
    isRootAdmin = false;
  }

  if (!isRootAdmin) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#f5f8f5] pb-24 text-gray-900 md:pb-8">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-green-100 bg-white p-6 md:block">
          <a href="/admin" className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-700 text-2xl">
              🛍️
            </span>
            <span>
              <span className="block text-lg font-extrabold">
                মুক্ত বাজার
              </span>
              <span className="text-xs text-gray-500">
                Admin Control Center
              </span>
            </span>
          </a>

          <p className="mb-3 mt-10 text-xs font-bold uppercase tracking-wider text-gray-400">
            প্রধান মেনু
          </p>
          <a
            href="#dashboard"
            className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 font-semibold text-green-800"
          >
            <span>▦</span>
            ড্যাশবোর্ড
          </a>

          <div className="mt-8 rounded-2xl border border-green-100 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <p className="font-bold text-green-900">Root Admin</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-green-800">
              আপনার মূল অ্যাডমিন অনুমতি যাচাই করে প্রবেশ দেওয়া হয়েছে।
            </p>
          </div>

          <Link
            href="/"
            className="mt-6 block rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-600 hover:border-green-600 hover:text-green-700"
          >
            ← ওয়েবসাইট দেখুন
          </Link>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
          <header id="dashboard" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-700">
                MUKT BAZAR · ADMIN
              </p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                অ্যাডমিন ড্যাশবোর্ড
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                আপনার দোকানের ব্যবস্থাপনা এক জায়গায়।
              </p>
            </div>

            <Link
              href="/"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-600 hover:text-green-700"
            >
              ওয়েবসাইট দেখুন ↗
            </Link>
          </header>

          <section className="mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#10472f] via-green-800 to-green-600 p-6 text-white shadow-lg shadow-green-900/10 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-green-100">
                  স্বাগতম, Root Admin
                </p>
                <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  মুক্ত বাজার পরিচালনা করুন
                </h2>
                <p className="mt-3 text-sm leading-6 text-green-50">
                  পণ্য, অর্ডার, ক্যাটাগরি, অফার এবং অ্যাডমিন অনুমতির
                  বিভাগগুলো এখান থেকে দেখুন।
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center">
                <span className="text-3xl">🔐</span>
                <p className="mt-2 text-xs font-semibold text-green-50">
                  Root Admin
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="sections-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="sections-title" className="text-lg font-extrabold">
                  পরিচালনা বিভাগ
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  প্রয়োজনীয় বিভাগ বেছে নিন।
                </p>
              </div>
              <span className="rounded-full border border-green-100 bg-white px-3 py-1.5 text-xs font-bold text-green-800">
                ৭টি বিভাগ
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl">
                      {section.icon}
                    </span>
                  </div>

                  <h3 className="mt-5 font-bold">{section.title}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-gray-500">
                    {section.description}
                  </p>

                  <a
                    href={section.href}
                    className="mt-5 flex items-center justify-between rounded-xl border border-green-100 px-4 py-3 text-sm font-bold text-green-800 transition hover:bg-green-50"
                  >
                    <span>বিভাগ খুলুন</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section
            id="security"
            className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm"
            aria-labelledby="security-title"
          >
            <div className="flex items-start gap-3 border-b border-green-50 p-5 sm:p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-xl">
                🛡️
              </span>
              <div>
                <h2 id="security-title" className="font-extrabold">
                  নিরাপত্তা ও প্রশাসনিক নির্দেশনা
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  মুক্ত বাজার · অনুমতিভিত্তিক ব্যবস্থাপনা
                </p>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <h3 className="font-bold text-green-900">
                  Root Admin-এর দায়িত্ব
                </h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-600">
                  <li>• প্রশাসনিক অনুমতি ও সাব-অ্যাডমিন নিয়ন্ত্রণ।</li>
                  <li>• পণ্য, অর্ডার ও সাইটের গুরুত্বপূর্ণ সেটিংস পরিচালনা।</li>
                  <li>• গুরুত্বপূর্ণ পরিবর্তন ও নিরাপত্তা কার্যক্রম পর্যালোচনা।</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-green-900">
                  সাব-অ্যাডমিনের নিয়ম
                </h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-600">
                  <li>• কেবল অনুমোদিত কাজই করা যাবে।</li>
                  <li>• নিজের অনুমতি বা অন্য অ্যাডমিনের অ্যাকাউন্ট পরিবর্তন করা যাবে না।</li>
                  <li>• সন্দেহজনক কার্যকলাপ Root Admin-কে জানাতে হবে।</li>
                </ul>
              </div>
            </div>

            <div className="mx-5 mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:mx-6 sm:mb-6">
              <span className="text-xl">ℹ️</span>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  নিরাপত্তা সম্পর্কে গুরুত্বপূর্ণ তথ্য
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900/80">
                  ড্যাশবোর্ডে প্রবেশের সময় Root Admin-এর সার্ভার সেশন
                  যাচাই করা হয়। প্রতিটি গুরুত্বপূর্ণ API-তে আলাদা
                  অনুমতি যাচাই সম্পন্ন না হওয়া পর্যন্ত সব কাজ নিরাপদ
                  বলে ধরে নেওয়া যাবে না। বর্তমানে সাব-অ্যাডমিন
                  ব্যবস্থাপনা প্রস্তুত করা বাকি।
                </p>
              </div>
            </div>
          </section>

          <footer className="mt-6 pb-4 text-center text-xs text-gray-400">
            মুক্ত বাজার · অ্যাডমিন কন্ট্রোল প্যানেল
          </footer>
        </section>
      </div>

      <nav
  aria-label="অ্যাডমিন নেভিগেশন"
  className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-100 bg-white/95 px-2 py-2 shadow-lg backdrop-blur md:hidden"
>
  <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
    {[
      { href: "#dashboard", icon: "⌂", label: "ড্যাশবোর্ড" },
      { href: "#products", icon: "▦", label: "পণ্য" },
      { href: "#orders", icon: "▤", label: "অর্ডার" },
      { href: "#categories", icon: "☷", label: "ক্যাটাগরি" },
      { href: "#users", icon: "♙", label: "অ্যাডমিন" },
    ].map((item) => (
      <a
        key={item.href}
        href={item.href}
        className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-green-800 transition hover:bg-green-50"
      >
        <span className="text-xl leading-none" aria-hidden="true">
          {item.icon}
        </span>
        <span className="text-center text-[10px] font-semibold sm:text-xs">
          {item.label}
        </span>
      </a>
    ))}
  </div>
</nav>

    </main>
  );
}
