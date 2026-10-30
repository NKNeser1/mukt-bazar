
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type LoginMode = "admin" | "subadmin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("subadmin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (otpStep) {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          setOtpStep(false);
          setError("আবার ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।");
          return;
        }

        const idToken = await currentUser.getIdToken(true);
        const response = await fetch("/api/admin/subadmin-otp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, otp: otp.trim() }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success || !result?.customToken) {
          setError(result?.message || "OTP যাচাই করা যায়নি।");
          return;
        }

        const credential = await signInWithCustomToken(
          auth,
          result.customToken
        );
        const verifiedToken = await credential.user.getIdToken(true);

        const sessionResponse = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: verifiedToken }),
        });
        const sessionResult = await sessionResponse.json().catch(() => null);

        if (!sessionResponse.ok || !sessionResult?.success) {
          await signOut(auth).catch(() => {});
          setError(sessionResult?.message || "সেশন তৈরি হয়নি।");
          return;
        }

        router.replace("/admin/subadmin");
        router.refresh();
        return;
      }

      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const idToken = await credential.user.getIdToken(true);

      if (mode === "admin") {
        const response = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          await signOut(auth).catch(() => {});
          setError(result?.message || "Admin লগইন সফল হয়নি।");
          return;
        }

        router.replace("/admin");
        router.refresh();
        return;
      }

      const response = await fetch("/api/admin/subadmin-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, name: name.trim() }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        await signOut(auth).catch(() => {});
        setError(result?.message || "OTP পাঠানো যায়নি।");
        return;
      }

      setOtpStep(true);
      setNotice(result.message || "Root Admin-এর ইমেইলে OTP পাঠানো হয়েছে।");
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const message = err instanceof Error ? err.message : "";

      const messages: Record<string, string> = {
        "auth/invalid-credential": "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।",
        "auth/user-not-found": "এই ইমেইলে অ্যাকাউন্ট পাওয়া যায়নি।",
        "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
        "auth/invalid-email": "ইমেইল ঠিকানাটি সঠিক নয়।",
        "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করুন।",
        "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করুন।",
        "auth/operation-not-allowed": "Firebase Email/Password sign-in চালু নেই।",
        "auth/api-key-not-valid": "Firebase API key পরীক্ষা করুন।",
        "auth/configuration-not-found": "Firebase Authentication পরীক্ষা করুন।",
      };

      setError(messages[code] || message || "লগইন ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(nextMode: LoginMode) {
    if (loading) return;

    await signOut(auth).catch(() => {});
    setMode(nextMode);
    setOtpStep(false);
    setOtp("");
    setError("");
    setNotice("");
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
          {!otpStep && (
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => void changeMode("admin")}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  mode === "admin"
                    ? "bg-green-700 text-white shadow"
                    : "text-gray-600"
                }`}
              >
                Admin Login
              </button>
              <button
                type="button"
                onClick={() => void changeMode("subadmin")}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  mode === "subadmin"
                    ? "bg-green-700 text-white shadow"
                    : "text-gray-600"
                }`}
              >
                Sub-admin Login
              </button>
            </div>
          )}

          <h2 className="text-xl font-bold text-gray-900">
            {otpStep
              ? "OTP যাচাই"
              : mode === "admin"
                ? "Admin লগইন"
                : "Sub-admin লগইন"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {otpStep
              ? "Root Admin-এর ইমেইলে পাঠানো ৮ সংখ্যার OTP দিন।"
              : mode === "admin"
                ? "Root Admin-এর নিবন্ধিত ইমেইল ও পাসওয়ার্ড দিন।"
                : "নিবন্ধিত নাম, ইমেইল ও পাসওয়ার্ড দিন।"}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {otpStep ? (
              <div>
                <label htmlFor="admin-otp" className="mb-2 block text-sm font-semibold text-gray-700">
                  ৮ সংখ্যার OTP
                </label>
                <input
                  id="admin-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="00000000"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-center text-xl tracking-[0.3em] text-gray-900 outline-none focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  OTP-এর মেয়াদ ৫ মিনিট।
                </p>
              </div>
            ) : (
              <>
                {mode === "subadmin" && (
                  <div>
                    <label htmlFor="admin-name" className="mb-2 block text-sm font-semibold text-gray-700">
                      নিবন্ধিত পূর্ণ নাম
                    </label>
                    <input
                      id="admin-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="আপনার নিবন্ধিত নাম"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
                    />
                  </div>
                )}

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
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
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
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 pr-20 text-gray-900 outline-none focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-2 text-xs font-semibold text-green-700"
                    >
                      {showPassword ? "লুকান" : "দেখুন"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="break-words rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="break-words rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-700 px-4 py-4 font-bold text-white shadow-lg shadow-green-700/15 transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "যাচাই করা হচ্ছে..."
                : otpStep
                  ? "OTP যাচাই করে প্রবেশ করুন"
                  : mode === "admin"
                    ? "Admin হিসেবে লগইন"
                    : "OTP পাঠান"}
            </button>

            {otpStep && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setOtpStep(false);
                  setOtp("");
                  setNotice("");
                  setError("");
                  void signOut(auth);
                }}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600"
              >
                ফিরে যান
              </button>
            )}
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>🔒</span>
            <span>মুক্ত বাজার নিরাপদ অ্যাডমিন প্যানেল</span>
          </div>
        </div>
      </section>
    </main>
  );
}
