
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  productId?: string;
  name: string;
  english?: string;
  category?: string;
  price?: number;
  stock?: number;
  unit?: string;
  imageUrl?: string;
  published?: boolean;
};

type Category = {
  id?: string;
  categoryId?: string;
  name?: string;
  english?: string;
  active?: boolean;
};

const CATEGORY_NAMES: Record<string, string> = {
  food: "খাবার",
  vegetables: "শাকসবজি",
  fish: "মাছ",
  meat: "মাংস",
  fruits: "ফল",
  spices: "মসলা",
  snacks: "স্ন্যাকস",
  dairy: "দুগ্ধজাত",
  frozen: "হিমায়িত খাবার",
  drinks: "পানীয়",
  fashion: "ফ্যাশন",
  "women-fashion": "নারীদের পোশাক",
  kids: "শিশুদের পণ্য",
  accessories: "অ্যাক্সেসরিজ",
  beauty: "বিউটি ও কসমেটিকস",
  electronics: "ইলেকট্রনিকস",
  appliances: "গৃহস্থালি যন্ত্রপাতি",
  kitchen: "রান্নাঘর",
  cleaning: "পরিষ্কার-পরিচ্ছন্নতা",
  home: "ঘর সাজানোর পণ্য",
  stationery: "স্টেশনারি",
  toys: "খেলনা",
  sports: "খেলাধুলা",
  tools: "যন্ত্রপাতি",
  misc: "অন্যান্য",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_NAMES);

