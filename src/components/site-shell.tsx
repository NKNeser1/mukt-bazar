"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteNavigation from "@/components/site-navigation";
import IntroScreen from "@/components/intro-screen";

export default function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login";

  return (
    <>
      {!isAdmin && <IntroScreen />}

      {children}

      {!isAdmin && <SiteNavigation />}

      {isAdmin && !isLogin && (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-green-100 bg-white px-2 py-3 shadow-lg md:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-around gap-2 text-xs font-semibold">
            <Link
              href="/admin"
              className="flex flex-col items-center gap-1 text-green-800"
            >
              <span className="text-xl">▦</span>
              ড্যাশবোর্ড
            </Link>

            <Link
              href="/admin/products"
              className="flex flex-col items-center gap-1 text-gray-700"
            >
              <span className="text-xl">📦</span>
              পণ্য
            </Link>

            <Link
              href="/admin/orders"
              className="flex flex-col items-center gap-1 text-gray-700"
            >
              <span className="text-xl">🧾</span>
              অর্ডার
            </Link>

            <Link
              href="/"
              className="flex flex-col items-center gap-1 text-gray-700"
            >
              <span className="text-xl">⌂</span>
              ওয়েবসাইট
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}