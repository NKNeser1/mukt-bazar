"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Product = {
  id: string;
  productId?: string;
  name: string;
  english: string;
  description?: string;
  englishDescription?: string;
  category: string;
  price: number;
  oldPrice: number;
  stock: number;
  unit?: string;
  imageUrl: string;
  published: boolean;
  special: boolean;
};

type Category = {
  id: string;
  name: string;
  code: string;
};

const CATEGORIES: Category[] = [
  { id: "mc1000", name: "স্পেশাল", code: "SP" },

  { id: "food", name: "মুদি ও খাদ্যপণ্য", code: "GROC" },
  { id: "vegetables", name: "শাকসবজি", code: "VEGE" },
  { id: "fish", name: "মাছ", code: "FISH" },
  { id: "meat", name: "মাংস", code: "MEAT" },
  { id: "fruits", name: "ফলমূল", code: "FRUT" },
  { id: "spices", name: "মসলা", code: "SPIC" },
  { id: "snacks", name: "স্ন্যাকস ও নাশতা", code: "SNCK" },
  { id: "dairy", name: "দুধ ও দুগ্ধজাত পণ্য", code: "DAIR" },
  { id: "frozen", name: "হিমায়িত খাবার", code: "FROZ" },
  { id: "drinks", name: "পানীয়", code: "DRNK" },
  { id: "fashion", name: "পুরুষদের পোশাক", code: "MENS" },
  { id: "women-fashion", name: "নারীদের পোশাক", code: "WMNS" },
  { id: "kids", name: "শিশুদের পোশাক", code: "KIDS" },
  { id: "accessories", name: "ফ্যাশন অ্যাক্সেসরিজ", code: "FASH" },
  { id: "beauty", name: "বিউটি ও কসমেটিকস", code: "COSM" },
  { id: "electronics", name: "ইলেকট্রনিক্স", code: "ELEC" },
  { id: "appliances", name: "গৃহস্থালি যন্ত্রপাতি", code: "APPL" },
  { id: "kitchen", name: "রান্নাঘরের সামগ্রী", code: "KICH" },
  { id: "cleaning", name: "পরিষ্কার-পরিচ্ছন্নতার সামগ্রী", code: "CLEN" },
  { id: "home", name: "ঘর ও গৃহসজ্জা", code: "HOME" },
  { id: "stationery", name: "স্টেশনারি", code: "STAT" },
  { id: "toys", name: "খেলনা", code: "TOYS" },
  { id: "sports", name: "খেলাধুলার সামগ্রী", code: "SPRT" },
  { id: "tools", name: "টুলস ও যন্ত্রপাতি", code: "TOOL" },
  { id: "misc", name: "অন্যান্য পণ্য", code: "MISC" },
];

const UNIT_OPTIONS = ["পিস", "ডজন", "জোড়া", "প্যাকেট", "বাক্স", "কার্টন", "বস্তা", "বোতল", "ক্যান", "রোল", "সেট", "কেজি", "গ্রাম", "মিলিগ্রাম", "টন", "লিটার", "মিলিলিটার", "মিটার", "সেন্টিমিটার", "ফুট", "ইঞ্চি"] as const;

