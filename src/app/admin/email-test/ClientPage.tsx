
"use client";

import { useState } from "react";

export default function EmailTestPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function sendTestEmail() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/email-test", {
        method: "POST",
        credentials: "same-origin",
      });

      const result = await response.json();
      setSuccess(response.ok && result.success === true);
      setMessage(result.message || "পরীক্ষার ফলাফল পাওয়া যায়নি।");
    } catch {
      setSuccess(false);
      setMessage("সার্ভারের সঙ্গে সংযোগ করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-5">
      <h1 className="text-2xl font-bold text-green-800">
        ইমেইল কনফিগারেশন পরীক্ষা
      </h1>

      <p className="my-4 text-sm text-gray-600">
        এই পরীক্ষা Root Admin-এর নির্ধারিত Gmail-এ একটি পরীক্ষামূলক ইমেইল পাঠাবে।
      </p>

      <button
        type="button"
        onClick={sendTestEmail}
        disabled={loading}
        className="rounded-xl bg-green-700 px-5 py-3 font-bold text-white disabled:opacity-60"
      >
        {loading ? "পাঠানো হচ্ছে..." : "পরীক্ষামূলক ইমেইল পাঠান"}
      </button>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg p-3 text-sm ${
            success
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message}
        </p>
      )}

      <a
        href="/admin"
        className="mt-6 inline-block text-sm font-semibold text-green-700 underline"
      >
        অ্যাডমিন প্যানেলে ফিরে যান
      </a>
    </main>
  );
}
