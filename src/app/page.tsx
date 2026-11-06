
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import SiteNavigation from "@/components/site-navigation";
import SiteFooter from "@/components/site-footer";

type Product = {
  id: string;
  name: string;
  english: string;
  description: string;
  englishDescription: string;
  category: string;
  price: number;
  oldPrice: number;
  imageUrl: string;
  stock: number;
  special: boolean;
  color?: string;
  emoji?: string;
};

type Category = {
  id: string;
  bn: string;
  en: string;
  icon: string;
  color: string;
  description: string;
  discount?: string;
  offer?: string;
};

type SpecialBanner = {
  imageUrl: string;
  name: string;
};

const CATEGORY_ORDER = [
  "mc1000",
  "food", "vegetables", "fish", "meat", "fruits",
  "spices", "snacks", "dairy", "frozen", "drinks",
  "fashion", "women-fashion", "kids", "accessories",
  "beauty", "electronics", "appliances", "kitchen",
  "cleaning", "home", "stationery", "toys", "sports",
  "tools", "misc",
];

const CATEGORY_COLORS: Record<string, string> = {
  food: "#e3f4e7",
  vegetables: "#e5f4d9",
  fish: "#e2f2fc",
  meat: "#fde8e7",
  fruits: "#fff0e0",
  spices: "#fff2d9",
  snacks: "#fce7f3",
  dairy: "#e8f2ff",
  frozen: "#e0f7fa",
  drinks: "#e0f2fe",
  fashion: "#f3e8ff",
  "women-fashion": "#fce7f3",
  kids: "#fef3c7",
  accessories: "#ede9fe",
  beauty: "#fce7f3",
  electronics: "#e0e7ff",
  appliances: "#e5e7eb",
  kitchen: "#ffedd5",
  cleaning: "#dbeafe",
  home: "#dcfce7",
  stationery: "#fef9c3",
  toys: "#fce7f3",
  sports: "#dcfce7",
  tools: "#e5e7eb",
  misc: "#f3f4f6",
};

const CATEGORY_TEXT_COLORS: Record<string, string> = {
  food: "#17653b",
  vegetables: "#416c1c",
  fish: "#175b88",
  meat: "#a52b2b",
  fruits: "#9a4b0a",
  spices: "#865515",
  snacks: "#9d174d",
  dairy: "#1d4e89",
  frozen: "#0e7490",
  drinks: "#075985",
  fashion: "#6b21a8",
  "women-fashion": "#9d174d",
  kids: "#92400e",
  accessories: "#5b21b6",
  beauty: "#9d174d",
  electronics: "#3730a3",
  appliances: "#374151",
  kitchen: "#9a3412",
  cleaning: "#1d4ed8",
  home: "#166534",
  stationery: "#854d0e",
  toys: "#9d174d",
  sports: "#166534",
  tools: "#374151",
  misc: "#4b5563",
};

function money(value: number, language: string) {
  return `৳${value.toLocaleString(
    language === "bn" ? "bn-BD" : "en-US",
    { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  )}`;
}

function getDiscount(product: Product) {
  if (
    !Number.isFinite(product.price) ||
    !Number.isFinite(product.oldPrice) ||
    product.oldPrice <= product.price ||
    product.oldPrice <= 0
  ) {
    return 0;
  }

  return Math.round(
    ((product.oldPrice - product.price) / product.oldPrice) * 1000
  ) / 10;
}