const emptyForm = {
  name: "",
  english: "",
  description: "",
  englishDescription: "",
  category: "food",
  price: "",
  oldPrice: "",
  stock: "1",
  unit: "পিস",
  imageUrl: "",
  published: false,
  special: false,
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCategory = useMemo(
    () => CATEGORIES.find((category) => category.id === form.category),
    [form.category]
  );

  const productIdPreview = useMemo(() => {
    if (editingId) {
      const current = items.find((item) => item.id === editingId);
      return current?.productId || current?.id || "পুরোনো ID";
    }

    const code = selectedCategory?.code;
    if (!code) return "ক্যাটাগরি নির্বাচন করুন";

    const existingNumbers = items
      .map((item) => item.productId || "")
      .filter((id) => id.startsWith(`${code}-`))
      .map((id) => Number(id.slice(code.length + 1)))
      .filter((number) => Number.isInteger(number) && number > 0);

    const nextNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    return `${code}-${String(nextNumber).padStart(4, "0")}`;
  }, [editingId, items, selectedCategory]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/products", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "পণ্যের তালিকা পাওয়া যায়নি।");
      }

      setItems(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "পণ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadProducts());
  }, [loadProducts]);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      english: product.english || "",
      description: product.description || "",
      englishDescription: product.englishDescription || "",
      category: product.category || "food",
      price: String(product.price ?? ""),
      oldPrice: String(product.oldPrice ?? product.price ?? ""),
      stock: String(product.stock ?? 0),
      unit: product.unit || "পিস",
      imageUrl: product.imageUrl || "",
      published: product.published === true,
      special: product.special === true,
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...emptyForm });
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("ছবির আকার সর্বোচ্চ ৫ MB হতে পারবে।");
      event.target.value = "";
      return;
    }

    setUploadingImage(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.imageUrl) {
        throw new Error(data.message || "ছবি আপলোড করা যায়নি।");
      }

      setForm((current) => ({ ...current, imageUrl: data.imageUrl }));
      setMessage("ছবি Cloudinary-তে আপলোড হয়েছে।");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ছবি আপলোড করা যায়নি।");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (uploadingImage) {
      setError("ছবি আপলোড সম্পূর্ণ হওয়া পর্যন্ত অপেক্ষা করুন।");
      return;
    }

    const price = Number(form.price);
    const oldPrice = form.oldPrice === "" ? price : Number(form.oldPrice);
    const stock = Number(form.stock);

    if (!Number.isFinite(price) || price <= 0) {
      setError("সঠিক বিক্রয়মূল্য লিখুন।");
      return;
    }

    if (!Number.isFinite(oldPrice) || oldPrice < price) {
      setError("আগের মূল্য বর্তমান মূল্যের সমান বা বেশি হতে হবে।");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("স্টক শূন্য অথবা তার বেশি পূর্ণসংখ্যা হতে হবে।");
      return;
    }

    if (!form.imageUrl.trim()) {
      setError("পণ্যের ছবি আপলোড করুন অথবা Cloudinary লিংক দিন।");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        price,
        oldPrice,
        stock,
      };

      const response = await fetch("/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload
        ),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "পণ্য সংরক্ষণ করা যায়নি।");
      }

      const savedProductId = data.product?.productId;

      setMessage(
        editingId
          ? "পণ্য আপডেট হয়েছে।"
          : `নতুন পণ্য যোগ হয়েছে।${savedProductId ? ` Product ID: ${savedProductId}` : ""}`
      );

      resetForm();
      await loadProducts();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "পণ্য সংরক্ষণ করা যায়নি।";

      setError(errorMessage);

      if (
        errorMessage.includes("আগে") &&
        errorMessage.includes("ব্যবহৃত হয়েছে")
      ) {
        setMessage("এই ID পুনরায় ব্যবহার করা যাবে না। নতুন ID তৈরি করুন।");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`“${product.name}” পণ্যটি মুছে ফেলবেন?`)) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/admin/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "পণ্য মুছে ফেলা যায়নি।");
      }

      if (editingId === product.id) resetForm();

      setMessage("পণ্য মুছে ফেলা হয়েছে।");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "পণ্য মুছে ফেলা যায়নি।");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 pb-24 text-gray-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <a href="/admin" className="text-sm font-semibold text-green-700">
              ← অ্যাডমিন ড্যাশবোর্ড
            </a>
            <h1 className="mt-2 text-2xl font-extrabold text-green-950 sm:text-3xl">
              পণ্য ব্যবস্থাপনা
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              ২৫টি ক্যাটাগরিতে পণ্য যোগ, সম্পাদনা, স্টক ও প্রকাশ নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={loading}
            className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-50 disabled:opacity-60"
          >
            তালিকা রিফ্রেশ
          </button>
        </header>

        {message && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-green-100 p-3 text-sm text-green-900"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <section className="mb-8 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-green-950">
            {editingId ? "পণ্য সম্পাদনা" : "নতুন পণ্য যোগ"}
          </h2>

          <form onSubmit={submitForm} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              পণ্যের বাংলা নাম *
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({ ...current, name: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-green-600"
              />
            </label>

            <label className="text-sm font-semibold">
              পণ্যের ইংরেজি নাম *
              <input
                required
                value={form.english}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    english: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-green-600"
              />
            </label>

            <label className="text-sm font-semibold">
              ক্যাটাগরি *
              <select
                required
                value={form.category}
                disabled={Boolean(editingId)}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    category: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 font-normal disabled:bg-gray-100"
              >
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {editingId && (
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  সম্পাদনার সময় বর্তমান ক্যাটাগরি অপরিবর্তিত রাখা হয়েছে।
                </span>
              )}
            </label>

            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-950">
                স্বয়ংক্রিয় Product ID
              </p>
              <p className="mt-1 break-all text-xl font-extrabold text-green-800">
                {productIdPreview}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                এটি বর্তমান তালিকা থেকে তৈরি প্রিভিউ। চূড়ান্ত ID সার্ভার তৈরি
                করবে।
              </p>
            </div>

            <label className="text-sm font-semibold">
              বিক্রয়মূল্য (৳) *
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm((current) => ({ ...current, price: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold">
              আগের মূল্য (৳)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.oldPrice}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    oldPrice: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold">
              স্টক সংখ্যা *
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) =>
                  setForm((current) => ({ ...current, stock: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold">
              স্টক ও বিক্রির একক *
              <select required value={form.unit}
                onChange={(e) => setForm((current) => ({ ...current, unit: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 font-normal">
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-gray-500">
                স্টক ১০ এবং একক কেজি হলে ১০ কেজি মজুত থাকবে; একবারে ১ কেজি বিক্রি হবে।
              </span>
            </label>

            <div className="rounded-xl border border-dashed border-green-300 bg-green-50 p-4 sm:col-span-2">
              <label className="block text-sm font-bold text-green-950">
                মোবাইলের গ্যালারি থেকে ছবি নির্বাচন করুন
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(e) => void uploadImage(e)}
                  disabled={uploadingImage}
                  className="mt-2 block w-full text-sm font-normal text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-green-700 file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-60"
                />
              </label>

              <p className="mt-2 text-xs text-gray-600">
                JPG, PNG, WebP বা AVIF · সর্বোচ্চ ৫ MB
              </p>

              {uploadingImage && (
                <p role="status" className="mt-2 text-sm font-semibold text-green-800">
                  ছবি আপলোড হচ্ছে...
                </p>
              )}

              {form.imageUrl && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="নির্বাচিত পণ্যের ছবি"
                    className="size-20 rounded-lg border border-gray-200 bg-white object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-green-800">
                      Cloudinary ছবির লিংক প্রস্তুত
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({ ...current, imageUrl: "" }))
                      }
                      className="mt-1 text-sm font-semibold text-red-700 underline"
                    >
                      ছবি সরান
                    </button>
                  </div>
                </div>
              )}
            </div>

            <label className="text-sm font-semibold sm:col-span-2">
              Cloudinary ছবির HTTPS লিংক *
              <input
                required
                type="url"
                placeholder="https://res.cloudinary.com/..."
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    imageUrl: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold sm:col-span-2">
              বাংলা বিবরণ
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold sm:col-span-2">
              English description
              <textarea
                rows={2}
                value={form.englishDescription}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    englishDescription: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"
              />
            </label>

            <div className="flex flex-wrap gap-5 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      published: e.target.checked,
                    }))
                  }
                  className="size-4 accent-green-700"
                />
                প্রকাশ করতে চাই
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.special}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      special: e.target.checked,
                    }))
                  }
                  className="size-4 accent-green-700"
                />
                বিশেষ পণ্য
              </label>
            </div>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="rounded-xl bg-green-700 px-6 py-3 font-bold text-white hover:bg-green-800 disabled:opacity-60"
              >
                {saving
                  ? "সংরক্ষণ হচ্ছে..."
                  : editingId
                    ? "পরিবর্তন সংরক্ষণ"
                    : "পণ্য যোগ করুন"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-200 px-5 py-3 font-semibold"
                >
                  সম্পাদনা বাতিল
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-green-950">পণ্যের তালিকা</h2>
            <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-800">
              {items.length}টি
            </span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-gray-500">
              পণ্য লোড হচ্ছে...
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-gray-500">
              এখনো কোনো Firebase পণ্য নেই।
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((product) => {
                const category = CATEGORIES.find(
                  (item) => item.id === product.category
                );

                return (
                  <article
                    key={product.id}
                    className="flex flex-col gap-4 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="size-16 rounded-lg border border-gray-100 object-cover"
                        />
                      ) : (
                        <div className="flex size-16 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                          📦
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{product.name}</h3>
                        <p className="truncate text-xs text-gray-500">
                          {product.english}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-green-800">
                          ৳{product.price} · স্টক {product.stock} {product.unit || "পিস"}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          ক্যাটাগরি: {category?.name || product.category}
                        </p>
                        <p className="mt-1 break-all text-xs text-gray-500">
                          ID: {product.productId || product.id}
                        </p>
                        <p className="mt-1 text-xs">
                          {product.published ? "প্রকাশিত" : "প্রকাশিত নয়"}
                          {product.special ? " · বিশেষ পণ্য" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(product)}
                        className="rounded-lg border border-green-200 px-4 py-2 text-sm font-bold text-green-800"
                      >
                        সম্পাদনা
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteProduct(product)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                      >
                        মুছুন
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}