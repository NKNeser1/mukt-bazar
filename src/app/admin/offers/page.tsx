"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string };
type Item = {
  id: string;
  type: string;
  name: string;
  category?: string;
  imageUrl: string;
  publicId: string;
  active: boolean;
};

export default function OffersPage() {
  const [tab, setTab] = useState<"banner" | "brand">("banner");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publicId, setPublicId] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/offers?type=${tab}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "তথ্য লোড করা যায়নি।");
      }
      setItems(data.items || []);
      setCategories(data.categories || []);
      setCategory((old) => old || data.categories?.[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "তথ্য লোড হয়নি।");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void Promise.resolve().then(() => loadItems());
  }, [loadItems]);

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", tab);

      const response = await fetch("/api/admin/offers/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "ছবি আপলোড হয়নি।");
      }

      setImageUrl(data.imageUrl);
      setPublicId(data.publicId);
      setMessage("ছবি আপলোড হয়েছে। এখন সংরক্ষণ করুন।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ছবি আপলোড হয়নি।");
    } finally {
      setUploading(false);
    }
  }

  function cancelEdit() {
    setEditingId("");
    setName("");
    setImageUrl("");
    setPublicId("");
    setMessage("");
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category || "");
    setImageUrl(item.imageUrl);
    setPublicId(item.publicId);
    setMessage("তথ্য পরিবর্তন করে সংরক্ষণ করুন।");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveItem() {
    const selectedCategory = categories.find((item) => item.id === category);
    const itemName = tab === "banner" ? selectedCategory?.name : name.trim();

    if (!itemName || !imageUrl || !publicId) {
      setMessage("নাম/ক্যাটাগরি নির্বাচন করুন এবং ছবি আপলোড করুন।");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const editing = Boolean(editingId);
      const response = await fetch("/api/admin/offers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                action: "edit",
                type: tab,
                id: editingId,
                name: itemName,
                category,
                imageUrl,
                publicId,
              }
            : {
                type: tab,
                name: itemName,
                category,
                imageUrl,
                publicId,
                active: false,
              }
        ),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "সংরক্ষণ করা যায়নি।");
      }

      setMessage(data.message || (editing ? "পরিবর্তন সংরক্ষণ হয়েছে।" : "সংরক্ষণ হয়েছে।"));
      setEditingId("");
      setName("");
      setImageUrl("");
      setPublicId("");
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "সংরক্ষণ হয়নি।");
    } finally {
      setLoading(false);
    }
  }

  async function changeActive(item: Item) {
    setMessage("");
    try {
      const response = await fetch("/api/admin/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tab,
          id: item.id,
          active: !item.active,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "অবস্থা পরিবর্তন হয়নি।");
      }
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "পরিবর্তন হয়নি।");
    }
  }

  async function deleteItem(item: Item) {
    if (
      !window.confirm(
        `“${item.name}” মুছে ফেলবেন? ছবিটিও Cloudinary থেকে মুছে যাবে।`
      )
    ) {
      return;
    }

    setMessage("");
    try {
      const response = await fetch("/api/admin/offers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, id: item.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "মুছে ফেলা যায়নি।");
      }
      setMessage(data.message || "মুছে ফেলা হয়েছে।");
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "মুছে ফেলা যায়নি।");
    }
  }

  return (
    <main className="offers-page">
      <header className="offers-header">
        <div>
          <h1>অফার ও ব্যানার পরিচালনা</h1>
          <p>ছবি Cloudinary-তে এবং অন্যান্য তথ্য Firebase-এ থাকবে।</p>
        </div>
        <a href="/admin">অ্যাডমিন প্যানেল</a>
      </header>

      <nav className="offers-tabs">
        <button
          type="button"
          className={tab === "banner" ? "selected" : ""}
          onClick={() => {
            cancelEdit();
            setTab("banner");
            setCategory("");
          }}
        >
          ক্যাটাগরি ব্যানার
        </button>
        <button
          type="button"
          className={tab === "brand" ? "selected" : ""}
          onClick={() => {
            cancelEdit();
            setTab("brand");
          }}
        >
          ব্র্যান্ড / কোম্পানি
        </button>
      </nav>

      <section className="offers-form">
        <h2>{editingId ? "তথ্য এডিট করুন" : tab === "banner" ? "ক্যাটাগরি ব্যানার যোগ করুন" : "ব্র্যান্ড যোগ করুন"}</h2>

        {tab === "banner" ? (
          <label>
            ক্যাটাগরি নির্বাচন করুন
            <select
              value={category}
              disabled={Boolean(editingId)}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            ব্র্যান্ড / কোম্পানির নাম
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="কোম্পানির নাম লিখুন"
              maxLength={100}
            />
          </label>
        )}

        <label>
          ছবি নির্বাচন করুন
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={uploadImage}
            disabled={uploading}
          />
        </label>

        {uploading && <p>ছবি আপলোড হচ্ছে...</p>}

        {imageUrl && (
          <div className="offers-preview">
            <Image src={imageUrl} alt="নির্বাচিত ছবি" width={100} height={75} />
            <span>ছবি আপলোড হয়েছে</span>
            <button
              type="button"
              onClick={() => {
                setImageUrl("");
                setPublicId("");
              }}
            >
              ছবি পরিবর্তন
            </button>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="save-button"
            onClick={saveItem}
            disabled={loading || uploading || !imageUrl || !publicId}
          >
            {loading ? "অপেক্ষা করুন..." : editingId ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"}
          </button>
          {editingId && (
            <button type="button" className="cancel-button" onClick={cancelEdit}>
              বাতিল
            </button>
          )}
        </div>

        <p className="offers-note">
          নতুন ব্যানার বা ব্র্যান্ড প্রথমে নিষ্ক্রিয় থাকবে। তালিকা থেকে সক্রিয় করুন।
        </p>
        {message && <p className="offers-message">{message}</p>}
      </section>

      <section className="offers-list">
        <div className="offers-list-heading">
          <h2>{tab === "banner" ? "ক্যাটাগরি ব্যানারসমূহ" : "ব্র্যান্ডসমূহ"}</h2>
          <button type="button" onClick={() => void loadItems()}>
            রিফ্রেশ
          </button>
        </div>

        {loading ? (
          <p>তথ্য লোড হচ্ছে...</p>
        ) : items.length === 0 ? (
          <p className="offers-empty">এখনো কোনো তথ্য যোগ করা হয়নি।</p>
        ) : (
          <div className="offers-grid">
            {items.map((item) => (
              <article className="offer-card" key={item.id}>
                <Image src={item.imageUrl} alt={item.name} width={440} height={145} />
                <div className="offer-card-body">
                  <h3>{item.name}</h3>
                  <span className={item.active ? "status active" : "status inactive"}>
                    {item.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  </span>
                  <div className="offer-card-actions">
                    <button type="button" onClick={() => startEdit(item)}>
                      এডিট
                    </button>
                    <button type="button" onClick={() => void changeActive(item)}>
                      {item.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </button>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => void deleteItem(item)}
                    >
                      মুছুন
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .offers-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px 20px calc(140px + env(safe-area-inset-bottom));
          min-height: 100dvh;
          box-sizing: border-box;
          color: #183b2b;
        }
        .offers-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 25px;
        }
        h2 {
          margin: 0 0 18px;
          font-size: 19px;
        }
        .offers-header p,
        .offers-note {
          color: #66756c;
          font-size: 13px;
        }
        .offers-header a {
          color: #176b43;
          font-weight: 700;
        }
        .offers-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        button,
        input,
        select {
          font: inherit;
        }
        button {
          cursor: pointer;
        }
        .offers-tabs button,
        .offers-list-heading button {
          border: 1px solid #d8e5dc;
          border-radius: 9px;
          background: white;
          color: #24553b;
          padding: 10px 14px;
        }
        .offers-tabs .selected,
        .save-button {
          background: #176b43;
          color: white;
          border-color: #176b43;
        }
        .offers-form {
          background: white;
          border: 1px solid #e0e9e2;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 26px;
        }
        label {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 600;
        }
        input:not([type="file"]),
        select {
          box-sizing: border-box;
          width: 100%;
          min-height: 44px;
          border: 1px solid #d4dfd7;
          border-radius: 8px;
          padding: 10px;
          background: white;
          color: #183b2b;
        }
        input[type="file"] {
          width: 100%;
          border: 1px dashed #a9c5b2;
          border-radius: 8px;
          padding: 12px;
          box-sizing: border-box;
        }
        .offers-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin: 12px 0 18px;
        }
        .offers-preview img {
          width: 100px;
          height: 75px;
          object-fit: cover;
          border-radius: 8px;
        }
        .offers-preview button {
          border: 0;
          background: #eef5ef;
          color: #176b43;
          padding: 8px;
          border-radius: 7px;
        }
        .form-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }
        .save-button,
        .cancel-button {
          border: 0;
          border-radius: 9px;
          padding: 12px 18px;
          font-weight: 700;
        }
        .cancel-button {
          background: #edf1ee;
          color: #34483b;
        }
        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .offers-message {
          background: #eef5ef;
          padding: 10px;
          border-radius: 8px;
          overflow-wrap: anywhere;
        }
        .offers-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .offers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
        }
        .offer-card {
          overflow: hidden;
          border: 1px solid #e0e9e2;
          border-radius: 12px;
          background: white;
        }
        .offer-card > img {
          display: block;
          width: 100%;
          height: 145px;
          object-fit: cover;
          background: #f0f4f0;
        }
        .offer-card-body {
          padding: 12px;
        }
        .offer-card h3 {
          margin: 0 0 10px;
          overflow-wrap: anywhere;
        }
        .status {
          display: inline-block;
          border-radius: 20px;
          padding: 4px 9px;
          font-size: 12px;
        }
        .status.active {
          background: #e1f5e7;
          color: #176b43;
        }
        .status.inactive {
          background: #f1f1f1;
          color: #666;
        }
        .offer-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .offer-card-actions button {
          flex: 1;
          border: 0;
          border-radius: 7px;
          padding: 9px 6px;
          background: #eaf4ed;
          color: #176b43;
        }
        .offer-card-actions .delete-button {
          background: #fff0ed;
          color: #b83224;
        }
        .offers-empty {
          padding: 18px;
          background: white;
          border-radius: 10px;
          color: #66756c;
        }
        @media (max-width: 480px) {
          .offers-page {
            padding: 12px 12px calc(150px + env(safe-area-inset-bottom));
          }
          h1 {
            font-size: 21px;
          }
          .offers-form {
            padding: 13px;
          }
          .offers-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }
          .offer-card > img {
            height: 105px;
          }
          .offer-card-body {
            padding: 9px;
          }
          .offer-card-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
