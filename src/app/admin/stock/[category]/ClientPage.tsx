"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Product = {
  id: string;
  productId?: string;
  name: string;
  english?: string;
  category?: string;
  stock?: number;
  published?: boolean;
  imageUrl?: string;
  unit?: string;
};

type Category = {
  id?: string;
  categoryId?: string;
  name?: string;
  english?: string;
  active?: boolean;
};

const CATEGORY_NAMES: Record<string, string> = {
  food: "মুদি ও খাদ্যপণ্য",
  vegetables: "শাকসবজি",
  fish: "মাছ",
  meat: "মাংস",
  fruits: "ফলমূল",
  spices: "মসলা",
  snacks: "স্ন্যাকস ও নাশতা",
  dairy: "দুধ ও দুগ্ধজাত পণ্য",
  frozen: "হিমায়িত খাবার",
  drinks: "পানীয়",
  fashion: "পুরুষদের পোশাক",
  "women-fashion": "নারীদের পোশাক",
  kids: "শিশুদের পোশাক",
  accessories: "ফ্যাশন অ্যাক্সেসরিজ",
  beauty: "বিউটি ও কসমেটিকস",
  electronics: "ইলেকট্রনিকস",
  appliances: "গৃহস্থালি যন্ত্রপাতি",
  kitchen: "রান্নাঘরের সামগ্রী",
  cleaning: "পরিষ্কার-পরিচ্ছন্নতার সামগ্রী",
  home: "ঘর ও গৃহসজ্জা",
  stationery: "স্টেশনারি",
  toys: "খেলনা",
  sports: "খেলাধুলার সামগ্রী",
  tools: "টুলস ও যন্ত্রপাতি",
  misc: "অন্যান্য পণ্য",
};