export default function HomePage() {
  const router = useRouter();
  const { language, setLanguage, theme, setTheme } = useLanguage();
  const en = language === "en";
  const [menuOpen, setMenuOpen] = useState(false);
  const [customer, setCustomer] = useState<{
    name: string;
    mobile: string;
    email: string;
    photoURL: string;
  } | null>(null);
  const [customerChecked, setCustomerChecked] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomerSession() {
      try {
        const response = await fetch("/api/customer/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data.success && data.customer) {
          setCustomer({
            name: typeof data.customer.name === "string" ? data.customer.name : "",
            mobile: typeof data.customer.mobile === "string" ? data.customer.mobile : "",
            email: typeof data.customer.email === "string" ? data.customer.email : "",
            photoURL: typeof data.customer.photoURL === "string" ? data.customer.photoURL : "",
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[Customer Session]", error);
        }
      } finally {
        if (!controller.signal.aborted) setCustomerChecked(true);
      }
    }

    void loadCustomerSession();
    return () => controller.abort();
  }, []);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Record<string, SpecialBanner>>({});
  const [siteLogo, setSiteLogo] = useState("/logo.png");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSiteLogo() {
      try {
        const response = await fetch("/api/site-settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setSiteLogo(data.branding?.logo?.imageUrl || "/logo.png");
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[Homepage Logo]", error);
        }
      }
    }

    void loadSiteLogo();
    return () => controller.abort();
  }, []);

  const [storeLoading, setStoreLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [pendingReview, setPendingReview] = useState<{
    orderId: string;
    token: string;
    items: { name: string }[];
  } | null>(null);

  const offerTrack = useRef<HTMLDivElement | null>(null);
  const categoryTrack = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem("mukt-bazar-cart");
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            setCart(parsed as Record<string, number>);
          }
        }
      } catch {
        // Keep the cart empty if saved data is invalid.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let checking = false;

    async function checkPendingReview() {
      if (cancelled || checking || document.visibilityState === "hidden") return;
      checking = true;

      try {
        const saved = localStorage.getItem("mukt-bazar-review-access");
        if (!saved) return;

        const accesses = JSON.parse(saved);
        if (!Array.isArray(accesses)) return;

        const available = accesses.filter((item) =>
          item &&
          typeof item.orderId === "string" &&
          typeof item.token === "string" &&
          !localStorage.getItem(`mukt-bazar-review-dismissed:${item.orderId}`)
        );

        if (!available.length) return;

        const response = await fetch("/api/reviews/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accesses: available }),
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled || !response.ok || !data.pending) return;

        localStorage.setItem(
          `mukt-bazar-review-dismissed:${data.pending.orderId}`,
          "1"
        );
        setPendingReview(data.pending);
      } catch {
        // Review prompt is optional; keep the homepage working.
      } finally {
        checking = false;
      }
    }

    checkPendingReview();
    const interval = window.setInterval(checkPendingReview, 5000);
    window.addEventListener("focus", checkPendingReview);
    document.addEventListener("visibilitychange", checkPendingReview);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkPendingReview);
      document.removeEventListener("visibilitychange", checkPendingReview);
    };
  }, []);

  useEffect(() => {
    if (!pendingReview) return;
    const timer = window.setTimeout(() => setPendingReview(null), 30000);
    return () => window.clearTimeout(timer);
  }, [pendingReview]);

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      setStoreLoading(true);

      try {
        const response = await fetch("/api/store", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || data.success !== true) {
          throw new Error("Store data could not be loaded");
        }

        if (cancelled) return;

        const loadedCategories: Category[] = (
          data.categories as Category[]
        )
          .filter((category) => category.id)
          .map((category) => ({
            ...category,
            color:
              CATEGORY_COLORS[category.id] ||
              category.color ||
              "#f3f4f6",
          }))
          .sort((a, b) => {
            const ai = CATEGORY_ORDER.indexOf(a.id);
            const bi = CATEGORY_ORDER.indexOf(b.id);

            if (ai === -1 && bi === -1) {
              return a.id.localeCompare(b.id);
            }

            if (ai === -1) return 1;
            if (bi === -1) return -1;

            return ai - bi;
          });

        const loadedProducts: Product[] = (
          data.products as Product[]
        )
          .filter(
            (product) =>
              product.id &&
              product.category &&
              product.imageUrl &&
              product.stock > 0
          )
          .map((product) => ({
            ...product,
            color: "#f0fdf4",
            emoji: "🛍️",
          }));

        setCategories(loadedCategories);
        setProducts(loadedProducts);
        setBanners(
          data.specialBanners &&
          typeof data.specialBanners === "object"
            ? data.specialBanners as Record<string, SpecialBanner>
            : {}
        );
        setNotice("");
      } catch {
        if (!cancelled) {
          setCategories([]);
          setProducts([]);
          setNotice(
            en
              ? "Store data could not be loaded."
              : "দোকানের তথ্য লোড করা যায়নি।"
          );
        }
      } finally {
        if (!cancelled) setStoreLoading(false);
      }
    }

    loadStore();

    return () => {
      cancelled = true;
    };
  }, [en]);

