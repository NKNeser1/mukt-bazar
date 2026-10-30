
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";

type CheckoutProduct = {
  id: string;
  name: string;
  english: string;
  price: number;
  oldPrice: number;
  unit?: string;
  imageUrl: string;
  stock: number;
};

type WhatsAppOption = {
  id: string;
  label: string;
  number: string;
  primary: boolean;
};

type Customer = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  fontSize: 15,
  background: "#fff",
  color: "#17231b",
};

export default function CheckoutPage() {
  const { language } = useLanguage();
  const en = language === "en";

  const [products, setProducts] = useState<CheckoutProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [payment, setPayment] = useState("cod");
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppOption[]>([]);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer>({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function loadStore() {
    setLoaded(false);
    setLoadError("");

    try {
      const response = await fetch("/api/store", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success || !Array.isArray(result.products)) {
        throw new Error("STORE_LOAD_FAILED");
      }

      const validProducts: CheckoutProduct[] = result.products.filter(
        (product: CheckoutProduct) =>
          product &&
          typeof product.id === "string" &&
          product.id.length > 0 &&
          typeof product.name === "string" &&
          typeof product.english === "string" &&
          Number.isFinite(product.price) &&
          product.price > 0 &&
          Number.isFinite(product.oldPrice) &&
          product.oldPrice >= product.price &&
          typeof product.imageUrl === "string" &&
          product.imageUrl.startsWith("https://") &&
          Number.isInteger(product.stock) &&
          product.stock > 0
      );

      setProducts(validProducts);

      try {
        const saved = localStorage.getItem("mukt-bazar-cart");
        const parsed: unknown = saved ? JSON.parse(saved) : {};

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("INVALID_CART");
        }

        const validCart: Record<string, number> = {};

        for (const product of validProducts) {
          const requested = (parsed as Record<string, unknown>)[product.id];

          if (
            typeof requested === "number" &&
            Number.isFinite(requested) &&
            requested > 0
          ) {
            validCart[product.id] = Math.min(
              99,
              product.stock,
              Math.floor(requested)
            );
          }
        }

        setCart(validCart);
        localStorage.setItem("mukt-bazar-cart", JSON.stringify(validCart));
      } catch {
        setCart({});
        localStorage.removeItem("mukt-bazar-cart");
      }
    } catch {
      setLoadError(
        en
          ? "Could not load products. Check your connection and try again."
          : "পণ্য লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
      );
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadStore());
    // Load store data when the checkout page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadWhatsAppNumbers() {
      try {
        const response = await fetch("/api/site-settings", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !Array.isArray(result.whatsappNumbers)) {
          throw new Error("WHATSAPP_LOAD_FAILED");
        }

        setWhatsappNumbers(result.whatsappNumbers);
      } catch {
        setWhatsappNumbers([]);
      } finally {
        setWhatsappLoading(false);
      }
    }

    void loadWhatsAppNumbers();
  }, []);

  const items = products.filter((product) => (cart[product.id] || 0) > 0);
  const quantity = items.reduce(
    (sum, product) => sum + cart[product.id],
    0
  );
  const roundMoney = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  const total = roundMoney(
    items.reduce(
      (sum, product) => sum + roundMoney(product.price) * cart[product.id],
      0
    )
  );

  function updateCustomer(field: keyof Customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !loaded || loadError || items.length === 0) return;

    if (payment !== "cod") {
      setSubmitError(
        en ? "This payment method is not available yet." : "এই পেমেন্ট পদ্ধতি এখনো চালু হয়নি।"
      );
      return;
    }

    if (!selectedWhatsappId || !whatsappNumbers.some((item) => item.id === selectedWhatsappId)) {
      setSubmitError(
        en ? "Please select a WhatsApp number." : "অর্ডার পাঠানোর জন্য একটি WhatsApp নম্বর নির্বাচন করুন।"
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          note: customer.note.trim(),
          paymentMethod: "cod",
          whatsappNumberId: selectedWhatsappId,
          items: items.map((item) => ({
            id: item.id,
            quantity: cart[item.id],
          })),
        }),
      });

      const result = await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.whatsappUrl ||
        typeof result.reviewToken !== "string" ||
        typeof result.orderId !== "string"
      ) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : en
              ? "Could not place the order. Please try again."
              : "অর্ডার জমা হয়নি। আবার চেষ্টা করুন।"
        );
      }

      const savedReviewAccess = localStorage.getItem(
        "mukt-bazar-review-access"
      );
      let reviewAccess: { orderId: string; token: string }[] = [];

      try {
        const parsed: unknown = savedReviewAccess
          ? JSON.parse(savedReviewAccess)
          : [];
        if (Array.isArray(parsed)) {
          reviewAccess = parsed.filter(
            (item): item is { orderId: string; token: string } =>
              !!item &&
              typeof item === "object" &&
              typeof item.orderId === "string" &&
              typeof item.token === "string"
          );
        }
      } catch {
        reviewAccess = [];
      }

      reviewAccess = reviewAccess.filter(
        (item) => item.orderId !== result.orderId
      );
      reviewAccess.push({
        orderId: result.orderId,
        token: result.reviewToken,
      });
      localStorage.setItem(
        "mukt-bazar-review-access",
        JSON.stringify(reviewAccess.slice(-50))
      );

      localStorage.removeItem("mukt-bazar-cart");

      const whatsappLink = new URL(result.whatsappUrl);
      const phone = whatsappLink.pathname.replace(/^\//, "");
      const message = whatsappLink.searchParams.get("text") || "";

      if (/Android/i.test(navigator.userAgent)) {
        const intentUrl =
          `intent://send?phone=${phone}&text=${encodeURIComponent(message)}` +
          "#Intent;scheme=whatsapp;action=android.intent.action.VIEW;end";
        window.location.assign(intentUrl);
      } else {
        window.location.assign(result.whatsappUrl);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message !== "STORE_LOAD_FAILED"
          ? error.message
          : en
            ? "A connection error occurred. Please try again."
            : "সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
      );
      setSubmitting(false);
    }
  }

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f5f8f5",
    color: "#17231b",
    padding: "22px 16px 110px",
  };

  const container: React.CSSProperties = {
    maxWidth: 1000,
    margin: "0 auto",
  };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e3e9e3",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  };

  const label: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 7,
  };

  const money = (amount: number) =>
    `৳${amount.toLocaleString(en ? "en-US" : "bn-BD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  return (
    <main style={page}>
      <div style={container}>
        <header style={{ marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              color: "#16803d",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {en ? "Mukt Bazar" : "মুক্ত বাজার"}
          </Link>

          <div style={{ marginTop: 15 }}>
            <Link
              href="/cart"
              style={{ color: "#16803d", textDecoration: "none" }}
            >
              {en ? "← Back to cart" : "← কার্টে ফিরে যান"}
            </Link>

            <h1 style={{ fontSize: 28, margin: "14px 0 6px" }}>
              {en ? "Checkout" : "চেকআউট"}
            </h1>

            <p style={{ color: "#647067", margin: 0 }}>
              {en
                ? "Enter your delivery details to place an order."
                : "অর্ডার করার জন্য আপনার ডেলিভারির তথ্য দিন।"}
            </p>
          </div>
        </header>

        {!loaded ? (
          <div style={card}>
            {en ? "Loading products..." : "পণ্য লোড হচ্ছে..."}
          </div>
        ) : loadError ? (
          <section style={{ ...card, textAlign: "center" }}>
            <p role="alert" style={{ color: "#b42318" }}>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadStore()}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "12px 20px",
                background: "#16803d",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {en ? "Try again" : "আবার চেষ্টা করুন"}
            </button>
          </section>
        ) : items.length === 0 ? (
          <section style={{ ...card, textAlign: "center", padding: 35 }}>
            <div style={{ fontSize: 44 }}>🛒</div>
            <h2>{en ? "Your cart is empty" : "আপনার কার্ট খালি"}</h2>
            <Link href="/" style={{ color: "#16803d" }}>
              {en ? "Browse products" : "পণ্য দেখুন"}
            </Link>
          </section>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            <form onSubmit={handleSubmit}>
              <section style={card}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>
                  {en ? "Delivery information" : "ডেলিভারির তথ্য"}
                </h2>

                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="customer-name">
                    {en ? "Full name *" : "আপনার পুরো নাম *"}
                  </label>
                  <input
                    id="customer-name"
                    style={fieldStyle}
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={customer.name}
                    onChange={(e) => updateCustomer("name", e.target.value)}
                    placeholder={en ? "Enter your name" : "আপনার নাম লিখুন"}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="customer-phone">
                    {en ? "Mobile number *" : "মোবাইল নম্বর *"}
                  </label>
                  <input
                    id="customer-phone"
                    style={fieldStyle}
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={20}
                    value={customer.phone}
                    onChange={(e) => updateCustomer("phone", e.target.value)}
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={label} htmlFor="customer-address">
                    {en
                      ? "Full delivery address *"
                      : "সম্পূর্ণ ডেলিভারি ঠিকানা *"}
                  </label>
                  <textarea
                    id="customer-address"
                    style={{ ...fieldStyle, minHeight: 100, resize: "vertical" }}
                    autoComplete="street-address"
                    required
                    maxLength={500}
                    value={customer.address}
                    onChange={(e) => updateCustomer("address", e.target.value)}
                    placeholder={
                      en
                        ? "House, road, area, district"
                        : "বাসা, রাস্তা, এলাকা, জেলা লিখুন"
                    }
                  />
                </div>

                <div>
                  <label style={label} htmlFor="customer-note">
                    {en ? "Additional note (optional)" : "অতিরিক্ত তথ্য (ঐচ্ছিক)"}
                  </label>
                  <textarea
                    id="customer-note"
                    style={{ ...fieldStyle, minHeight: 75, resize: "vertical" }}
                    maxLength={500}
                    value={customer.note}
                    onChange={(e) => updateCustomer("note", e.target.value)}
                    placeholder={
                      en
                        ? "Any delivery instructions?"
                        : "ডেলিভারি সম্পর্কে কিছু বলার থাকলে লিখুন"
                    }
                  />
                </div>
              </section>

              <section style={card}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>
                  {en ? "Payment method" : "পেমেন্ট পদ্ধতি"}
                </h2>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    border:
                      payment === "cod"
                        ? "1px solid #16803d"
                        : "1px solid #e3e9e3",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={payment === "cod"}
                    onChange={() => setPayment("cod")}
                    style={{ marginTop: 4 }}
                  />
                  <span>
                    <strong>
                      {en ? "Cash on Delivery" : "ক্যাশ অন ডেলিভারি"}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        color: "#647067",
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {en
                        ? "Pay when your order arrives."
                        : "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।"}
                    </span>
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    border: "1px solid #e3e9e3",
                    borderRadius: 12,
                    padding: 14,
                    opacity: 0.65,
                    cursor: "not-allowed",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled
                    style={{ marginTop: 4 }}
                  />
                  <span>
                    <strong>{en ? "Online payment" : "অনলাইন পেমেন্ট"}</strong>
                    <span
                      style={{
                        display: "block",
                        color: "#647067",
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {en
                        ? "Coming soon — not available yet."
                        : "শীঘ্রই চালু হবে — আপাতত ব্যবহার করা যাবে না।"}
                    </span>
                  </span>
                </label>
              </section>

              <section style={card}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>
                  {en ? "Choose WhatsApp number" : "WhatsApp নম্বর নির্বাচন করুন"}
                </h2>
                <p style={{ color: "#647067", fontSize: 13 }}>
                  {en ? "Select where to send your order." : "অর্ডার পাঠানোর জন্য একটি নম্বর বেছে নিন।"}
                </p>
                {whatsappLoading ? (
                  <p>{en ? "Loading numbers..." : "নম্বর লোড হচ্ছে..."}</p>
                ) : whatsappNumbers.length === 0 ? (
                  <p style={{ color: "#b42318" }}>
                    {en ? "No active WhatsApp number available." : "কোনো সক্রিয় WhatsApp নম্বর পাওয়া যায়নি।"}
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {whatsappNumbers.map((item) => (
                      <label key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        border: selectedWhatsappId === item.id ? "1px solid #16803d" : "1px solid #e3e9e3",
                        borderRadius: 12, padding: 14, cursor: "pointer",
                      }}>
                        <input
                          type="radio"
                          name="whatsapp-number"
                          value={item.id}
                          checked={selectedWhatsappId === item.id}
                          onChange={() => setSelectedWhatsappId(item.id)}
                        />
                        <span>
                          <strong>{item.label}</strong>
                          <span style={{ display: "block", color: "#647067", fontSize: 13 }}>
                            {item.number}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {submitError && (
                <p role="alert" style={{ color: "#b42318", fontSize: 14 }}>
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || items.length === 0 || !!loadError || whatsappLoading || whatsappNumbers.length === 0 || !selectedWhatsappId}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 12,
                  padding: 16,
                  background: submitting ? "#86a98f" : "#16803d",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting
                  ? en
                    ? "Submitting order..."
                    : "অর্ডার জমা হচ্ছে..."
                  : en
                    ? "Continue to place order"
                    : "অর্ডার করার জন্য এগিয়ে যান"}
              </button>

              <p style={{ fontSize: 12, color: "#647067", lineHeight: 1.6 }}>
                {en
                  ? "Your order will be saved before WhatsApp opens. Please review the order message and press Send in WhatsApp."
                  : "WhatsApp খোলার আগে আপনার অর্ডার সংরক্ষণ করা হবে। WhatsApp-এ অর্ডারটি দেখে Send চাপুন।"}
              </p>
            </form>

            <aside style={card}>
              <h2 style={{ fontSize: 19, marginTop: 0 }}>
                {en ? "Order summary" : "অর্ডারের সারাংশ"}
              </h2>

              {items.map((product) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: "13px 0",
                    borderBottom: "1px solid #edf0ed",
                  }}
                >
                  <Image
                    src={product.imageUrl}
                    alt={en ? product.english : product.name}
                    width={54}
                    height={54}
                    sizes="54px"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 10,
                      objectFit: "cover",
                      background: "#f0f6ef",
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>
                      {en ? product.english : product.name}
                    </strong>
                    <div
                      style={{
                        color: "#647067",
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {en ? "Qty" : "পরিমাণ"}: {cart[product.id]} {product.unit || "পিস"}
                    </div>
                    <div style={{ color: "#647067", fontSize: 12 }}>
                      {money(product.price)} {en ? `per ${product.unit || "piece"}` : `প্রতি ${product.unit || "পিস"}`}
                    </div>
                  </div>

                  <strong style={{ whiteSpace: "nowrap" }}>
                    {money(product.price * cart[product.id])}
                  </strong>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 18,
                }}
              >
                <span>{en ? "Total items" : "মোট পণ্য"}</span>
                <strong>{quantity}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 14,
                }}
              >
                <span>{en ? "Delivery charge" : "ডেলিভারি চার্জ"}</span>
                <span>{en ? "To be confirmed" : "পরে নিশ্চিত হবে"}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  borderTop: "1px solid #e3e9e3",
                  marginTop: 18,
                  paddingTop: 18,
                  fontSize: 18,
                }}
              >
                <strong>{en ? "Subtotal" : "পণ্যের মোট দাম"}</strong>
                <strong style={{ color: "#16803d" }}>{money(total)}</strong>
              </div>

              <p style={{ fontSize: 12, color: "#647067", lineHeight: 1.6 }}>
                {en
                  ? "Delivery charges, if any, will be confirmed before the order is finalized."
                  : "ডেলিভারি চার্জ থাকলে অর্ডার চূড়ান্ত করার আগে জানানো হবে।"}
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
