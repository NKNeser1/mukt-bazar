"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { customerAuth } from "@/lib/customer-auth";
import { useLanguage } from "@/components/language-provider";

type Customer = {
  uid: string;
  name: string;
  mobile: string;
  email: string;
  emailVerified: boolean;
  address: string;
  photoURL: string;
  mobileVerified: boolean;
};

export default function CustomerProfilePage() {
  const router = useRouter();
  const { language } = useLanguage();
  const en = language === "en";
  const photoInput = useRef<HTMLInputElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [siteLogo, setSiteLogo] = useState("/logo.png");
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((data) => {
        if (active) {
          setSiteLogo(data.branding?.logo?.imageUrl || "/logo.png");
        }
      })
      .catch(() => {
        if (active) setSiteLogo("/logo.png");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(customerAuth, async (user) => {
      if (!user) {
        router.replace("/account/login");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/customer/session", {
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success || !result.customer) {
          router.replace("/account/login");
          return;
        }

        const data = result.customer as Customer;
        setCustomer(data);
        setName(data.name || "");
        setMobile(data.mobile || "");
        setEmail(data.email || user.email || "");
        setAddress(data.address || "");
        setPhotoURL(data.photoURL || "");
      } catch {
        setError(
          en
            ? "Could not load your profile. Please try again."
            : "প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।",
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, en]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, address }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "PROFILE_SAVE_FAILED");
      }

      setCustomer((previous) =>
        previous
          ? {
              ...previous,
              name: result.customer.name,
              mobile: result.customer.mobile,
              address: result.customer.address,
              mobileVerified: result.customer.mobileVerified,
            }
          : previous,
      );
      setName(result.customer.name);
      setMobile(result.customer.mobile);
      setAddress(result.customer.address);
      setMessage(
        en ? "Profile updated successfully." : "প্রোফাইল সফলভাবে আপডেট হয়েছে।",
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "PROFILE_SAVE_FAILED"
          ? err.message
          : en
            ? "Could not update profile. Check your information."
            : "প্রোফাইল আপডেট হয়নি। তথ্যগুলো পরীক্ষা করুন।",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setMessage("");

    if (file.size > 5 * 1024 * 1024) {
      setError(
        en ? "Image must be within 5 MB." : "ছবির আকার ৫ MB-এর মধ্যে হতে হবে।",
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setPhotoLoading(true);

    try {
      const response = await fetch("/api/customer/profile/photo", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "PHOTO_UPLOAD_FAILED");
      }

      setPhotoURL(result.photoURL || "");
      setCustomer((previous) =>
        previous ? { ...previous, photoURL: result.photoURL || "" } : previous,
      );
      setMessage(
        en ? "Profile photo updated." : "প্রোফাইল ছবি আপডেট হয়েছে।",
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "PHOTO_UPLOAD_FAILED"
          ? err.message
          : en
            ? "Photo upload failed. Please try again."
            : "ছবি আপলোড হয়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleRemovePhoto() {
    if (!photoURL) return;

    setError("");
    setMessage("");
    setPhotoLoading(true);

    try {
      const response = await fetch("/api/customer/profile/photo", {
        method: "DELETE",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "PHOTO_DELETE_FAILED");
      }

      setPhotoURL("");
      setCustomer((previous) =>
        previous ? { ...previous, photoURL: "" } : previous,
      );
      setMessage(
        en ? "Profile photo removed." : "প্রোফাইল ছবি মুছে ফেলা হয়েছে।",
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "PHOTO_DELETE_FAILED"
          ? err.message
          : en
            ? "Could not remove photo."
            : "ছবি মুছে ফেলা যায়নি।",
      );
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleEmailVerification() {
    const user = customerAuth.currentUser;
    if (!user) {
      router.replace("/account/login");
      return;
    }

    const newEmail = email.trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError(en ? "Enter a valid email address." : "সঠিক ইমেইল লিখুন।");
      return;
    }

    setError("");
    setMessage("");
    setEmailLoading(true);

    try {
      if (newEmail !== (customer?.email || user.email || "").toLowerCase()) {
        await verifyBeforeUpdateEmail(user, newEmail);
        setMessage(
          en
            ? `A verification link was sent to ${newEmail}. Your account email will change only after verification.`
            : `${newEmail} ঠিকানায় যাচাই লিংক পাঠানো হয়েছে। যাচাই সম্পন্ন না হওয়া পর্যন্ত অ্যাকাউন্টের ইমেইল পরিবর্তন হবে না।`,
        );
      } else if (!user.emailVerified) {
        await sendEmailVerification(user);
        setMessage(
          en
            ? "Verification email sent. Check your inbox."
            : "যাচাই ইমেইল পাঠানো হয়েছে। আপনার Inbox পরীক্ষা করুন।",
        );
      } else {
        setMessage(
          en ? "Your email is already verified." : "আপনার ইমেইল যাচাই করা আছে।",
        );
      }
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const text =
        code === "auth/requires-recent-login"
          ? en
            ? "For security, sign in again and then change your email."
            : "নিরাপত্তার জন্য আবার লগইন করে ইমেইল পরিবর্তন করুন।"
          : code === "auth/email-already-in-use"
            ? en
              ? "This email is already used by another account."
              : "এই ইমেইল অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।"
            : code === "auth/invalid-email"
              ? en
                ? "Enter a valid email address."
                : "সঠিক ইমেইল লিখুন।"
              : code === "auth/too-many-requests"
                ? en
                  ? "Too many attempts. Try again later."
                  : "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করুন।"
                : en
                  ? "Could not send verification email. Check your connection and Firebase settings."
                  : "যাচাই ইমেইল পাঠানো যায়নি। ইন্টারনেট ও Firebase সেটিংস পরীক্ষা করুন।";

      setError(text);
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleRefreshVerification() {
    const user = customerAuth.currentUser;
    if (!user) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await reload(user);
      const refreshedUser = customerAuth.currentUser;

      if (refreshedUser) {
        setEmail(refreshedUser.email || "");
        const response = await fetch("/api/customer/session", {
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (response.ok && result?.success && result.customer) {
          setCustomer(result.customer as Customer);
          setEmail(result.customer.email || refreshedUser.email || "");
          setPhotoURL(result.customer.photoURL || "");
        }

        setMessage(
          refreshedUser.emailVerified
            ? en
              ? "Email verification confirmed."
              : "ইমেইল যাচাই সফল হয়েছে।"
            : en
              ? "Email is not verified yet. Open the verification link first."
              : "এখনো ইমেইল যাচাই হয়নি। আগে ইমেইলের লিংকটি খুলুন।",
        );
      }
    } catch {
      setError(
        en
          ? "Could not refresh verification status."
          : "যাচাইয়ের অবস্থা আপডেট করা যায়নি।",
      );
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <main className="customer-profile">
        <div className="profile-loading">
          {en ? "Loading profile..." : "প্রোফাইল লোড হচ্ছে..."}
        </div>
        <style jsx>{`
          .customer-profile {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            background: var(--page);
            color: var(--text);
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="customer-profile">
      <section className="profile-card">
        <div className="profile-heading">
          <div className="profile-logo">
            <Image
              src={siteLogo}
              alt="মুক্ত বাজার"
              width={48}
              height={48}
              unoptimized
            />
          </div>
          <h1>মুক্ত বাজার</h1>
          <p>{en ? "Manage your customer profile" : "আপনার Customer প্রোফাইল"}</p>
        </div>

        <div className="profile-body">
          <h2>{en ? "My Profile" : "আমার প্রোফাইল"}</h2>
          <p className="profile-subtitle">
            {en
              ? "Update your personal and delivery information."
              : "আপনার ব্যক্তিগত তথ্য ও ডেলিভারি ঠিকানা আপডেট করুন।"}
          </p>

          <div className="photo-section">
            <div className="photo-preview">
              <Image
                src={photoURL || siteLogo}
                alt="Customer profile"
                width={88}
                height={88}
                unoptimized
              />
            </div>
            <div className="photo-actions">
              <strong>{en ? "Profile Photo" : "প্রোফাইল ছবি"}</strong>
              <span>
                {en ? "JPG, PNG, WebP or AVIF · Max 5 MB" : "JPG, PNG, WebP বা AVIF · সর্বোচ্চ ৫ MB"}
              </span>
              <button
                type="button"
                className="small-button"
                disabled={photoLoading}
                onClick={() => photoInput.current?.click()}
              >
                {photoLoading
                  ? en ? "Please wait..." : "অপেক্ষা করুন..."
                  : photoURL
                    ? en ? "Change Photo" : "ছবি পরিবর্তন"
                    : en ? "Upload Photo" : "ছবি যোগ করুন"}
              </button>
              {photoURL && (
                <button
                  type="button"
                  className="text-button"
                  disabled={photoLoading}
                  onClick={handleRemovePhoto}
                >
                  {en ? "Remove photo" : "ছবি মুছুন"}
                </button>
              )}
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handlePhotoChange}
                hidden
              />
            </div>
          </div>

          {error && <div className="profile-error">{error}</div>}
          {message && <div className="profile-message">{message}</div>}

          <form onSubmit={handleSave}>
            <label htmlFor="profile-name">{en ? "Full Name" : "আপনার নাম"}</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />

            <label htmlFor="profile-mobile">
              {en ? "Bangladesh Mobile Number" : "বাংলাদেশি মোবাইল নম্বর"}
            </label>
            <input
              id="profile-mobile"
              type="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="+8801XXXXXXXXX"
              required
            />
            <div className="verification-row">
              <span className={customer?.mobileVerified ? "verified" : "unverified"}>
                {customer?.mobileVerified
                  ? en ? "Verified" : "যাচাইকৃত"
                  : en ? "Not verified · SMS verification unavailable" : "যাচাই হয়নি · SMS যাচাই চালু নেই"}
              </span>
            </div>

            <label htmlFor="profile-email">{en ? "Email Address" : "ইমেইল ঠিকানা"}</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              required
            />
            <div className="verification-row">
              <span className={customer?.emailVerified ? "verified" : "unverified"}>
                {customer?.emailVerified
                  ? en ? "Email verified" : "ইমেইল যাচাইকৃত"
                  : en ? "Email not verified" : "ইমেইল যাচাই হয়নি"}
              </span>
              <button
                type="button"
                className="text-button"
                disabled={emailLoading}
                onClick={handleEmailVerification}
              >
                {emailLoading
                  ? en ? "Sending..." : "পাঠানো হচ্ছে..."
                  : email !== (customer?.email || "").toLowerCase()
                    ? en ? "Verify new email" : "নতুন ইমেইল যাচাই"
                    : customer?.emailVerified
                      ? en ? "Email verified" : "যাচাইকৃত"
                      : en ? "Send verification" : "যাচাই ইমেইল পাঠান"}
              </button>
            </div>
            <button
              type="button"
              className="refresh-button"
              disabled={refreshing}
              onClick={handleRefreshVerification}
            >
              {refreshing
                ? en ? "Checking..." : "যাচাই হচ্ছে..."
                : en ? "Refresh email status" : "ইমেইল যাচাইয়ের অবস্থা দেখুন"}
            </button>

            <label htmlFor="profile-address">
              {en ? "Delivery Address" : "ডেলিভারি ঠিকানা"}
            </label>
            <textarea
              id="profile-address"
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={500}
              rows={4}
              required
            />

            <button type="submit" className="profile-submit" disabled={saving}>
              {saving
                ? en ? "Saving..." : "সংরক্ষণ হচ্ছে..."
                : en ? "Save Profile" : "প্রোফাইল সংরক্ষণ করুন"}
            </button>
          </form>

          <Link href="/" className="profile-home">
            {en ? "Back to Home" : "হোমপেজে ফিরে যান"}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .customer-profile {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 14px;
          background: var(--page);
          color: var(--text);
        }
        .profile-card {
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--white);
          color: var(--text);
          box-shadow: var(--shadow);
        }
        .profile-heading {
          padding: 25px 20px;
          text-align: center;
          color: white;
          background: linear-gradient(135deg, var(--green-dark), var(--green));
        }
        .profile-logo {
          width: 58px;
          height: 58px;
          margin: 0 auto 10px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 15px;
          background: white;
        }
        .profile-logo :global(img) {
          width: 48px;
          height: 48px;
          object-fit: contain;
        }
        .profile-heading h1 {
          margin: 0;
          font-size: 25px;
          font-weight: 800;
        }
        .profile-heading p {
          margin: 5px 0 0;
          color: #e5f4e9;
          font-size: 13px;
        }
        .profile-body {
          padding: 22px;
          color: var(--text);
        }
        .profile-body h2 {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
        }
        .profile-subtitle {
          margin: 5px 0 18px;
          color: var(--muted);
          font-size: 13px;
        }
        .photo-section {
          display: flex;
          align-items: center;
          gap: 15px;
          margin: 0 0 20px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 13px;
          background: var(--page);
        }
        .photo-preview {
          width: 88px;
          height: 88px;
          flex: 0 0 88px;
          overflow: hidden;
          border: 2px solid var(--border);
          border-radius: 50%;
          background: white;
        }
        .photo-preview :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .photo-actions {
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px 10px;
        }
        .photo-actions strong {
          width: 100%;
          font-size: 14px;
        }
        .photo-actions span {
          width: 100%;
          color: var(--muted);
          font-size: 11px;
        }
        .small-button {
          min-height: 34px;
          padding: 7px 11px;
          border: 0;
          border-radius: 8px;
          background: var(--green);
          color: white;
          font-size: 12px;
          font-weight: 700;
        }
        .profile-body label {
          display: block;
          margin: 14px 0 6px;
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
        }
        .profile-body input:not([type="file"]),
        .profile-body textarea {
          width: 100%;
          min-height: 45px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          outline: none;
          background: var(--page);
          color: var(--text);
          font: inherit;
          font-size: 14px;
        }
        .profile-body textarea {
          min-height: 95px;
          resize: vertical;
        }
        .profile-body input:focus,
        .profile-body textarea:focus {
          border-color: var(--green);
        }
        .verification-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-top: 7px;
          font-size: 12px;
        }
        .verified {
          color: #16834a;
          font-weight: 700;
        }
        .unverified {
          color: #b66a20;
          font-weight: 700;
        }
        .text-button,
        .refresh-button {
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--green);
          font-size: 12px;
          font-weight: 800;
          text-decoration: underline;
        }
        .text-button:disabled,
        .refresh-button:disabled {
          opacity: 0.55;
        }
        .refresh-button {
          display: block;
          margin-top: 9px;
          text-decoration: none;
        }
        .profile-error,
        .profile-message {
          margin: 13px 0;
          padding: 10px 12px;
          border-radius: 9px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .profile-error {
          background: #fff0f0;
          color: #b42318;
        }
        .profile-message {
          background: #eaf7ee;
          color: #176b43;
        }
        .profile-submit {
          width: 100%;
          min-height: 48px;
          margin-top: 21px;
          border: 0;
          border-radius: 11px;
          background: var(--green);
          color: white;
          font-weight: 800;
        }
        .profile-submit:disabled,
        .small-button:disabled {
          opacity: 0.6;
        }
        .profile-home {
          display: block;
          margin-top: 16px;
          text-align: center;
          color: var(--green);
          font-size: 13px;
          font-weight: 700;
        }
        @media (max-width: 380px) {
          .profile-body {
            padding: 18px;
          }
          .photo-section {
            gap: 10px;
            padding: 10px;
          }
          .photo-preview {
            width: 72px;
            height: 72px;
            flex-basis: 72px;
          }
        }
      `}</style>
    </main>
  );
}