const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" ||
        product.category === activeCategory;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.english.toLowerCase().includes(query) ||
        product.id.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, activeCategory]);

  const cartCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );

  async function addToCart(product: Product) {
    const quantity = (cart[product.id] || 0) + 1;

    if (quantity > 99 || quantity > product.stock) {
      setNotice(en ? "No more stock available." : "আর স্টক নেই।");
      return;
    }

    try {
      const response = await fetch("/api/cart/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, quantity }),
      });
      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Reservation failed");
      }

      const next = { ...cart, [product.id]: quantity };

      try {
        localStorage.setItem("mukt-bazar-cart", JSON.stringify(next));
      } catch {
        await fetch(
          `/api/cart/reservations?id=${encodeURIComponent(product.id)}`,
          { method: "DELETE" }
        );
        throw new Error(
          en ? "Could not save cart." : "কার্ট সংরক্ষণ করা যায়নি।"
        );
      }

      setCart(next);
      setNotice(
        en
          ? `${product.english} added to cart`
          : `${product.name} কার্টে যোগ হয়েছে`
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : (en ? "Stock reservation failed." : "স্টক সংরক্ষণ করা যায়নি।")
      );
    }
  }

  function showCategory(categoryId: string) {
    setActiveCategory(categoryId);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function productCard(product: Product) {
    const discount = getDiscount(product);

    return (
      <article
        className="mb-product-card"
        key={product.id}
        role="link"
        tabIndex={0}
        onClick={() => {
          router.push(`/products/${encodeURIComponent(product.id)}`);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            router.push(`/products/${encodeURIComponent(product.id)}`);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <div
          className="mb-product-image"
          style={{
            background:
              CATEGORY_COLORS[product.category] || "#f0fdf4",
            position: "relative",
          }}
        >
          {discount > 0 && (
            <span className="mb-discount-badge">
              {discount}% {en ? "OFF" : "ছাড়"}
            </span>
          )}

          <Image
            src={product.imageUrl}
            alt={en ? product.english : product.name}
            width={300}
            height={300}
            sizes="(max-width: 600px) 45vw, 220px"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          <span className="mb-product-id">{product.id}</span>
        </div>

        <div className="mb-product-info">
          <span className="mb-product-category">
            {categories.find(
              (item) => item.id === product.category
            )?.[en ? "en" : "bn"]}
          </span>

          <h3>{en ? product.english : product.name}</h3>

          <div className="mb-price-row">
            <strong>{money(product.price, language)}</strong>

            {discount > 0 && (
              <del>{money(product.oldPrice, language)}</del>
            )}
          </div>

          <button
            type="button"
            className="mb-add-button"
            onClick={(event) => {
              event.stopPropagation();
              addToCart(product);
            }}
          >
            <span>＋</span>{" "}
            {en ? "Add to cart" : "কার্টে যোগ করুন"}
          </button>
        </div>
      </article>
    );
  }

  function categoryOfferCard(category: Category, copy = 0) {
    const categoryProducts = products.filter(
      (product) => product.category === category.id
    );

    const discountedProduct = categoryProducts.find(
      (product) => getDiscount(product) > 0
    );
    const banner = banners[category.id];

    const color =
      CATEGORY_COLORS[category.id] ||
      category.color ||
      "#f3f4f6";

    const textColor =
      CATEGORY_TEXT_COLORS[category.id] || "#374151";

    return (
      <article
        key={`${category.id}-${copy}`}
        className="mb-home-offer-card"
        style={{
          background: color,
          border: "1px solid #e2ece4",
          cursor: "pointer",
        }}
        onClick={() => {
          if (banner) {
            showCategory(category.id);
          } else if (discountedProduct) {
            router.push(`/products/${encodeURIComponent(discountedProduct.id)}`);
          } else {
            showCategory(category.id);
          }
        }}
      >
        {banner ? (
          <div
            className="mb-home-offer-image mb-home-offer-banner-image"
            style={{ background: "#fff" }}
          >
            <Image
              src={banner.imageUrl}
              alt={banner.name || category[en ? "en" : "bn"]}
              width={640}
              height={900}
              sizes="(max-width: 600px) 80vw, 320px"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        ) : discountedProduct ? (
          <>
            <div className="mb-home-offer-image">
              <span
                className="mb-discount-badge"
                style={{
                  top: 8,
                  left: 8,
                  right: "auto",
                  borderRadius: 7,
                  padding: "4px 7px",
                  fontSize: 11,
                  lineHeight: 1.2,
                  boxShadow: "0 2px 7px #00000020",
                }}
              >
                {getDiscount(discountedProduct)}%{" "}
                {en ? "OFF" : "ছাড়"}
              </span>

              <Image
                src={discountedProduct.imageUrl}
                alt={en ? discountedProduct.english : discountedProduct.name}
                width={300}
                height={300}
                sizes="(max-width: 600px) 80vw, 300px"
              />
            </div>

            <div className="mb-home-offer-info">
              <h3>
                {en
                  ? discountedProduct.english
                  : discountedProduct.name}
              </h3>

              <div className="mb-price-row">
                <strong>
                  {money(discountedProduct.price, language)}
                </strong>
                <del>
                  {money(discountedProduct.oldPrice, language)}
                </del>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="mb-home-offer-empty"
            onClick={() => showCategory(category.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              height: "100%",
              minHeight: 130,
              padding: 14,
              border: 0,
              background: "transparent",
              color: textColor,
              textAlign: "start",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "#ffffffa8",
                fontSize: 23,
              }}
            >
              {category.icon || "🛍️"}
            </span>

            <strong style={{ fontSize: 15 }}>
              {category[en ? "en" : "bn"]}
            </strong>

            <span style={{ fontSize: 11, lineHeight: 1.5 }}>
              {en
                ? categoryProducts.length
                  ? "Offers coming soon"
                  : "Products coming soon"
                : categoryProducts.length
                  ? "শিগগিরই অফার দেখা যাবে"
                  : "শিগগিরই পণ্য যোগ করা হবে"}
            </span>
          </button>
        )}
      </article>
    );
  }

  function categorySection(category: Category) {
    const categoryProducts = products.filter(
      (product) => product.category === category.id
    );

    const discountedProduct = categoryProducts.find(
      (product) => getDiscount(product) > 0
    );

    const color =
      CATEGORY_COLORS[category.id] ||
      category.color ||
      "#f3f4f6";

    const textColor =
      CATEGORY_TEXT_COLORS[category.id] || "#374151";

    return (
      <section
        className="mb-home-section"
        key={category.id}
        style={{ scrollMarginTop: 20 }}
      >
        <div className="mb-home-section-heading">
          <div>
            <span className="mb-eyebrow">
              {category.id.toUpperCase()}
            </span>

            <h2>
              {category.icon || "🛍️"}{" "}
              {category[en ? "en" : "bn"]}
            </h2>
          </div>

          <button
            type="button"
            className="mb-text-link"
            onClick={() => showCategory(category.id)}
          >
            {en ? "View all →" : "সব দেখুন →"}
          </button>
        </div>

        <div
          style={{
            background: color,
            color: textColor,
            borderRadius: 16,
            padding: "14px 16px",
            marginBottom: 12,
            border: "1px solid #00000008",
          }}
        >
          {discountedProduct ? (
            <button
              type="button"
              onClick={() => {
                router.push(`/products/${encodeURIComponent(discountedProduct.id)}`);
              }}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 12,
                border: 0,
                padding: 0,
                background: "transparent",
                color: "inherit",
                textAlign: "start",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 28 }}>
                {category.icon || "🎁"}
              </span>

              <span style={{ flex: 1 }}>
                <strong style={{ display: "block" }}>
                  {en
                    ? `${category.en} special offer`
                    : `${category.bn} ক্যাটাগরির অফার`}
                </strong>

                <span style={{ fontSize: 12 }}>
                  {en
                    ? `${getDiscount(discountedProduct)}% off`
                    : `${getDiscount(discountedProduct)}% ছাড়ে কিনুন`}
                </span>
              </span>

              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div>
              <strong>
                {category.icon || "🛍️"}{" "}
                {en
                  ? `${category.en} offers`
                  : `${category.bn} ক্যাটাগরির অফার`}
              </strong>

              <p style={{ margin: "5px 0 0", fontSize: 12 }}>
                {en
                  ? "Offers coming soon"
                  : "শিগগিরই অফার দেখা যাবে"}
              </p>
            </div>
          )}
        </div>

        {categoryProducts.length > 0 ? (
          <div className="mb-product-slider">
            {categoryProducts.map(productCard)}
          </div>
        ) : (
          <div
            style={{
              background: color,
              color: textColor,
              border: "1px dashed #00000020",
              borderRadius: 14,
              padding: "20px 14px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 7 }}>
              {category.icon || "📦"}
            </div>

            <strong>
              {en
                ? `${category.en} products coming soon`
                : `${category.bn} ক্যাটাগরিতে পণ্য শিগগিরই যোগ করা হবে`}
            </strong>

            <p style={{ margin: "6px 0 0", fontSize: 12 }}>
              {en
                ? "Products will appear here when added by the admin."
                : "অ্যাডমিন পণ্য যোগ করলে এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।"}
            </p>
          </div>
        )}
      </section>
    );
  }

  useEffect(() => {
    function startAutoSlide(
      ref: React.RefObject<HTMLDivElement | null>,
      dependency: number
    ) {
      const track = ref.current;
      if (!track || dependency < 2) return;

      let frame = 0;
      let previous = 0;

      const animate = (time: number) => {
        if (previous) {
          const half = track.scrollWidth / 2;
          if (half > 0) {
            track.scrollLeft += Math.min(time - previous, 40) * 0.025;
            if (track.scrollLeft >= half) {
              track.scrollLeft -= half;
            }
          }
        }

        previous = time;
        frame = requestAnimationFrame(animate);
      };

      frame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frame);
    }

    const stopOffers = startAutoSlide(offerTrack, categories.length);
    const stopCategories = startAutoSlide(categoryTrack, categories.length);

    return () => {
      stopOffers?.();
      stopCategories?.();
    };
  }, [categories.length]);

  return (
    <main className="mb-store mb-home-clean">
      <div className="mb-announcement">
        <span>✦</span>
        {en
          ? "Great deals, happy shopping! Cash on Delivery available"
          : "দারুণ অফার, আনন্দের কেনাকাটা! ক্যাশ অন ডেলিভারি সুবিধা"}
        <span>✦</span>
      </div>

      <header className="mb-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button type="button" onClick={() => setMenuOpen(true)}
            aria-label={en ? "Open menu" : "মেনু খুলুন"}
            aria-expanded={menuOpen}
            style={{ width: 40, height: 40, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 10, background: "white", color: "var(--green-dark)", fontSize: 25, lineHeight: 1, cursor: "pointer" }}>☰</button>
        <Link
          className="mb-brand"
          href="/"
          aria-label="Mukt Bazar home"
        >
          <Image
            src={siteLogo}
            alt="মুক্ত বাজার"
            width={58}
            height={58}
            className="mb-brand-logo"
          />
          <span>
            <strong>মুক্ত বাজার</strong>
            <small>MUKT BAZAR</small>
          </span>
        </Link>
        </div>

        <div className="mb-search">
          <span aria-hidden="true">⌕</span>

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveCategory("all");
            }}
            placeholder={en ? "Search products..." : "পণ্য খুঁজুন..."}
            aria-label={en ? "Search products" : "পণ্য খুঁজুন"}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={en ? "Clear search" : "সার্চ মুছুন"}
            >
              ×
            </button>
          )}
        </div>

        <div className="mb-header-actions">
          <button
            type="button"
            className="mb-language"
            onClick={() => setLanguage(en ? "bn" : "en")}
            aria-label="Change language"
          >
            <span>文</span> {en ? "বাংলা" : "English"}
          </button>

          <button
            type="button"
            className="mb-cart-button"
            onClick={() => {
              router.push("/cart");
            }}
          >
            <span className="mb-cart-icon">🛒</span>
            <span className="mb-cart-label">
              {en ? "Cart" : "কার্ট"}
            </span>
            <span className="mb-cart-count">{cartCount}</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)", display: "flex" }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={en ? "Main menu" : "প্রধান মেনু"}
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(340px, 88vw)", height: "100%", padding: 18, boxSizing: "border-box", background: "white", color: "#183b29", boxShadow: "4px 0 24px rgba(0,0,0,.15)", overflowY: "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid #e5e7eb" }}>
              <strong style={{ fontSize: 19 }}>{en ? "Menu" : "মেনু"}</strong>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={en ? "Close menu" : "মেনু বন্ধ করুন"}
                style={{ border: 0, background: "transparent", fontSize: 27, cursor: "pointer" }}
              >×</button>
            </div>

            <section style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 12px", marginTop: 14, borderRadius: 13, background: "#edf6ef" }}>
              {customer?.photoURL ? (
                <Image
                  src={customer.photoURL}
                  alt={en ? "Profile photo" : "প্রোফাইল ছবি"}
                  width={54}
                  height={54}
                  unoptimized
                  style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: 54, height: 54, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", background: "#d5e9d9", color: "#176b43", fontSize: 25, fontWeight: 800 }}>
                  {customer?.name?.trim()?.charAt(0)?.toUpperCase() || "👤"}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block", fontSize: 15 }}>
                  {!customerChecked
                    ? (en ? "Checking account..." : "অ্যাকাউন্ট যাচাই হচ্ছে...")
                    : customer
                      ? customer.name
                      : (en ? "Guest User" : "অতিথি ব্যবহারকারী")}
                </strong>
                <span style={{ display: "block", marginTop: 4, color: "#647067", fontSize: 12, overflowWrap: "anywhere" }}>
                  {customer
                    ? customer.mobile
                    : customerChecked
                      ? (en ? "Login or register to access your account" : "অ্যাকাউন্ট খুলতে লগইন বা রেজিস্ট্রেশন করুন")
                      : ""}
                </span>
              </div>
            </section>

            {customer ? (
              <button
                type="button"
                disabled
                style={{ width: "100%", marginTop: 8, padding: 12, border: "1px solid #dce6dc", borderRadius: 9, background: "#fff", color: "#788178", textAlign: "left", fontWeight: 700 }}
              >
                {en ? "Edit Profile — Coming soon" : "প্রোফাইল সম্পাদনা — শীঘ্রই"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <Link
                  href="/account/register"
                  onClick={() => setMenuOpen(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 9, background: "#176b43", color: "white", textAlign: "center", fontWeight: 700, textDecoration: "none", fontSize: 13 }}
                >
                  {en ? "Register" : "রেজিস্ট্রেশন"}
                </Link>
                <Link
                  href="/account/login"
                  onClick={() => setMenuOpen(false)}
                  style={{ flex: 1, padding: 12, border: "1px solid #176b43", borderRadius: 9, background: "white", color: "#176b43", textAlign: "center", fontWeight: 700, textDecoration: "none", fontSize: 13 }}
                >
                  {en ? "Login" : "লগইন"}
                </Link>
              </div>
            )}

            <div style={{ height: 1, background: "#e5e7eb", margin: "17px 0 10px" }} />

            <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Link href="/" onClick={() => setMenuOpen(false)} style={{ padding: 12, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                🏠　{en ? "Home" : "হোম"}
              </Link>

              <Link href="/account/orders" onClick={() => setMenuOpen(false)} style={{ padding: 12, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                📋　{en ? "Orders" : "অর্ডার"}
              </Link>

              <Link href="/track-order" onClick={() => setMenuOpen(false)} style={{ padding: 12, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                📦　{en ? "Track Order" : "অর্ডার ট্র্যাক করুন"}
              </Link>

              <Link href="/delivery-reviews" onClick={() => setMenuOpen(false)} style={{ padding: 12, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                ⭐　{en ? "Delivery Reviews" : "ডেলিভারি রিভিউ"}
              </Link>

              <div style={{ marginTop: 5, padding: 12, border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontWeight: 700 }}>
                🎨　{en ? "Choose Theme" : "থিম নির্বাচন করুন"}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    aria-pressed={theme === "light"}
                    style={{ flex: 1, padding: 10, border: theme === "light" ? "2px solid var(--green)" : "1px solid var(--border)", borderRadius: 8, background: theme === "light" ? "var(--green-light)" : "var(--white)", color: "var(--text)", fontWeight: 700 }}
                  >
                    ☀️ {en ? "White" : "সাদা"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    aria-pressed={theme === "dark"}
                    style={{ flex: 1, padding: 10, border: theme === "dark" ? "2px solid var(--green)" : "1px solid var(--border)", borderRadius: 8, background: theme === "dark" ? "var(--green-light)" : "var(--white)", color: "var(--text)", fontWeight: 700 }}
                  >
                    🌙 {en ? "Dark" : "ডার্ক"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLanguage(en ? "bn" : "en")}
                style={{ padding: 12, border: "1px solid #dce6dc", borderRadius: 9, background: "white", color: "#176b43", textAlign: "left", fontWeight: 700 }}
              >
                文　{en ? "বাংলা ভাষা" : "English"}
              </button>

              <div style={{ marginTop: 5, padding: "10px 12px 5px", color: "#647067", fontSize: 12, fontWeight: 800 }}>
                {en ? "WEBSITE INFO" : "ওয়েবসাইট তথ্য"}
              </div>
              <Link href="/info/about" onClick={() => setMenuOpen(false)} style={{ padding: 11, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                {en ? "About Us" : "আমাদের সম্পর্কে"}
              </Link>
              <Link href="/info/contact" onClick={() => setMenuOpen(false)} style={{ padding: 11, borderRadius: 9, background: "#f5f8f5", color: "#176b43", fontWeight: 700, textDecoration: "none" }}>
                {en ? "Contact Us" : "যোগাযোগ করুন"}
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {storeLoading ? (
        <section className="mb-section">
          <div className="mb-empty">
            {en ? "Loading products..." : "পণ্য লোড হচ্ছে..."}
          </div>
        </section>
      ) : search || activeCategory !== "all" ? (
        <section className="mb-section mb-home-results">
          <div className="mb-section-heading">
            <div>
              <span className="mb-eyebrow">
                {search
                  ? en
                    ? "SEARCH RESULTS"
                    : "অনুসন্ধানের ফলাফল"
                  : en
                    ? "EXPLORE CATEGORY"
                    : "ক্যাটাগরি দেখুন"}
              </span>

              <h2>
                {search
                  ? en
                    ? "Products you searched for"
                    : "আপনার খোঁজা পণ্য"
                  : categories.find(
                      (item) => item.id === activeCategory
                    )?.[en ? "en" : "bn"]}
              </h2>
            </div>

            <button
              type="button"
              className="mb-text-link"
              onClick={() => showCategory("all")}
            >
              {en ? "← Home" : "← হোমে ফিরুন"}
            </button>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="mb-product-grid">
              {filteredProducts.map(productCard)}
            </div>
          ) : (
            <div className="mb-empty">
              {en
                ? "No products found."
                : "কোনো পণ্য পাওয়া যায়নি।"}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="mb-home-section mb-home-offers-section">
            <div className="mb-home-section-heading">
              <div>
                <span className="mb-eyebrow">
                  {en ? "SPECIAL OFFERS" : "বিশেষ অফার"}
                </span>
                <h2>
                  {en ? "Offers for you" : "আপনার জন্য অফার"}
                </h2>
              </div>
            </div>

            {categories.length > 0 ? (
              <div
                className="mb-home-offer-track"
                ref={offerTrack}
              >
                {categories.map((category) => categoryOfferCard(category, 0))}
                {categories.map((category) => categoryOfferCard(category, 1))}
              </div>
            ) : (
              <div className="mb-empty">
                {en
                  ? "No active categories available."
                  : "কোনো সক্রিয় ক্যাটাগরি নেই।"}
              </div>
            )}
          </section>

          <section className="mb-home-section mb-home-categories-section">
            <div className="mb-home-section-heading">
              <div>
                <span className="mb-eyebrow">
                  {en ? "SHOP BY CATEGORY" : "ক্যাটাগরি অনুযায়ী কেনাকাটা"}
                </span>
                <h2>
                  {en ? "Browse categories" : "ক্যাটাগরি বেছে নিন"}
                </h2>
              </div>
            </div>

            {categories.length > 0 ? (
              <div
                className="mb-home-category-track"
                ref={categoryTrack}
              >
                {[0, 1].map((copy) => categories.map((category) => (
                  <button
                    type="button"
                    className="mb-home-category-card"
                    key={`${category.id}-${copy}`}
                    onClick={() => showCategory(category.id)}
                  >
                    <span
                      className="mb-home-category-icon"
                      style={{
                        background:
                          CATEGORY_COLORS[category.id] || "#e9f5eb",
                      }}
                    >
                      {category.icon || "🛍️"}
                    </span>

                    <span className="mb-home-category-name">
                      {category[en ? "en" : "bn"]}
                    </span>
                  </button>
                )))}
              </div>
            ) : (
              <div className="mb-empty">
                {en
                  ? "No active categories available."
                  : "কোনো সক্রিয় ক্যাটাগরি নেই।"}
              </div>
            )}
          </section>

          {categories.map(categorySection)}
        </>
      )}

      {pendingReview && (
        <div
          role="presentation"
          onClick={() => setPendingReview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={en ? "Share your review" : "আপনার রিভিউ দিন"}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#fff",
              color: "#183b2b",
              borderRadius: "18px",
              padding: "22px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "32px" }}>⭐</div>
            <h2 style={{ margin: "8px 0", fontSize: "20px" }}>
              {en ? "How was your order?" : "আপনার অর্ডারটি কেমন ছিল?"}
            </h2>
            <p style={{ margin: "0 0 16px", color: "#64748b" }}>
              {en
                ? "Your feedback helps us improve."
                : "আপনার মতামত আমাদের আরও ভালো হতে সাহায্য করবে।"}
            </p>
            <a
              href={`/review?orderId=${encodeURIComponent(pendingReview.orderId)}&token=${encodeURIComponent(pendingReview.token)}`}
              style={{
                display: "block",
                padding: "12px",
                borderRadius: "10px",
                background: "#176b43",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {en ? "Write a review" : "রিভিউ দিন"}
            </a>
            <button
              type="button"
              onClick={() => setPendingReview(null)}
              style={{
                marginTop: "10px",
                border: 0,
                background: "transparent",
                color: "#64748b",
                padding: "8px 16px",
              }}
            >
              {en ? "Maybe later" : "পরে দেব"}
            </button>
          </section>
        </div>
      )}

      <SiteNavigation />
      <SiteFooter />

      {notice && (
        <button
          type="button"
          className="mb-toast"
          role="status"
          onClick={() => setNotice("")}
        >
          {notice} ×
        </button>
      )}
    </main>
  );
}