function getStock(product: Product) {
  const value = Number(product.stock ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getCategory(product: Product) {
  return product.category || "misc";
}

function isValidImage(url?: string) {
  return Boolean(
    url &&
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(url)
  );
}

export default function AdminStockPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [productResponse, categoryResponse] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/categories", { cache: "no-store" }),
      ]);

      const productData = await productResponse.json();
      const categoryData = await categoryResponse.json();

      if (!productResponse.ok) {
        throw new Error(productData.error || "পণ্যের তালিকা লোড হয়নি।");
      }

      const productList = Array.isArray(productData)
        ? productData
        : productData.products;

      setProducts(Array.isArray(productList) ? productList : []);

      const categoryList = Array.isArray(categoryData)
        ? categoryData
        : categoryData.categories;

      setCategories(Array.isArray(categoryList) ? categoryList : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "তথ্য লোড করতে সমস্যা হয়েছে।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  const categoryName = useCallback(
    (id: string) => {
      const category = categories.find(
        (item) => (item.id || item.categoryId) === id
      );

      return (
        category?.name ||
        CATEGORY_NAMES[id] ||
        id
      );
    },
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...products]
      .filter((product) => {
        const matchesSearch =
          !query ||
          product.name?.toLowerCase().includes(query) ||
          product.english?.toLowerCase().includes(query) ||
          product.productId?.toLowerCase().includes(query) ||
          product.id?.toLowerCase().includes(query);

        const matchesCategory =
          categoryFilter === "all" ||
          getCategory(product) === categoryFilter;

        const stock = getStock(product);
        const matchesStock =
          stockFilter === "all" ||
          (stockFilter === "zero" && stock <= 0) ||
          (stockFilter === "low" && stock > 0 && stock < 10) ||
          (stockFilter === "available" && stock >= 10);

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        const categoryDifference =
          CATEGORY_ORDER.indexOf(getCategory(a)) -
          CATEGORY_ORDER.indexOf(getCategory(b));

        if (
          categoryDifference !== 0 &&
          CATEGORY_ORDER.includes(getCategory(a)) &&
          CATEGORY_ORDER.includes(getCategory(b))
        ) {
          return categoryDifference;
        }

        return a.name.localeCompare(b.name, "bn");
      });
  }, [products, search, categoryFilter, stockFilter]);

  const summary = useMemo(
    () => ({
      total: products.length,
      zero: products.filter((p) => getStock(p) <= 0).length,
      low: products.filter(
        (p) => getStock(p) > 0 && getStock(p) < 10
      ).length,
      published: products.filter((p) => p.published).length,
    }),
    [products]
  );

  const categorySummary = useMemo(
    () =>
      CATEGORY_ORDER.map((id) => ({
        id,
        name: categoryName(id),
        total: products.filter((p) => getCategory(p) === id).length,
        zero: products.filter(
          (p) => getCategory(p) === id && getStock(p) <= 0
        ).length,
        low: products.filter(
          (p) =>
            getCategory(p) === id &&
            getStock(p) > 0 &&
            getStock(p) < 10
        ).length,
      })),
    [products, categoryName]
  );

  async function updateStock(
    product: Product,
    mode: "increase" | "decrease"
  ) {
    const amount = Number(amounts[product.id] || 1);

    if (!Number.isSafeInteger(amount) || amount < 1) {
      setError("সঠিক পরিমাণ লিখুন।");
      return;
    }

    if (mode === "decrease" && amount > getStock(product)) {
      setError("বর্তমান স্টকের চেয়ে বেশি কমানো যাবে না।");
      return;
    }

    const actionText = mode === "increase" ? "বাড়াতে" : "কমানোর";
    const confirmed = window.confirm(
      `${product.name} পণ্যের স্টক ${amount} ${product.unit || 'পিস'} ${actionText} চান?`
    );

    if (!confirmed) return;

    setBusyId(product.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          mode,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "স্টক আপডেট করা যায়নি।");
      }

      setNotice(
        `${product.name}: স্টক ${amount} ${product.unit || "পিস"} ${mode === "increase" ? "বাড়ানো" : "কমানো"} হয়েছে।`
      );

      setAmounts((previous) => ({
        ...previous,
        [product.id]: "",
      }));

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "স্টক আপডেটে সমস্যা হয়েছে।"
      );
    } finally {
      setBusyId("");
    }
  }

  function openProductEditor(product: Product) {
    router.push(`/admin/products?edit=${encodeURIComponent(product.id)}`);
  }

  return (
    <main className="stock-page">
      <header className="stock-header">
        <div>
          <a className="back-link" href="/admin">
            ← অ্যাডমিন ড্যাশবোর্ড
          </a>
          <h1>📦 স্টক নিয়ন্ত্রণ</h1>
          <p>পণ্যের মজুত দেখুন, স্টক আপডেট করুন এবং সতর্কতা যাচাই করুন।</p>
        </div>
        <button
          className="refresh-button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          ↻ রিফ্রেশ
        </button>
      </header>

      {error && <div className="message error-message">{error}</div>}
      {notice && <div className="message success-message">{notice}</div>}

      <section className="summary-grid">
        <div className="summary-card">
          <span>মোট পণ্য</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-card">
          <span>স্টক শেষ</span>
          <strong className="danger-text">{summary.zero}</strong>
        </div>
        <div className="summary-card">
          <span>কম স্টক (১–৯)</span>
          <strong className="warning-text">{summary.low}</strong>
        </div>
        <div className="summary-card">
          <span>পাবলিশ করা</span>
          <strong>{summary.published}</strong>
        </div>
      </section>

      <section className="category-panel">
        <h2>বিভাগ অনুযায়ী স্টক</h2>
        <div className="category-grid">
          {categorySummary.map((category) => (
            <button
              key={category.id}
              className={`category-card ${
                categoryFilter === category.id ? "selected" : ""
              }`}
              onClick={() => {
                router.push(`/admin/stock/${encodeURIComponent(category.id)}`);
              }}
            >
              <strong>{category.name}</strong>
              <span>পণ্য: {category.total}</span>
              <span className={category.zero ? "danger-text" : ""}>
                স্টক শেষ: {category.zero}
              </span>
              <span className={category.low ? "warning-text" : ""}>
                কম স্টক: {category.low}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="products-panel">
        <div className="section-heading">
          <div>
            <h2>পণ্যের স্টক তালিকা</h2>
            <p>স্টক ১০টির কম হলে সতর্কতা দেখানো হবে।</p>
          </div>
          <span className="result-count">
            পাওয়া গেছে: {filteredProducts.length}
          </span>
        </div>

        <div className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="পণ্যের নাম বা ইউনিক আইডি লিখুন..."
            aria-label="পণ্য খুঁজুন"
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="বিভাগ নির্বাচন"
          >
            <option value="all">সব বিভাগ</option>
            {CATEGORY_ORDER.map((id) => (
              <option key={id} value={id}>
                {categoryName(id)}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
            aria-label="স্টকের অবস্থা"
          >
            <option value="all">সব স্টক</option>
            <option value="zero">স্টক শেষ</option>
            <option value="low">কম স্টক (১–৯)</option>
            <option value="available">১০ বা তার বেশি</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">তথ্য লোড হচ্ছে...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">কোনো পণ্য পাওয়া যায়নি।</div>
        ) : (
          <div className="product-list">
            {filteredProducts.map((product) => {
              const stock = getStock(product);
              const amount = amounts[product.id] ?? "1";
              const noImage = !isValidImage(product.imageUrl);

              return (
                <article className="product-row" key={product.id}>
                  <div className="product-information">
                    <div className="product-title-line">
                      <h3>{product.name}</h3>
                      <span
                        className={`stock-badge ${
                          stock <= 0
                            ? "badge-zero"
                            : stock < 10
                              ? "badge-low"
                              : "badge-ok"
                        }`}
                      >
                        {stock <= 0
                          ? "স্টক শেষ"
                          : stock < 10
                            ? "কম স্টক"
                            : "স্টক আছে"}
                      </span>
                    </div>

                    <p className="product-id">
                      আইডি: {product.productId || product.id}
                    </p>
                    <p>বিভাগ: {categoryName(getCategory(product))}</p>
                    <p className="stock-number">
                      বর্তমান স্টক: <strong>{stock}</strong> {product.unit || 'পিস'}
                    </p>
                    <p className="publish-status">
                      {product.published ? "পাবলিশ করা" : "পাবলিশ করা নেই"}
                      {noImage ? " • Cloudinary ছবি নেই/অবৈধ" : ""}
                    </p>
                  </div>

                  <div className="stock-actions">
                    <label>
                      পরিমাণ ({product.unit || 'পিস'})
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={amount}
                        onChange={(event) =>
                          setAmounts((previous) => ({
                            ...previous,
                            [product.id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="action-buttons">
                      <button
                        className="increase-button"
                        disabled={busyId === product.id}
                        onClick={() => void updateStock(product, "increase")}
                      >
                        + বাড়ান
                      </button>
                      <button
                        className="decrease-button"
                        disabled={busyId === product.id || stock <= 0}
                        onClick={() => void updateStock(product, "decrease")}
                      >
                        − কমান
                      </button>
                    </div>

                    <button
                      className="edit-button"
                      onClick={() => openProductEditor(product)}
                    >
                      পণ্য সম্পাদনা / পাবলিশ
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        .stock-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          color: #20342a;
          font-family: Arial, sans-serif;
        }
        .stock-header,
        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .stock-header {
          margin-bottom: 24px;
        }
        .back-link {
          color: #176b43;
          text-decoration: none;
          font-size: 14px;
        }
        h1 {
          margin: 12px 0 8px;
          font-size: 28px;
        }
        h2 {
          margin: 0 0 16px;
          font-size: 20px;
        }
        .stock-header p,
        .section-heading p {
          margin: 0;
          color: #68766d;
          font-size: 14px;
          line-height: 1.6;
        }
        button,
        input,
        select {
          font: inherit;
        }
        button {
          cursor: pointer;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .refresh-button,
        .edit-button {
          border: 0;
          border-radius: 9px;
          background: #176b43;
          color: white;
          padding: 11px 15px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .summary-card,
        .category-panel,
        .products-panel {
          border: 1px solid #e2eae4;
          border-radius: 14px;
          background: white;
          padding: 18px;
        }
        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .summary-card span {
          color: #68766d;
          font-size: 13px;
        }
        .summary-card strong {
          font-size: 27px;
        }
        .danger-text {
          color: #c43b35 !important;
        }
        .warning-text {
          color: #a96808 !important;
        }
        .category-panel,
        .products-panel {
          margin-bottom: 24px;
        }
        .category-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        .category-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
          padding: 12px;
          border: 1px solid #e1e9e3;
          border-radius: 10px;
          background: #f8faf8;
          color: #526158;
          text-align: left;
          font-size: 12px;
        }
        .category-card strong {
          color: #20342a;
          font-size: 14px;
        }
        .category-card.selected {
          border-color: #176b43;
          background: #eaf5ee;
        }
        .result-count {
          color: #176b43;
          font-size: 13px;
          white-space: nowrap;
        }
        .filters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 10px;
          margin: 18px 0;
        }
        .filters input,
        .filters select,
        .stock-actions input {
          width: 100%;
          min-width: 0;
          border: 1px solid #d9e2dc;
          border-radius: 8px;
          background: white;
          padding: 11px;
          color: #20342a;
        }
        .product-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .product-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
          gap: 18px;
          padding: 15px;
          border: 1px solid #e4ebe5;
          border-radius: 12px;
        }
        .product-title-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 9px;
        }
        .product-title-line h3 {
          margin: 0;
          font-size: 16px;
        }
        .stock-badge {
          border-radius: 20px;
          padding: 4px 8px;
          font-size: 11px;
          white-space: nowrap;
        }
        .badge-zero {
          background: #fdebea;
          color: #b32e2a;
        }
        .badge-low {
          background: #fff3dc;
          color: #925b08;
        }
        .badge-ok {
          background: #e5f5e9;
          color: #176b43;
        }
        .product-information p {
          margin: 7px 0 0;
          color: #65746a;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .product-information .product-id {
          color: #176b43;
          font-weight: 600;
        }
        .product-information .stock-number {
          color: #263c2f;
        }
        .publish-status {
          font-size: 12px !important;
        }
        .stock-actions {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 9px;
        }
        .stock-actions label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #65746a;
          font-size: 12px;
        }
        .stock-actions label input {
          width: 90px;
        }
        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }
        .action-buttons button {
          border: 0;
          border-radius: 7px;
          padding: 9px 5px;
          font-size: 12px;
        }
        .increase-button {
          background: #e4f4e9;
          color: #176b43;
        }
        .decrease-button {
          background: #fff0e8;
          color: #a8482a;
        }
        .edit-button {
          padding: 9px 6px;
          font-size: 12px;
        }
        .message,
        .empty-state {
          margin-bottom: 16px;
          border-radius: 10px;
          padding: 13px 15px;
          font-size: 14px;
        }
        .error-message {
          background: #fdebea;
          color: #a72d29;
        }
        .success-message {
          background: #e5f5e9;
          color: #176b43;
        }
        .empty-state {
          background: #f6f9f6;
          color: #65746a;
          text-align: center;
        }
        @media (max-width: 800px) {
          .stock-page {
            padding: 14px;
          }
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .filters {
            grid-template-columns: 1fr;
          }
          .product-row {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .stock-actions {
            border-top: 1px solid #e4ebe5;
            padding-top: 12px;
          }
        }
        @media (max-width: 420px) {
          .stock-header {
            align-items: flex-start;
          }
          h1 {
            font-size: 23px;
          }
          .refresh-button {
            padding: 9px;
            font-size: 12px;
          }
          .summary-card,
          .category-panel,
          .products-panel {
            padding: 12px;
          }
          .section-heading {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
