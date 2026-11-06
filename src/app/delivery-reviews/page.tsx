"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

type Review = {
  id: string;
  deliveryRating: number;
  comment: string;
  createdAt: string | null;
};

export default function DeliveryReviewsPage() {
  const { language } = useLanguage();
  const en = language === "en";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      try {
        const response = await fetch("/api/delivery-reviews", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "রিভিউ লোড করা যায়নি।");
        }

        if (!cancelled) {
          setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "রিভিউ লোড করা যায়নি।",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  function dateLabel(value: string | null) {
    if (!value) return en ? "Date unavailable" : "তারিখ পাওয়া যায়নি";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return en ? "Date unavailable" : "তারিখ পাওয়া যায়নি";
    }

    return date.toLocaleDateString(en ? "en-US" : "bn-BD", {
      dateStyle: "medium",
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f9f6",
        padding: "28px 16px",
        color: "#202a22",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "#176b43",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← {en ? "Back to shop" : "দোকানে ফিরে যান"}
        </Link>

        <header style={{ margin: "24px 0" }}>
          <h1 style={{ fontSize: 25, fontWeight: 800 }}>
            {en ? "Delivery Reviews" : "ডেলিভারি রিভিউ"}
          </h1>
          <p style={{ marginTop: 7, color: "#788178", fontSize: 14 }}>
            {en
              ? "Customers' delivery experiences"
              : "ক্রেতাদের ডেলিভারি অভিজ্ঞতা"}
          </p>
        </header>

        {loading && (
          <p style={{ padding: 25, textAlign: "center" }}>
            {en ? "Loading reviews..." : "রিভিউ লোড হচ্ছে..."}
          </p>
        )}

        {error && (
          <p
            role="alert"
            style={{
              padding: 15,
              borderRadius: 10,
              background: "#fff1f0",
              color: "#b42318",
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && reviews.length === 0 && (
          <section
            style={{
              padding: 35,
              borderRadius: 15,
              background: "#fff",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38 }}>⭐</div>
            <h2 style={{ marginTop: 10, fontWeight: 700 }}>
              {en ? "No reviews yet" : "এখনো কোনো রিভিউ নেই"}
            </h2>
            <p style={{ marginTop: 7, color: "#788178", fontSize: 14 }}>
              {en
                ? "Customer reviews will appear here after delivery."
                : "ডেলিভারির পর গ্রাহকদের রিভিউ এখানে দেখা যাবে।"}
            </p>
          </section>
        )}

        <div style={{ display: "grid", gap: 13 }}>
          {reviews.map((review) => (
            <article
              key={review.id}
              style={{
                padding: 18,
                border: "1px solid #e8ece6",
                borderRadius: 15,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  aria-label={`${review.deliveryRating} out of 5 stars`}
                  style={{ color: "#f5a623", fontSize: 23 }}
                >
                  {"★".repeat(review.deliveryRating)}
                  <span style={{ color: "#dce2dc" }}>
                    {"★".repeat(5 - review.deliveryRating)}
                  </span>
                </div>

                <span style={{ color: "#788178", fontSize: 12 }}>
                  {dateLabel(review.createdAt)}
                </span>
              </div>

              {review.comment && (
                <p
                  style={{
                    marginTop: 13,
                    lineHeight: 1.8,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {review.comment}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
