
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type Category = {
  id: string;
  code?: string;
  name: string;
  english: string;
  icon?: string;
  active?: boolean;
  order?: number;
};

type Product = {
  id: string;
  productId?: string;
  name: string;
  english?: string;
  category: string;
  price: number;
  oldPrice?: number;
  imageUrl?: string;
  stock: number;
  published: boolean;
  special?: boolean;
};

function money(value: number) {
  return `৳${Number(value).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function validImage(url?: string) {
  return !!url && /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url);
}

function discount(product: Product) {
  const oldPrice = Number(product.oldPrice || product.price);
  const price = Number(product.price);

  if (oldPrice <= price || oldPrice <= 0) return 0;

  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [categoryResponse, productResponse] = await Promise.all([
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
      ]);

      const [categoryData, productData] = await Promise.all([
        categoryResponse.json(),
        productResponse.json(),
      ]);

      if (!categoryResponse.ok || !categoryData.success) {
        throw new Error(categoryData.message || "ক্যাটাগরি লোড হয়নি।");
      }

      if (!productResponse.ok || !productData.success) {
        throw new Error(productData.message || "পণ্য লোড হয়নি।");
      }

      setCategories(categoryData.categories || []);
      setProducts(productData.products || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "তথ্য লোড করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  async function toggleCategory(category: Category) {
    setSavingId(category.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: category.id,
          active: category.active === false,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "অবস্থা পরিবর্তন করা যায়নি।");
      }

      setMessage(data.message || "ক্যাটাগরির অবস্থা পরিবর্তন হয়েছে।");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "অবস্থা পরিবর্তন করা যায়নি।",
      );
    } finally {
      setSavingId("");
    }
  }

  const visibleCategories = categories.filter((category) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      category.name.toLowerCase().includes(query) ||
      category.english.toLowerCase().includes(query) ||
      category.id.toLowerCase().includes(query) ||
      (category.code || "").toLowerCase().includes(query)
    );
  });

  const activeCount = categories.filter(
    (category) => category.active !== false,
  ).length;

  const inactiveCount = categories.length - activeCount;

  function categoryProducts(categoryId: string) {
    return products
      .filter(
        (product) =>
          product.category === categoryId &&
          product.published === true &&
          Number(product.stock) > 0 &&
          validImage(product.imageUrl) &&
          Number(product.price) > 0,
      )
      .sort((a, b) => Number(b.special) - Number(a.special))
      .slice(0, 3);
  }

  function categoryOffers(categoryId: string) {
    return products
      .filter(
        (product) =>
          product.category === categoryId &&
          product.published === true &&
          Number(product.stock) > 0 &&
          validImage(product.imageUrl) &&
          discount(product) > 0,
      )
      .slice(0, 5);
  }

  return (
    <main className="min-h-screen bg-[#f3f7f3] p-3 text-gray-800 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl">
              🛒
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-green-800 sm:text-2xl">
                মুক্ত বাজার
              </h1>
              <p className="text-sm text-gray-500">
                অ্যাডমিন প্যানেল · ক্যাটাগরি ব্যবস্থাপনা
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-xl border border-green-200 px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-50 disabled:opacity-50"
          >
            {loading ? "লোড হচ্ছে..." : "↻ রিফ্রেশ"}
          </button>
        </header>

        <section className="space-y-1">
          <h2 className="text-2xl font-extrabold text-gray-900">
            ক্যাটাগরি ব্যবস্থাপনা
          </h2>
          <p className="text-sm text-gray-500">
            নির্ধারিত ক্যাটাগরির অবস্থা, পণ্য ও ছাড় দেখুন।
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">মোট ক্যাটাগরি</p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">
              {categories.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">সক্রিয় ক্যাটাগরি</p>
            <p className="mt-1 text-3xl font-extrabold text-green-700">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">বন্ধ ক্যাটাগরি</p>
            <p className="mt-1 text-3xl font-extrabold text-orange-600">
              {inactiveCount}
            </p>
          </div>
        </section>

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-gray-900">নির্ধারিত ক্যাটাগরির তালিকা</h3>
            <p className="mt-1 text-xs text-gray-500">
              ক্যাটাগরি তৈরি, মুছে ফেলা বা নাম পরিবর্তন করা যাবে না।
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ক্যাটাগরি খুঁজুন..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-600 sm:max-w-xs"
          />
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-500">
            ক্যাটাগরি ও পণ্য লোড হচ্ছে...
          </div>
        ) : visibleCategories.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-500">
            কোনো ক্যাটাগরি পাওয়া যায়নি।
          </div>
        ) : (
          <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {visibleCategories.map((category, index) => {
              const items = categoryProducts(category.id);
              const offers = categoryOffers(category.id);
              const active = category.active !== false;

              return (
                <article
                  key={category.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                    active ? "border-green-100" : "border-gray-200 opacity-80"
                  }`}
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-2xl">
                      {category.icon || "🛍️"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-green-700">
                        ক্যাটাগরি {String(index + 1).padStart(2, "0")} ·{" "}
                        {category.code || category.id.toUpperCase()}
                      </p>
                      <h3 className="mt-1 font-extrabold text-gray-900">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {category.english}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {items.length}টি প্রিভিউ পণ্য · {offers.length}টি ছাড়ের পণ্য
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {active ? "সক্রিয়" : "বন্ধ"}
                      </span>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={`${category.name} ${active ? "বন্ধ" : "সক্রিয়"} করুন`}
                        disabled={savingId === category.id}
                        onClick={() => void toggleCategory(category)}
                        className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${
                          active ? "bg-green-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            active ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {!active && (
                    <div className="mx-4 mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
                      বন্ধ থাকলে এই ক্যাটাগরি পাবলিক সাইটে দেখানো হবে না।
                    </div>
                  )}

                  <div className="mx-4 rounded-xl border border-green-100 bg-green-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-green-900">
                        🏷️ অফার প্রিভিউ
                      </p>
                      <span className="text-xs text-green-800">
                        {offers.length ? `${offers.length}টি ছাড়` : "অফার নেই"}
                      </span>
                    </div>

                    {offers.length > 0 ? (
                      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                        {offers.map((product) => (
                          <div
                            key={product.id}
                            className="flex min-w-[150px] max-w-[150px] items-center gap-2 rounded-lg bg-white p-2"
                          >
                            <div className="relative h-14 w-14 shrink-0">
                              <Image
                                src={product.imageUrl || ""}
                                alt={product.name}
                                width={56}
                                height={56}
                                className="h-full w-full rounded-lg object-cover"
                              />
                              <span className="absolute -right-1 -top-1 rounded bg-red-600 px-1 text-[10px] font-extrabold text-white">
                                -{discount(product)}%
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-xs font-bold">
                                {product.name}
                              </p>
                              <p className="text-xs font-extrabold text-green-700">
                                {money(product.price)}
                              </p>
                              <p className="text-[10px] text-gray-400 line-through">
                                {money(Number(product.oldPrice || product.price))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-600">
                        এই ক্যাটাগরিতে ছাড়ের পণ্য নেই। অফার যোগ হলে এখানে দেখা যাবে।
                      </p>
                    )}
                  </div>

                  <div className="p-4">
                    {items.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((product) => {
                          const percent = discount(product);
                          const oldPrice = Number(
                            product.oldPrice || product.price,
                          );

                          return (
                            <div
                              key={product.id}
                              className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white"
                            >
                              <div className="relative aspect-square bg-gray-50">
                                <Image
                                  src={product.imageUrl || ""}
                                  alt={product.name}
                                  fill
                                  sizes="(max-width: 640px) 33vw, 150px"
                                  className="object-cover"
                                />

                                {percent > 0 && (
                                  <span className="absolute left-1 top-1 rounded-md bg-red-600 px-1.5 py-1 text-[10px] font-extrabold text-white shadow-sm">
                                    {percent}% ছাড়
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 p-2">
                                <p className="line-clamp-2 min-h-8 text-xs font-bold text-gray-800">
                                  {product.name}
                                </p>

                                {percent > 0 ? (
                                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                    <span className="text-sm font-extrabold text-green-700">
                                      {money(Number(product.price))}
                                    </span>
                                    <span className="text-[10px] text-gray-400 line-through">
                                      {money(oldPrice)}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-sm font-extrabold text-green-700">
                                    {money(Number(product.price))}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                        <p className="text-2xl">🛍️</p>
                        <p className="mt-2 text-sm font-bold text-gray-700">
                          অ্যাডমিন শীঘ্রই পণ্য যোগ করবেন
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          প্রকাশিত, স্টকে থাকা ও বৈধ ছবি-যুক্ত পণ্য এখানে দেখা যাবে।
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">
                        সর্বোচ্চ ৩টি পণ্যের প্রিভিউ
                      </p>
                      <a
                        href={`/admin/products?category=${encodeURIComponent(category.id)}`}
                        className="shrink-0 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800"
                      >
                        সব পণ্য দেখুন →
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <footer className="pb-5 text-center text-xs text-gray-500">
          মুক্ত বাজার · নির্ধারিত ক্যাটাগরি ব্যবস্থাপনা
        </footer>
      </div>
    </main>
  );
}
