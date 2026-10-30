"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

type ReviewItem = {
  id: string;
  name: string;
  quantity: number;
};

export default function ReviewPage() {
  const { language } = useLanguage();
  const en = language === "en";

  const [orderId, setOrderId] = useState("");
  const [token, setToken] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [step, setStep] = useState(1);
  const [productRating, setProductRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId") || "";
    const accessToken = params.get("token") || "";

    Promise.resolve().then(() => {
      if (cancelled) return;

      setOrderId(id);
      setToken(accessToken);

      if (!id || !accessToken) {
        setError(en ? "Invalid review link." : "রিভিউ লিংক সঠিক নয়।");
        setLoading(false);
        return;
      }

      fetch(`/api/reviews?${new URLSearchParams({
        orderId: id,
        token: accessToken,
      })}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.message || "রিভিউ তথ্য পাওয়া যায়নি।");
          }
          if (!cancelled) setItems(data.items || []);
        })
        .catch((err) => {
          if (!cancelled && err.name !== "AbortError") {
            setError(err instanceof Error ? err.message : "রিভিউ লোড হয়নি।");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [en]);

  async function submitReview() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token,
          productRating,
          deliveryRating,
          comment,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "রিভিউ জমা দেওয়া যায়নি।");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিভিউ জমা দেওয়া যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  const title = en ? "Share your experience" : "আপনার অভিজ্ঞতা জানান";
  const labels = en
    ? ["Rate the products", "Rate the delivery", "Write a comment"]
    : ["পণ্যের রেটিং দিন", "ডেলিভারির রেটিং দিন", "মন্তব্য লিখুন"];

  function stars(value: number, setValue: (n: number) => void) {
    return (
      <div style={{ display: "flex", justifyContent: "center", gap: 9, margin: "22px 0" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            aria-label={`${n} stars`}
            style={{
              border: 0,
              background: "transparent",
              color: n <= value ? "#f5a623" : "#cbd5d1",
              fontSize: 38,
              cursor: "pointer",
              padding: 2,
            }}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f9f6", padding: "28px 16px", color: "#17231b" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#176b43", textDecoration: "none", fontWeight: 700 }}>
          ← {en ? "Back to shop" : "দোকানে ফিরে যান"}
        </Link>

        <section style={{ background: "#fff", borderRadius: 18, padding: 24, marginTop: 22, boxShadow: "0 5px 25px #102b1710" }}>
          <h1 style={{ textAlign: "center", fontSize: 24, margin: "0 0 8px" }}>{title}</h1>
          <p style={{ textAlign: "center", color: "#64746a", fontSize: 14 }}>
            {en ? "Order" : "অর্ডার"}: {orderId || "—"}
          </p>

          {loading ? (
            <p style={{ textAlign: "center", padding: 30 }}>{en ? "Checking review link..." : "রিভিউ লিংক যাচাই হচ্ছে..."}</p>
          ) : error && !success ? (
            <p style={{ background: "#fff1f0", color: "#b42318", padding: 14, borderRadius: 10 }}>{error}</p>
          ) : success ? (
            <div style={{ textAlign: "center", padding: "30px 5px" }}>
              <div style={{ fontSize: 52, color: "#176b43" }}>✓</div>
              <h2 style={{ fontSize: 22 }}>{en ? "Thank you!" : "ধন্যবাদ!"}</h2>
              <p style={{ color: "#64746a" }}>
                {en ? "Your review has been submitted." : "আপনার রিভিউ সফলভাবে জমা হয়েছে।"}
              </p>
              <Link href="/" style={{ display: "inline-block", marginTop: 18, background: "#176b43", color: "#fff", padding: "12px 22px", borderRadius: 10, textDecoration: "none" }}>
                {en ? "Back to shop" : "দোকানে ফিরে যান"}
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 7, margin: "24px 0" }}>
                {[1, 2, 3].map((n) => (
                  <div key={n} style={{ height: 5, flex: 1, borderRadius: 5, background: n <= step ? "#176b43" : "#e5ebe6" }} />
                ))}
              </div>

              <p style={{ textAlign: "center", color: "#176b43", fontWeight: 700 }}>
                {en ? `Step ${step} of 3` : `ধাপ ${step} / ৩`}
              </p>
              <h2 style={{ textAlign: "center", fontSize: 20 }}>{labels[step - 1]}</h2>

              {step === 1 && (
                <>
                  <p style={{ textAlign: "center", color: "#64746a", fontSize: 14 }}>
                    {en ? "One rating for all products in this order." : "এই অর্ডারের সব পণ্যের জন্য একটি রেটিং দিন।"}
                  </p>
                  {items.map((item) => (
                    <div key={item.id} style={{ padding: "9px 0", borderBottom: "1px solid #edf0ed", fontSize: 14 }}>
                      {item.name} × {item.quantity}
                    </div>
                  ))}
                  {stars(productRating, setProductRating)}
                </>
              )}

              {step === 2 && (
                <>
                  <p style={{ textAlign: "center", color: "#64746a", fontSize: 14 }}>
                    {en ? "How was your delivery experience?" : "আপনার ডেলিভারির অভিজ্ঞতা কেমন ছিল?"}
                  </p>
                  {stars(deliveryRating, setDeliveryRating)}
                </>
              )}

              {step === 3 && (
                <>
                  <p style={{ color: "#64746a", fontSize: 14 }}>
                    {en ? "Your comment is optional." : "আপনার মন্তব্য ঐচ্ছিক।"}
                  </p>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={1000}
                    rows={5}
                    placeholder={en ? "Write your experience..." : "আপনার অভিজ্ঞতা লিখুন..."}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 10, padding: 13, fontSize: 15, resize: "vertical" }}
                  />
                  <p style={{ textAlign: "right", color: "#849087", fontSize: 12 }}>{comment.length}/1000</p>
                </>
              )}

              {error && <p style={{ color: "#b42318", fontSize: 14 }}>{error}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                {step > 1 && (
                  <button type="button" onClick={() => setStep(step - 1)} style={{ flex: 1, padding: 13, border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", fontWeight: 700 }}>
                    {en ? "Back" : "পেছনে"}
                  </button>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    disabled={(step === 1 && productRating === 0) || (step === 2 && deliveryRating === 0)}
                    onClick={() => setStep(step + 1)}
                    style={{ flex: 1, padding: 13, border: 0, borderRadius: 10, background: "#176b43", color: "#fff", fontWeight: 700, opacity: (step === 1 && !productRating) || (step === 2 && !deliveryRating) ? 0.5 : 1 }}
                  >
                    {en ? "Continue" : "পরবর্তী"}
                  </button>
                ) : (
                  <button type="button" disabled={submitting} onClick={() => void submitReview()} style={{ flex: 1, padding: 13, border: 0, borderRadius: 10, background: "#176b43", color: "#fff", fontWeight: 700, opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? (en ? "Submitting..." : "জমা হচ্ছে...") : (en ? "Submit review" : "রিভিউ জমা দিন")}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