function getStock(product: Product) {
  const value = Number(product.stock ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export default function StockCategoryPage() {
  const params = useParams<{ category: string }>();
  const categoryId = decodeURIComponent(String(params.category || ""));

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [stockFilter, setStockFilter] = useState<"low" | "all">("low");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
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
        throw new Error(
          productData.message || productData.error || "পণ্যের তালিকা লোড হয়নি।"
        );
      }

      if (!categoryResponse.ok) {
        throw new Error(
          categoryData.message ||
            categoryData.error ||
            "ক্যাটাগরির তালিকা লোড হয়নি।"
        );
      }

      const productList = Array.isArray(productData)
        ? productData
        : productData.products;
      const categoryList = Array.isArray(categoryData)
        ? categoryData
        : categoryData.categories;

      setProducts(Array.isArray(productList) ? productList : []);
      setCategories(Array.isArray(categoryList) ? categoryList : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "তথ্য লোড করতে সমস্যা হয়েছে।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  const category = categories.find(
    (item) => (item.id || item.categoryId) === categoryId
  );
  const categoryName =
    category?.name || CATEGORY_NAMES[categoryId] || categoryId;

  const categoryProducts = useMemo(
    () =>
      products
        .filter((product) => (product.category || "misc") === categoryId)
        .filter((product) => stockFilter === "all" || getStock(product) < 10)
        .sort((a, b) => getStock(a) - getStock(b) || a.name.localeCompare(b.name, "bn")),
    [products, categoryId, stockFilter]
  );

  const zeroCount = products.filter(
    (product) =>
      (product.category || "misc") === categoryId && getStock(product) <= 0
  ).length;
  const lowCount = products.filter(
    (product) =>
      (product.category || "misc") === categoryId &&
      getStock(product) > 0 &&
      getStock(product) < 10
  ).length;

  async function updateStock(product: Product, mode: "increase" | "decrease") {
    const amount = Number(amounts[product.id] || 1);

    if (!Number.isSafeInteger(amount) || amount < 1) {
      setError("সঠিক পূর্ণসংখ্যার পরিমাণ লিখুন।");
      return;
    }

    if (mode === "decrease" && amount > getStock(product)) {
      setError("বর্তমান স্টকের চেয়ে বেশি কমানো যাবে না।");
      return;
    }

    const actionText = mode === "increase" ? "বাড়াতে" : "কমানোর";
    if (
      !window.confirm(
        `${product.name} পণ্যের স্টক ${amount} ${product.unit || "পিস"} ${actionText} চান?`
      )
    ) {
      return;
    }

    setBusyId(product.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, mode, amount }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "স্টক আপডেট করা যায়নি।");
      }

      setNotice(
        `${product.name}: স্টক ${mode === "increase" ? "বাড়ানো" : "কমানো"} হয়েছে (${amount} ${product.unit || "পিস"} )।`
      );
      setAmounts((previous) => ({ ...previous, [product.id]: "1" }));
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "স্টক আপডেটে সমস্যা হয়েছে।"
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <Link href="/admin/stock" className="back">← সব বিভাগের স্টক</Link>
          <h1>📦 {categoryName}</h1>
          <p>স্টক শেষ ও কম স্টক থাকা পণ্য নিয়ন্ত্রণ করুন।</p>
        </div>
        <button className="refresh" onClick={() => void loadData()} disabled={loading}>
          ↻ রিফ্রেশ
        </button>
      </header>

      <section className="summary">
        <div><span>এই বিভাগের মোট পণ্য</span><strong>{products.filter((p) => (p.category || "misc") === categoryId).length}</strong></div>
        <div><span>স্টক শেষ</span><strong className="zero">{zeroCount}</strong></div>
        <div><span>কম স্টক (১–৯)</span><strong className="low">{lowCount}</strong></div>
      </section>

      {error && <div className="message error">{error}</div>}
      {notice && <div className="message success">{notice}</div>}

      <section className="panel">
        <div className="list-heading">
          <div>
            <h2>পণ্যের স্টক তালিকা</h2>
            <p>স্টক পরিবর্তন করলে পণ্য স্বয়ংক্রিয়ভাবে পাবলিশ হবে না।</p>
          </div>
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as "low" | "all")}
            aria-label="স্টক ফিল্টার"
          >
            <option value="low">শুধু কম/শেষ স্টক</option>
            <option value="all">সব পণ্য</option>
          </select>
        </div>

        {loading ? (
          <div className="empty">তথ্য লোড হচ্ছে...</div>
        ) : categoryProducts.length === 0 ? (
          <div className="empty">এই ফিল্টারে কোনো পণ্য পাওয়া যায়নি।</div>
        ) : (
          <div className="product-list">
            {categoryProducts.map((product) => {
              const stock = getStock(product);
              return (
                <article className="product" key={product.id}>
                  <div className="information">
                    <div className="title-line">
                      <h3>{product.name}</h3>
                      <span className={`badge ${stock <= 0 ? "badge-zero" : stock < 10 ? "badge-low" : "badge-ok"}`}>
                        {stock <= 0 ? "স্টক শেষ" : stock < 10 ? "কম স্টক" : "স্টক আছে"}
                      </span>
                    </div>
                    <p className="id">ইউনিক আইডি: {product.productId || product.id}</p>
                    <p className="stock-number">
                      বর্তমান স্টক: <strong>{stock}</strong> {product.unit || "পিস"}
                    </p>
                    <p className="publish">
                      {product.published ? "পাবলিশ করা" : "পাবলিশ করা নেই"}
                    </p>
                  </div>

                  <div className="actions">
                    <label>
                      পরিমাণ
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={amounts[product.id] ?? "1"}
                        onChange={(event) =>
                          setAmounts((previous) => ({
                            ...previous,
                            [product.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="buttons">
                      <button
                        className="increase"
                        disabled={busyId === product.id}
                        onClick={() => void updateStock(product, "increase")}
                      >
                        ＋ বাড়ান
                      </button>
                      <button
                        className="decrease"
                        disabled={busyId === product.id || stock <= 0}
                        onClick={() => void updateStock(product, "decrease")}
                      >
                        − কমান
                      </button>
                    </div>
                    <a
                      className="edit"
                      href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                    >
                      পণ্য সম্পাদনা / পাবলিশ
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        .page{max-width:1100px;margin:0 auto;padding:22px;color:#20342a;font-family:Arial,sans-serif}
        .header,.list-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}
        .header{margin-bottom:22px}.back{color:#176b43;text-decoration:none;font-size:14px}
        h1{font-size:27px;margin:12px 0 7px}h2{font-size:19px;margin:0 0 6px}
        .header p,.list-heading p{font-size:13px;color:#68766d;margin:0;line-height:1.6}
        button,input,select{font:inherit}.refresh,.edit{border:0;border-radius:9px;background:#176b43;color:white;padding:10px 13px;text-decoration:none;font-size:12px}
        button{cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}
        .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:20px}
        .summary>div,.panel{border:1px solid #e2eae4;border-radius:13px;background:white;padding:15px}
        .summary>div{display:flex;flex-direction:column;gap:9px}.summary span{font-size:12px;color:#68766d}.summary strong{font-size:25px}
        .zero{color:#c43b35}.low{color:#a96808}.panel{margin-bottom:20px}
        .list-heading{margin-bottom:17px}.list-heading select{border:1px solid #d9e2dc;border-radius:8px;padding:9px;background:white;color:#20342a}
        .product-list{display:flex;flex-direction:column;gap:10px}.product{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:16px;padding:14px;border:1px solid #e4ebe5;border-radius:11px}
        .title-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.title-line h3{font-size:16px;margin:0}
        .badge{font-size:11px;padding:4px 8px;border-radius:20px}.badge-zero{background:#fdebea;color:#b32e2a}.badge-low{background:#fff3dc;color:#925b08}.badge-ok{background:#e5f5e9;color:#176b43}
        .information p{font-size:13px;color:#65746a;margin:8px 0 0;overflow-wrap:anywhere}.information .id{color:#176b43;font-weight:600}.stock-number{color:#263c2f!important}.publish{font-size:12px!important}
        .actions{display:flex;flex-direction:column;justify-content:center;gap:9px}.actions label{display:flex;align-items:center;gap:9px;color:#65746a;font-size:12px}
        .actions input{width:90px;min-width:0;border:1px solid #d9e2dc;border-radius:8px;padding:9px;color:#20342a;background:white}
        .buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px}.buttons button{border:0;border-radius:7px;padding:9px 5px;font-size:12px}
        .increase{background:#e4f4e9;color:#176b43}.decrease{background:#fff0e8;color:#a8482a}.edit{text-align:center}
        .message,.empty{padding:13px 15px;border-radius:10px;margin-bottom:14px;font-size:13px}.error{background:#fdebea;color:#a72d29}.success{background:#e5f5e9;color:#176b43}.empty{background:#f6f9f6;color:#65746a;text-align:center}
        @media(max-width:700px){.page{padding:13px 13px 120px}.header{align-items:flex-start}.header h1{font-size:23px}.summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.summary>div{padding:10px}.summary span{font-size:11px}.summary strong{font-size:21px}.list-heading{align-items:flex-start;flex-direction:column}.product{grid-template-columns:1fr;gap:12px}.actions{border-top:1px solid #edf1ed;padding-top:12px}.actions label{justify-content:space-between}.actions input{width:110px}}
      `}</style>
    </main>
  );
}
