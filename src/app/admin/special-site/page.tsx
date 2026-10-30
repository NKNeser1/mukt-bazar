"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ImageAsset = { imageUrl: string; publicId: string } | null;

type WhatsAppNumber = {
  id: string;
  label: string;
  number: string;
  active: boolean;
  primary: boolean;
};

type Branding = {
  logo: ImageAsset;
  socialBanner: ImageAsset;
  intro: {
    image: ImageAsset;
    title: string;
    tagline: string;
    loadingText: string;
  };
};

type Section = "home" | "whatsapp" | "branding" | "intro";

const defaultBranding: Branding = {
  logo: null,
  socialBanner: null,
  intro: {
    image: null,
    title: "মুক্ত বাজার",
    tagline: "সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।",
    loadingText: "আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে...",
  },
};

export default function SpecialSitePage() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [section, setSection] = useState<Section>("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newNumber, setNewNumber] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editNumber, setEditNumber] = useState("");

  async function loadSettings() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/special-site", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "তথ্য লোড হয়নি।");
      }

      setNumbers(data.settings.whatsappNumbers || []);
      setBranding({
        ...defaultBranding,
        ...(data.settings.branding || {}),
        intro: {
          ...defaultBranding.intro,
          ...(data.settings.branding?.intro || {}),
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "তথ্য লোড হয়নি।");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadSettings());
  }, []);

  async function savePart(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/special-site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "সংরক্ষণ করা যায়নি।");
      }

      setMessage(successMessage);
      await loadSettings();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "সংরক্ষণ হয়নি।");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveWhatsApp(updated: WhatsAppNumber[]) {
    const success = await savePart(
      { whatsappNumbers: updated },
      "WhatsApp নম্বরের পরিবর্তন সংরক্ষণ হয়েছে।",
    );

    if (success) setNumbers(updated);
    return success;
  }

  async function addNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = newLabel.trim();
    const number = newNumber.replace(/\D/g, "");

    if (!label || number.length < 8 || number.length > 15) {
      setMessage("নম্বরের নাম এবং সঠিক দেশের কোডসহ নম্বর দিন।");
      return;
    }

    if (numbers.length >= 20) {
      setMessage("সর্বোচ্চ ২০টি WhatsApp নম্বর যোগ করা যাবে।");
      return;
    }

    const updated = [
      ...numbers,
      {
        id: crypto.randomUUID().replace(/-/g, ""),
        label,
        number,
        active: true,
        primary: numbers.length === 0,
      },
    ];

    if (await saveWhatsApp(updated)) {
      setNewLabel("");
      setNewNumber("");
    }
  }

  function startEdit(item: WhatsAppNumber) {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditNumber(item.number);
  }

  async function saveEdit(id: string) {
    const label = editLabel.trim();
    const number = editNumber.replace(/\D/g, "");

    if (!label || number.length < 8 || number.length > 15) {
      setMessage("নম্বরের নাম এবং সঠিক নম্বর দিন।");
      return;
    }

    const updated = numbers.map((item) =>
      item.id === id ? { ...item, label, number } : item,
    );

    if (await saveWhatsApp(updated)) setEditingId("");
  }

  async function toggleActive(item: WhatsAppNumber) {
    if (
      item.active &&
      item.primary &&
      numbers.filter((number) => number.active).length === 1
    ) {
      setMessage("অন্তত একটি WhatsApp নম্বর সক্রিয় রাখতে হবে।");
      return;
    }

    const updated = numbers.map((number) => ({
      ...number,
      active: number.id === item.id ? !item.active : number.active,
    }));

    if (item.active && item.primary) {
      const replacement = updated.find(
        (number) => number.active && number.id !== item.id,
      );

      updated.forEach((number) => {
        number.primary = replacement
          ? number.id === replacement.id
          : false;
      });
    }

    if (!item.active && !updated.some((number) => number.primary)) {
      const replacement = updated.find((number) => number.active);
      if (replacement) replacement.primary = true;
    }

    await saveWhatsApp(updated);
  }

  async function deleteNumber(item: WhatsAppNumber) {
    if (
      item.active &&
      item.primary &&
      numbers.filter((number) => number.active).length === 1
    ) {
      setMessage("অন্তত একটি সক্রিয় WhatsApp নম্বর রাখতে হবে।");
      return;
    }

    if (!window.confirm(`"${item.label}" নম্বরটি মুছে ফেলবেন?`)) return;

    const updated = numbers.filter((number) => number.id !== item.id);

    if (item.primary) {
      const replacement = updated.find((number) => number.active);
      if (replacement) replacement.primary = true;
    }

    await saveWhatsApp(updated);
  }

  async function setPrimary(id: string) {
    const updated = numbers.map((item) => ({
      ...item,
      primary: item.id === id,
    }));

    await saveWhatsApp(updated);
  }

  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "intro" | "social-banner",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(type);
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);

      const response = await fetch("/api/admin/special-site/upload", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "ছবি আপলোড হয়নি।");
      }

      const asset = {
        imageUrl: data.imageUrl,
        publicId: data.publicId,
      };

      if (type === "logo") {
        setBranding((old) => ({ ...old, logo: asset }));
      } else if (type === "intro") {
        setBranding((old) => ({
          ...old,
          intro: { ...old.intro, image: asset },
        }));
      } else {
        setBranding((old) => ({ ...old, socialBanner: asset }));
      }

      setMessage("ছবি আপলোড হয়েছে। পরিবর্তন সংরক্ষণ করুন।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ছবি আপলোড হয়নি।");
    } finally {
      setUploading("");
    }
  }

  async function saveBrandingImages() {
    await savePart(
      {
        branding: {
          logo: branding.logo,
          socialBanner: branding.socialBanner,
        },
      },
      "ওয়েবসাইট ব্র্যান্ডিং সংরক্ষণ হয়েছে।",
    );
  }

  async function saveIntro() {
    await savePart(
      {
        branding: {
          intro: {
            image: branding.intro.image,
            title: branding.intro.title,
            tagline: branding.intro.tagline,
            loadingText: branding.intro.loadingText,
          },
        },
      },
      "ইন্ট্রোর সেটিংস সংরক্ষণ হয়েছে।",
    );
  }

  function updateIntro(
    field: "title" | "tagline" | "loadingText",
    value: string,
  ) {
    setBranding((old) => ({
      ...old,
      intro: { ...old.intro, [field]: value },
    }));
  }

  function imageUpload(
    title: string,
    type: "logo" | "intro" | "social-banner",
    asset: ImageAsset,
  ) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="font-bold">{title}</h3>

        {asset && (
          <Image
            src={asset.imageUrl}
            alt={title}
            width={640}
            height={320}
            className="mt-3 max-h-40 max-w-full rounded-xl object-contain"
          />
        )}

        <label className="mt-4 block cursor-pointer rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-800">
          {uploading === type ? "আপলোড হচ্ছে..." : "নতুন ছবি আপলোড"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={Boolean(uploading)}
            onChange={(event) => void uploadImage(event, type)}
          />
        </label>

        {asset && (
          <button
            type="button"
            onClick={() => {
              if (type === "logo") {
                setBranding((old) => ({ ...old, logo: null }));
              } else if (type === "intro") {
                setBranding((old) => ({
                  ...old,
                  intro: { ...old.intro, image: null },
                }));
              } else {
                setBranding((old) => ({ ...old, socialBanner: null }));
              }
            }}
            className="mt-2 w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
          >
            ছবি সরিয়ে দিন
          </button>
        )}

        <p className="mt-2 text-xs text-gray-400">
          সর্বোচ্চ ৫ MB · JPG, PNG, WebP, AVIF
        </p>
      </div>
    );
  }

  const buttonClass =
    "w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f8f5] p-6">
        <p className="text-center font-semibold text-green-800">
          বিশেষ সাইটের তথ্য লোড হচ্ছে...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8f5] px-4 py-6 pb-24 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <a href="/admin" className="text-sm font-semibold text-green-700">
            ← অ্যাডমিন ড্যাশবোর্ড
          </a>
          <h1 className="mt-3 text-2xl font-extrabold">বিশেষ সাইট</h1>
          <p className="mt-1 text-sm text-gray-500">
            ওয়েবসাইটের বিশেষ সেটিংস পরিচালনা করুন।
          </p>
        </header>

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            {message}
          </div>
        )}

        {section === "home" && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-white p-3 text-center">
                <p className="text-xs text-gray-500">মোট নম্বর</p>
                <p className="mt-1 text-xl font-extrabold">{numbers.length}</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
                <p className="text-xs text-green-700">সক্রিয়</p>
                <p className="mt-1 text-xl font-extrabold text-green-800">
                  {numbers.filter((item) => item.active).length}
                </p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                <p className="text-xs text-red-700">নিষ্ক্রিয়</p>
                <p className="mt-1 text-xl font-extrabold text-red-700">
                  {numbers.filter((item) => !item.active).length}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">WhatsApp সেটিংস</h2>
                <p className="mt-1 text-sm text-gray-500">
                  নম্বর যোগ, সম্পাদনা ও সক্রিয় বা নিষ্ক্রিয় করুন।
                </p>
                <button
                  type="button"
                  onClick={() => setSection("whatsapp")}
                  className={`${buttonClass} mt-4`}
                >
                  WhatsApp সেটিংস খুলুন
                </button>
              </section>

              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">
                  ওয়েবসাইট ব্র্যান্ডিং
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  ওয়েবসাইটের লোগো ও সোশ্যাল ব্যানার পরিচালনা করুন।
                </p>
                <button
                  type="button"
                  onClick={() => setSection("branding")}
                  className={`${buttonClass} mt-4`}
                >
                  ব্র্যান্ডিং সেটিংস খুলুন
                </button>
              </section>

              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">ইন্ট্রো সেটিংস</h2>
                <p className="mt-1 text-sm text-gray-500">
                  ইন্ট্রোর ছবি, শিরোনাম ও লেখা পরিবর্তন করুন।
                </p>
                <button
                  type="button"
                  onClick={() => setSection("intro")}
                  className={`${buttonClass} mt-4`}
                >
                  ইন্ট্রো সেটিংস খুলুন
                </button>
              </section>
            </div>
          </>
        )}

        {section !== "home" && (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setSection("home");
                setEditingId("");
                setMessage("");
              }}
              className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-bold text-green-800"
            >
              ← বিশেষ সাইটের মূল পেজে ফিরুন
            </button>
          </div>
        )}

        {section === "whatsapp" && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">WhatsApp নম্বর</h2>
            <p className="mt-1 text-sm text-gray-500">
              একটি ফর্ম থেকে নতুন নম্বর যোগ করুন। যোগ করা নম্বরগুলো নিচে থাকবে।
            </p>

            <form
              onSubmit={(event) => void addNumber(event)}
              className="mt-5 space-y-3 rounded-xl bg-gray-50 p-4"
            >
              <h3 className="font-bold">নতুন নম্বর যোগ করুন</h3>

              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="নম্বরের নাম"
                required
                className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
              />

              <input
                value={newNumber}
                onChange={(event) =>
                  setNewNumber(event.target.value.replace(/\D/g, ""))
                }
                placeholder="দেশের কোডসহ নম্বর, যেমন 8801XXXXXXXXX"
                inputMode="numeric"
                required
                className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
              />

              <button
                type="submit"
                disabled={saving || Boolean(uploading)}
                className={buttonClass}
              >
                {saving ? "সংরক্ষণ হচ্ছে..." : "+ নম্বর যোগ ও সংরক্ষণ"}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <h3 className="font-bold">
                সংরক্ষিত নম্বর ({numbers.length})
              </h3>

              {numbers.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <input
                        value={editLabel}
                        onChange={(event) => setEditLabel(event.target.value)}
                        placeholder="নম্বরের নাম"
                        className="w-full rounded-xl border px-3 py-3 text-sm"
                      />
                      <input
                        value={editNumber}
                        onChange={(event) =>
                          setEditNumber(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="দেশের কোডসহ নম্বর"
                        inputMode="numeric"
                        className="w-full rounded-xl border px-3 py-3 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit(item.id)}
                          className="flex-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          সংরক্ষণ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId("")}
                          className="rounded-lg border px-3 py-2 text-sm font-bold"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">{item.label}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {item.number}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            item.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                        </span>
                      </div>

                      {item.primary && (
                        <p className="mt-2 text-xs font-bold text-green-700">
                          ✓ Primary নম্বর
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => startEdit(item)}
                          className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700"
                        >
                          এডিট
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleActive(item)}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                            item.active
                              ? "border-orange-200 text-orange-700"
                              : "border-green-200 text-green-700"
                          }`}
                        >
                          {item.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                        </button>
                        <button
                          type="button"
                          disabled={saving || !item.active || item.primary}
                          onClick={() => void setPrimary(item.id)}
                          className="rounded-lg border border-green-200 px-3 py-2 text-sm font-bold text-green-700 disabled:opacity-40"
                        >
                          Primary করুন
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void deleteNumber(item)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600"
                        >
                          ডিলিট
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {numbers.length === 0 && (
                <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">
                  এখনো কোনো WhatsApp নম্বর যোগ করা হয়নি।
                </p>
              )}
            </div>
          </section>
        )}

        {section === "branding" && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-extrabold">
              ওয়েবসাইট ব্র্যান্ডিং
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {imageUpload("ওয়েবসাইটের লোগো", "logo", branding.logo)}
              {imageUpload(
                "সোশ্যাল শেয়ারিং ব্যানার",
                "social-banner",
                branding.socialBanner,
              )}
            </div>

            <button
              type="button"
              disabled={saving || Boolean(uploading)}
              onClick={() => void saveBrandingImages()}
              className={`${buttonClass} mt-5`}
            >
              {saving ? "সংরক্ষণ হচ্ছে..." : "ব্র্যান্ডিং সংরক্ষণ"}
            </button>
          </section>
        )}

        {section === "intro" && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-extrabold">ইন্ট্রো সেটিংস</h2>

            <div className="mb-5">
              {imageUpload(
                "ইন্ট্রো স্ক্রিনের ছবি",
                "intro",
                branding.intro.image,
              )}
            </div>

            <label className="mb-1 block text-sm font-medium">
              শিরোনাম
            </label>
            <input
              value={branding.intro.title}
              onChange={(event) => updateIntro("title", event.target.value)}
              className="mb-4 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-600"
            />

            <label className="mb-1 block text-sm font-medium">
              ট্যাগলাইন
            </label>
            <textarea
              rows={3}
              value={branding.intro.tagline}
              onChange={(event) => updateIntro("tagline", event.target.value)}
              className="mb-4 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-600"
            />

            <label className="mb-1 block text-sm font-medium">
              Loading লেখা
            </label>
            <input
              value={branding.intro.loadingText}
              onChange={(event) =>
                updateIntro("loadingText", event.target.value)
              }
              className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-600"
            />

            <button
              type="button"
              disabled={saving || Boolean(uploading)}
              onClick={() => void saveIntro()}
              className={`${buttonClass} mt-5`}
            >
              {saving ? "সংরক্ষণ হচ্ছে..." : "ইন্ট্রো সংরক্ষণ"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
