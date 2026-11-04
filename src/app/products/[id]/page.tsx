
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";

type Product = {
  id: string;
  name: string;
  english: string;
  category: string;
  price: number;
  oldPrice: number;
  unit?: string;
  imageUrl: string;
  special: boolean;
  description: string;
  englishDescription: string;
  ratingSummary?: {
    count: number;
    total: number;
    distribution: Record<string, number>;
  };
};

type Category = {
  id: string;
  bn: string;
  en: string;
};

function money(amount: number, language: string) {
  return `৳${amount.toLocaleString(
    language === "bn" ? "bn-BD" : "en-US",
    { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  )}`;
}

export default function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const en = language === "en";

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      try {
        const response = await fetch("/api/store", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || data.success !== true) {
          throw new Error("Store data could not be loaded");
        }

        if (cancelled) return;

        setProducts(data.products);
        setCategories(data.categories);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStore();

    return () => {
      cancelled = true;
    };
  }, []);

  const product = products.find(
    (item) => item.id.toLowerCase() === id.toLowerCase()
  );

  const category = categories.find((item) => item.id === product?.category);

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.messageCard}>
          <p>{en ? "Loading product..." : "পণ্যের তথ্য লোড হচ্ছে..."}</p>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main style={styles.page}>
        <section style={styles.messageCard}>
          <div style={{ fontSize: 54 }}>🔎</div>
          <h1>{en ? "Product not found" : "পণ্যটি পাওয়া যায়নি"}</h1>
          <p>
            {loadError
              ? (en ? "Product information could not be loaded. Please try again." : "পণ্যের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।")
              : (en
                  ? "This product ID does not exist in the current product list."
                  : "এই আইডির কোনো পণ্য বর্তমান পণ্যের তালিকায় নেই।")}
          </p>
          <Link href="/" style={styles.primaryButton}>
            {en ? "Back to shop" : "দোকানে ফিরে যান"}
          </Link>
        </section>
      </main>
    );
  }

  const discount =
    Number.isFinite(product.price) &&
    Number.isFinite(product.oldPrice) &&
    product.oldPrice > product.price &&
    product.oldPrice > 0
      ? Math.round(
          ((product.oldPrice - product.price) / product.oldPrice) * 100
        )
      : 0;

  async function addToCart() {
    if (!product) return;

    try {
      const saved = localStorage.getItem("mukt-bazar-cart");
      const cart: Record<string, number> = saved ? JSON.parse(saved) : {};
      const nextQuantity = (cart[product.id] || 0) + quantity;

      if (nextQuantity > 99) {
        setNotice(en ? "Not enough stock available." : "পর্যাপ্ত স্টক নেই।");
        return;
      }

      const response = await fetch("/api/cart/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, quantity: nextQuantity }),
      });
      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Reservation failed");
      }

      cart[product.id] = nextQuantity;
      localStorage.setItem("mukt-bazar-cart", JSON.stringify(cart));

      setNotice(
        en
          ? "Quantity reserved and saved to your cart."
          : "পণ্যের স্টক সংরক্ষণ করে কার্টে যোগ হয়েছে।"
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : (en
              ? "Could not reserve stock. Please try again."
              : "স্টক সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।")
      );
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.topBar}>
        <Link href="/" style={styles.backLink}>
          ← {en ? "Back to shop" : "দোকানে ফিরে যান"}
        </Link>
        <span style={styles.brand}>মুক্ত বাজার</span>
      </div>

      <div style={styles.breadcrumb}>
        <Link href="/" style={styles.breadcrumbLink}>
          {en ? "Home" : "হোম"}
        </Link>
        <span> / </span>
        <span>{category?.[en ? "en" : "bn"] ?? ""}</span>
        <span> / </span>
        <span>{en ? product.english : product.name}</span>
      </div>

      <section style={styles.productCard}>
        <div
          style={{
            ...styles.imagePanel,
            backgroundColor: "#f0fdf4",
          }}
        >
          {discount > 0 && <span style={styles.discountBadge}>{discount}% OFF</span>}
          <Image
            src={product.imageUrl}
            alt={en ? product.english : product.name}
            width={800}
            height={800}
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ width: "100%", height: "100%", minHeight: "330px", objectFit: "contain" }}
          />
          <span style={styles.imageId}>{product.id}</span>
        </div>

        <div style={styles.details}>
          <span style={styles.category}>
            {category?.[en ? "en" : "bn"] ?? ""}
          </span>

          <h1 style={styles.title}>
            {en ? product.english : product.name}
          </h1>

          <p style={styles.productId}>
            {en ? "Product ID" : "পণ্যের ইউনিক আইডি"}: {product.id}
          </p>

          <div style={styles.priceRow}>
            <strong style={styles.price}>
              {money(product.price, language)} / {product.unit || "পিস"}
            </strong>
            <del style={styles.oldPrice}>
              {money(product.oldPrice, language)}
            </del>
            <span style={styles.saving}>
              {en ? `Save ${discount}%` : `${discount}% ছাড়`}
            </span>
          </div>

          <div style={styles.divider} />

          <h2 style={styles.sectionTitle}>
            {en ? "Product description" : "পণ্যের বিবরণ"}
          </h2>
          <p style={styles.description}>
            {en ? product.englishDescription : product.description}
          </p>


          <label style={styles.quantityLabel}>
            {en ? "Quantity" : "পরিমাণ"}
          </label>

          <div style={styles.quantityRow}>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              style={styles.quantityButton}
              aria-label={en ? "Decrease quantity" : "পরিমাণ কমান"}
            >
              −
            </button>
            <span style={styles.quantityValue}>{quantity} {product.unit || "পিস"}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              style={styles.quantityButton}
              aria-label={en ? "Increase quantity" : "পরিমাণ বাড়ান"}
            >
              +
            </button>
          </div>

          <div style={styles.totalRow}>
            <span>{en ? "Subtotal" : "মোট দাম"}</span>
            <strong>{money(product.price * quantity, language)}</strong>
          </div>

          <button
            type="button"
            onClick={addToCart}
            style={styles.primaryButton}
          >
            🛒 {en ? "Add to cart" : "কার্টে যোগ করুন"}
          </button>

          {notice && (
            <p role="status" style={styles.feedback}>
              {notice}
            </p>
          )}

          <Link href="/" style={styles.secondaryButton}>
            {en ? "Continue shopping" : "আরও কেনাকাটা করুন"}
          </Link>
        </div>
      </section>

      {product.ratingSummary && product.ratingSummary.count > 0 && (
        <section style={styles.reviewCard} aria-label={en ? "Customer ratings" : "ক্রেতাদের রিভিউ ও রেটিং"}>
          <h2 style={styles.reviewTitle}>
            {en ? "Customer reviews & ratings" : "ক্রেতাদের রিভিউ ও রেটিং"}
          </h2>
          <div style={styles.reviewSummary}>
            <strong style={styles.reviewAverage}>
              {(product.ratingSummary.total / product.ratingSummary.count).toFixed(1)}
            </strong>
            <div>
              <div style={styles.reviewStars}>★★★★★</div>
              <p style={styles.reviewCount}>
                {product.ratingSummary.count.toLocaleString(en ? "en-US" : "bn-BD")} {en ? "reviews" : "টি রিভিউ"}
              </p>
            </div>
          </div>
          <div style={styles.ratingBars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = product.ratingSummary!.distribution[String(star)] || 0;
              const percent = (count / product.ratingSummary!.count) * 100;
              return (
                <div key={star} style={styles.ratingBarRow}>
                  <span>{star}★</span>
                  <div style={styles.ratingBarTrack}>
                    <div style={{ ...styles.ratingBarFill, width: `${percent}%` }} />
                  </div>
                  <span>{count.toLocaleString(en ? "en-US" : "bn-BD")}</span>
                </div>
              );
            })}
          </div>
          <p style={styles.reviewNote}>
            {en
              ? "Ratings are based on verified orders."
              : "এই রেটিংগুলো সম্পন্ন অর্ডারের ক্রেতাদের মতামতের ভিত্তিতে দেখানো হয়েছে।"}
          </p>
        </section>
      )}

      <footer style={styles.footer}>
        <Link href="/" style={styles.backLink}>
          ← {en ? "Return to Mukt Bazar" : "মুক্ত বাজারে ফিরে যান"}
        </Link>
        <p>© {new Date().getFullYear()} Mukt Bazar</p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f8f5",
    color: "#193527",
    padding: "16px",
    paddingBottom: "calc(110px + env(safe-area-inset-bottom))",
    fontFamily: "Arial, sans-serif",
  },
  topBar: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "8px 0 18px",
  },
  backLink: {
    color: "#167344",
    textDecoration: "none",
    fontWeight: 700,
  },
  brand: {
    fontWeight: 800,
    fontSize: "20px",
    color: "#167344",
  },
  breadcrumb: {
    maxWidth: "1100px",
    margin: "0 auto 18px",
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    fontSize: "13px",
    color: "#718078",
  },
  breadcrumbLink: {
    color: "#167344",
    textDecoration: "none",
  },
  productCard: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "22px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(20, 60, 35, 0.06)",
  },
  imagePanel: {
    minHeight: "330px",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
  },
  discountBadge: {
    position: "absolute",
    top: "18px",
    left: "18px",
    background: "#d72f37",
    color: "#fff",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 800,
  },
  emoji: {
    fontSize: "clamp(100px, 20vw, 170px)",
    lineHeight: 1.2,
  },
  imageId: {
    position: "absolute",
    bottom: "14px",
    left: "18px",
    color: "#53665a",
    fontSize: "12px",
  },
  details: {
    padding: "clamp(20px, 4vw, 38px)",
    minWidth: 0,
  },
  category: {
    display: "inline-block",
    background: "#e7f6ec",
    color: "#167344",
    padding: "6px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 700,
  },
  title: {
    fontSize: "clamp(25px, 4vw, 36px)",
    lineHeight: 1.35,
    margin: "16px 0 8px",
    overflowWrap: "anywhere",
  },
  productId: {
    fontSize: "13px",
    color: "#78877d",
    margin: "0 0 20px",
  },
  priceRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  price: {
    fontSize: "28px",
    color: "#167344",
  },
  oldPrice: {
    color: "#909a93",
    fontSize: "16px",
  },
  saving: {
    background: "#fff0f0",
    color: "#c52e37",
    borderRadius: "6px",
    padding: "5px 8px",
    fontSize: "12px",
    fontWeight: 700,
  },
  divider: {
    height: "1px",
    background: "#e8eee9",
    margin: "24px 0",
  },
  sectionTitle: {
    fontSize: "17px",
    margin: "0 0 10px",
  },
  description: {
    color: "#5f7065",
    fontSize: "15px",
    lineHeight: 1.9,
    margin: 0,
  },

  quantityLabel: {
    display: "block",
    fontWeight: 700,
    fontSize: "14px",
    marginTop: "22px",
    marginBottom: "10px",
  },
  quantityRow: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  quantityButton: {
    width: "40px",
    height: "40px",
    border: "1px solid #dce8df",
    background: "#fff",
    borderRadius: "10px",
    color: "#167344",
    fontSize: "24px",
    cursor: "pointer",
  },
  quantityValue: {
    minWidth: "24px",
    textAlign: "center",
    fontWeight: 800,
    fontSize: "18px",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    borderTop: "1px solid #e8eee9",
    paddingTop: "18px",
    marginTop: "22px",
    marginBottom: "18px",
  },
  primaryButton: {
    width: "100%",
    boxSizing: "border-box",
    display: "block",
    border: 0,
    borderRadius: "12px",
    background: "#16804a",
    color: "#fff",
    padding: "15px 18px",
    textAlign: "center",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "block",
    textAlign: "center",
    marginTop: "14px",
    border: "1px solid #dce8df",
    borderRadius: "12px",
    color: "#167344",
    padding: "13px",
    textDecoration: "none",
    fontWeight: 700,
  },
  feedback: {
    background: "#e8f7ed",
    color: "#17683d",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  infoGrid: {
    maxWidth: "1100px",
    margin: "22px auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: "14px",
  },
  infoCard: {
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "16px",
    padding: "20px",
  },
  infoIcon: {
    fontSize: "27px",
  },
  messageCard: {
    maxWidth: "520px",
    margin: "70px auto",
    background: "#fff",
    borderRadius: "20px",
    padding: "30px",
    textAlign: "center",
    lineHeight: 1.8,
  },
  reviewCard: {
    maxWidth: "1100px",
    boxSizing: "border-box",
    margin: "24px auto 0",
    padding: "22px",
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "18px",
    boxShadow: "0 8px 30px rgba(20, 60, 35, 0.05)",
  },
  reviewTitle: {
    margin: "0 0 18px",
    fontSize: "20px",
    color: "#193527",
  },
  reviewSummary: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  reviewAverage: {
    fontSize: "42px",
    color: "#167344",
  },
  reviewStars: {
    color: "#d69a27",
    fontSize: "22px",
    letterSpacing: "2px",
  },
  reviewCount: {
    margin: "3px 0 0",
    color: "#718078",
    fontSize: "13px",
  },
  ratingBars: {
    display: "grid",
    gap: "9px",
    marginTop: "20px",
    maxWidth: "420px",
  },
  ratingBarRow: {
    display: "grid",
    gridTemplateColumns: "30px minmax(0, 1fr) 30px",
    alignItems: "center",
    gap: "10px",
    fontSize: "12px",
    color: "#718078",
  },
  ratingBarTrack: {
    height: "8px",
    borderRadius: "10px",
    overflow: "hidden",
    background: "#edf1ed",
  },
  ratingBarFill: {
    height: "100%",
    borderRadius: "10px",
    background: "#d69a27",
  },
  reviewNote: {
    margin: "18px 0 0",
    color: "#718078",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  footer: {
    maxWidth: "1100px",
    margin: "32px auto 0",
    borderTop: "1px solid #e1eae3",
    paddingTop: "22px",
    color: "#718078",
    fontSize: "13px",
    textAlign: "center",
  },
};
