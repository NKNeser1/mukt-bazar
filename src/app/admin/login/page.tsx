
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        await signOut(auth).catch(() => {});
        setError(
          result?.message ||
            `সেশন তৈরি হয়নি (HTTP ${response.status})।`
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const messages: Record<string, string> = {
        "auth/invalid-credential": "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।",
        "auth/user-not-found": "এই ইমেইলে Firebase অ্যাকাউন্ট পাওয়া যায়নি।",
        "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
        "auth/invalid-email": "ইমেইল ঠিকানাটি সঠিক নয়।",
        "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করুন।",
        "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করুন।",
        "auth/operation-not-allowed": "Firebase-এ Email/Password sign-in চালু নেই।",
        "auth/api-key-not-valid": "Firebase API key সঠিক নয়।",
        "auth/configuration-not-found": "Firebase Authentication কনফিগারেশন পরীক্ষা করুন।",
      };

      setError(
        messages[code] ||
          (code
            ? `লগইন ব্যর্থ: ${code}`
            : "লগইন ব্যর্থ হয়েছে। Firebase ও সার্ভারের ত্রুটি পরীক্ষা করুন।")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl shadow-green-950/5">
        <div className="bg-gradient-to-br from-green-800 to-green-600 px-7 py-9 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-3xl">
            🛍️
          </div>
          <h1 className="text-3xl font-extrabold">মুক্ত বাজার</h1>
          <p className="mt-2 text-sm text-green-50">
            অ্যাডমিন কন্ট্রোল প্যানেল
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900">
            অ্যাডমিন লগইন
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            নিবন্ধিত অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিন।
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold text-gray-700">
                ইমেইল ঠিকানা
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-gray-700">
                পাসওয়ার্ড
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="আপনার পাসওয়ার্ড"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 pr-20 text-gray-900 outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-lg px-2 py-2 text-xs font-semibold text-green-700"
                >
                  {showPassword ? "লুকান" : "দেখুন"}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="break-words rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-700 px-4 py-4 font-bold text-white shadow-lg shadow-green-700/15 transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "যাচাই করা হচ্ছে..." : "নিরাপদে লগইন করুন"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>🔒</span>
            <span>মুক্ত বাজার অ্যাডমিন প্যানেল</span>
          </div>

          <div className="mt-5 text-center">
            <a href="/admin/subadmin-login"
              className="font-semibold text-green-700 hover:text-green-800">
              Sub Admin লগইন →
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
