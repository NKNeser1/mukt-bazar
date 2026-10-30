
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";

type CartItem = {
  id: string;
  name: string;
  english: string;
  price: number;
  oldPrice: number;
  unit?: string;
  imageUrl: string;
  stock: number;
};

type StoreResponse = {
  success: boolean;
  products?: CartItem[];
};

function money(amount: number, language: string) {
  return `৳${amount.toLocaleString(
    language === "bn" ? "bn-BD" : "en-US",
    { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  )}`;
}

export default function CartPage() {
  const { language } = useLanguage();
  const en = language === "en";

  const [cart, setCart] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      try {
        const response = await fetch("/api/store", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Store could not be loaded");
        }

        const result: StoreResponse = await response.json();

        if (!result.success || !Array.isArray(result.products)) {
          throw new Error("Invalid store response");
        }

        const available = result.products.filter(
          (product) =>
            typeof product.id === "string" &&
            typeof product.name === "string" &&
            typeof product.english === "string" &&
            typeof product.imageUrl === "string" &&
            product.imageUrl.startsWith("https://") &&
            Number.isFinite(product.price) &&
            product.price > 0 &&
            Number.isFinite(product.oldPrice) &&
            product.oldPrice >= product.price &&
            Number.isInteger(product.stock) &&
            product.stock > 0
        );

        const saved = localStorage.getItem("mukt-bazar-cart");
        const parsed: unknown = saved ? JSON.parse(saved) : {};

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("Invalid saved cart");
        }

        const valid: Record<string, number> = {};

        for (const [id, quantity] of Object.entries(parsed)) {
          const product = available.find((item) => item.id === id);

          if (
            product &&
            typeof quantity === "number" &&
            Number.isFinite(quantity) &&
            quantity > 0
          ) {
            valid[id] = Math.min(
              99,
              product.stock,
              Math.floor(quantity)
            );
          }
        }

        if (cancelled) return;

        setProducts(available);
        setCart(valid);
        localStorage.setItem(
          "mukt-bazar-cart",
          JSON.stringify(valid)
        );
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadCart();

    return () => {
      cancelled = true;
    };
  }, []);

  function saveCart(nextCart: Record<string, number>) {
    setCart(nextCart);

    try {
      localStorage.setItem(
        "mukt-bazar-cart",
        JSON.stringify(nextCart)
      );
    } catch {
      // Keep the current cart in page state.
    }
  }

  function changeQuantity(id: string, amount: number) {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    const next = { ...cart };
    const quantity = (next[id] || 0) + amount;

    if (quantity <= 0) {
      delete next[id];
    } else {
      next[id] = Math.min(99, product.stock, quantity);
    }

    saveCart(next);
  }

  const cartItems = products.filter(
    (product) => (cart[product.id] || 0) > 0
  );

  const totalQuantity = cartItems.reduce(
    (sum, product) => sum + cart[product.id],
    0
  );

  const roundMoney = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  const totalPrice = roundMoney(
    cartItems.reduce(
      (sum, product) =>
        sum + roundMoney(product.price) * cart[product.id],
      0
    )
  );

  const totalSaving = roundMoney(
    cartItems.reduce(
      (sum, product) =>
        sum + roundMoney(
          Math.max(0, product.oldPrice - product.price)
        ) * cart[product.id],
      0
    )
  );

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/" style={styles.brand}>
          {en ? "Mukt Bazar" : "মুক্ত বাজার"}
        </Link>

        <Link href="/" style={styles.backLink}>
          {en ? "← Back to shopping" : "← কেনাকাটায় ফিরে যান"}
        </Link>
      </header>

      <section style={styles.container}>
        <div style={styles.headingRow}>
          <div>
            <p style={styles.eyebrow}>MUKT BAZAR</p>

            <h1 style={styles.title}>
              {en ? "Your Shopping Cart 🛒" : "আপনার শপিং কার্ট 🛒"}
            </h1>

            <p style={styles.subtitle}>
              {en
                ? "Review the products you selected."
                : "আপনার পছন্দের পণ্যগুলো এখানে দেখুন।"}
            </p>
          </div>

          {loaded && !loadError && totalQuantity > 0 && (
            <span style={styles.countBadge}>
              {en
                ? `${totalQuantity} items`
                : `${totalQuantity}টি পণ্য`}
            </span>
          )}
        </div>

        {!loaded ? (
          <div style={styles.emptyCard}>
            {en ? "Loading cart..." : "কার্ট লোড হচ্ছে..."}
          </div>
        ) : loadError ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyEmoji}>⚠️</div>
            <h2 style={styles.emptyTitle}>
              {en ? "Could not load your cart" : "কার্ট লোড করা যায়নি"}
            </h2>
            <p style={styles.subtitle}>
              {en
                ? "Please check your connection and try again."
                : "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"}
            </p>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => window.location.reload()}
            >
              {en ? "Try again" : "আবার চেষ্টা করুন"}
            </button>
          </div>
        ) : cartItems.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyEmoji}>🛍️</div>

            <h2 style={styles.emptyTitle}>
              {en ? "Your cart is empty" : "আপনার কার্ট খালি"}
            </h2>

            <p style={styles.subtitle}>
              {en
                ? "Add your favourite products from the home page."
                : "হোম পেজ থেকে পছন্দের পণ্য কার্টে যোগ করুন।"}
            </p>

            <Link href="/" style={styles.primaryButton}>
              {en ? "Start shopping" : "কেনাকাটা শুরু করুন"}
            </Link>
          </div>
        ) : (
          <div style={styles.layout}>
            <div style={styles.items}>
              {cartItems.map((product) => {
                const quantity = cart[product.id];

                return (
                  <article key={product.id} style={styles.item}>
                    <div style={styles.image}>
                      <Image
                        src={product.imageUrl}
                        alt={en ? product.english : product.name}
                        width={100}
                        height={110}
                        sizes="100px"
                        style={styles.productImage}
                      />
                    </div>

                    <div style={styles.itemInfo}>
                      <h2 style={styles.itemTitle}>
                        {en ? product.english : product.name}
                      </h2>

                      <p style={styles.english}>
                        {en ? product.name : product.english}
                      </p>

                      <p style={styles.productId}>
                        {en ? "Product ID:" : "আইডি:"} {product.id}
                      </p>

                      <div style={styles.priceRow}>
                        <strong style={styles.price}>
                          {money(product.price, language)}
                        </strong>

                        {product.oldPrice > product.price && (
                          <del style={styles.oldPrice}>
                            {money(product.oldPrice, language)}
                          </del>
                        )}
                      </div>

                      <div style={styles.itemBottom}>
                        <div style={styles.quantityControl}>
                          <button
                            type="button"
                            style={styles.quantityButton}
                            onClick={() => changeQuantity(product.id, -1)}
                            aria-label={
                              en ? "Decrease quantity" : "পরিমাণ কমান"
                            }
                          >
                            −
                          </button>

                          <span style={styles.quantity}>{quantity} {product.unit || "পিস"}</span>

                          <button
                            type="button"
                            style={{
                              ...styles.quantityButton,
                              ...(quantity >= product.stock
                                ? styles.disabledButton
                                : {}),
                            }}
                            disabled={quantity >= product.stock}
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label={
                              en ? "Increase quantity" : "পরিমাণ বাড়ান"
                            }
                          >
                            +
                          </button>
                        </div>

                        <strong style={styles.lineTotal}>
                          {money(product.price * quantity, language)}
                        </strong>

                        {product.stock - quantity === 0 && (
                          <p style={styles.stockNote}>
                            {en ? "Stock is currently 0" : "স্টক বর্তমানে ০"}
                          </p>
                        )}
                      </div>

                    </div>
                  </article>
                );
              })}
            </div>

            <aside style={styles.summary}>
              <h2 style={styles.summaryTitle}>
                {en ? "Order summary" : "অর্ডারের সারাংশ"}
              </h2>

              <div style={styles.summaryRow}>
                <span>{en ? "Total items" : "মোট পণ্য"}</span>
                <span>{en ? totalQuantity : `${totalQuantity}টি`}</span>
              </div>

              <div style={styles.summaryRow}>
                <span>{en ? "Subtotal" : "পণ্যের মোট দাম"}</span>
                <span>{money(totalPrice, language)}</span>
              </div>

              <div style={styles.summaryRow}>
                <span>{en ? "You save" : "আপনার সাশ্রয়"}</span>
                <strong style={styles.saving}>
                  {money(totalSaving, language)}
                </strong>
              </div>

              <div style={styles.totalRow}>
                <strong>{en ? "Total" : "সর্বমোট"}</strong>
                <strong style={styles.grandTotal}>
                  {money(totalPrice, language)}
                </strong>
              </div>

              <p style={styles.summaryNote}>
                {en
                  ? "Delivery charges, if any, will be added at checkout."
                  : "ডেলিভারি চার্জ থাকলে চেকআউটের সময় যোগ হবে।"}
              </p>

              <Link href="/checkout" style={styles.primaryButton}>
                {en ? "Proceed to checkout →" : "চেকআউটে যান →"}
              </Link>

              <Link href="/" style={styles.continueButton}>
                {en ? "← Continue shopping" : "← আরও কেনাকাটা করুন"}
              </Link>
            </aside>
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()}{" "}
        {en ? "Mukt Bazar" : "মুক্ত বাজার"} · Mukt Bazar
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
    fontFamily: "Arial, sans-serif",
  },
  header: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "12px 0 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  brand: {
    color: "#167344",
    fontSize: "22px",
    fontWeight: 800,
    textDecoration: "none",
  },
  backLink: {
    color: "#167344",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "14px",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  headingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  eyebrow: {
    color: "#16804a",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "2px",
    margin: "0 0 8px",
  },
  title: {
    fontSize: "clamp(26px, 5vw, 36px)",
    margin: 0,
    lineHeight: 1.35,
  },
  subtitle: {
    color: "#718078",
    fontSize: "14px",
    lineHeight: 1.7,
    margin: "8px 0 0",
  },
  countBadge: {
    background: "#e7f6ec",
    color: "#167344",
    borderRadius: "30px",
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: "13px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "22px",
    alignItems: "start",
  },
  items: {
    display: "grid",
    gap: "14px",
  },
  item: {
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "18px",
    padding: "16px",
    display: "grid",
    gridTemplateColumns: "100px minmax(0, 1fr)",
    gap: "16px",
    boxShadow: "0 5px 20px rgba(20,60,35,0.04)",
  },
  image: {
    minHeight: "110px",
    height: "110px",
    borderRadius: "13px",
    overflow: "hidden",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  itemInfo: {
    minWidth: 0,
  },
  itemTitle: {
    fontSize: "18px",
    margin: "0 0 4px",
    overflowWrap: "anywhere",
  },
  english: {
    color: "#718078",
    fontSize: "13px",
    margin: "0 0 6px",
  },
  productId: {
    color: "#8a968e",
    fontSize: "11px",
    margin: "0 0 10px",
  },
  priceRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "9px",
  },
  price: {
    color: "#167344",
    fontSize: "17px",
  },
  oldPrice: {
    color: "#9aa39d",
    fontSize: "13px",
  },
  itemBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  quantityControl: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  quantityButton: {
    width: "34px",
    height: "34px",
    border: "1px solid #dce8df",
    background: "#fff",
    borderRadius: "9px",
    color: "#167344",
    fontSize: "21px",
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  quantity: {
    minWidth: "20px",
    textAlign: "center",
    fontWeight: 800,
  },
  lineTotal: {
    color: "#193527",
    fontSize: "16px",
  },
  stockNote: {
    color: "#8a6a20",
    fontSize: "11px",
    margin: "8px 0 0",
  },
  removeButton: {
    border: 0,
    background: "transparent",
    color: "#c53b43",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    padding: "10px 0 0",
  },
  summary: {
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 5px 20px rgba(20,60,35,0.04)",
  },
  summaryTitle: {
    fontSize: "20px",
    margin: "0 0 22px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#637368",
    fontSize: "14px",
    marginBottom: "17px",
  },
  saving: {
    color: "#16804a",
  },
  totalRow: {
    borderTop: "1px solid #e8eee9",
    paddingTop: "18px",
    marginTop: "8px",
    marginBottom: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  grandTotal: {
    color: "#167344",
    fontSize: "24px",
  },
  summaryNote: {
    color: "#849087",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: "0 0 18px",
  },
  primaryButton: {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    background: "#16804a",
    color: "#fff",
    padding: "14px 16px",
    borderRadius: "11px",
    textAlign: "center",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 800,
    border: 0,
  },
  continueButton: {
    display: "block",
    textAlign: "center",
    color: "#167344",
    textDecoration: "none",
    border: "1px solid #dce8df",
    borderRadius: "11px",
    padding: "13px",
    marginTop: "12px",
    fontSize: "13px",
    fontWeight: 700,
  },
  emptyCard: {
    background: "#fff",
    border: "1px solid #e4ece5",
    borderRadius: "20px",
    padding: "clamp(28px, 6vw, 55px) 20px",
    textAlign: "center",
    boxShadow: "0 5px 20px rgba(20,60,35,0.04)",
  },
  emptyEmoji: {
    fontSize: "65px",
  },
  emptyTitle: {
    fontSize: "24px",
    margin: "12px 0 0",
  },
  footer: {
    maxWidth: "1100px",
    margin: "40px auto 0",
    padding: "22px 0",
    borderTop: "1px solid #e1eae3",
    textAlign: "center",
    color: "#718078",
    fontSize: "12px",
  },
};
