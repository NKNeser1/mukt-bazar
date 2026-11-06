"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "@/components/language-provider";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const en = language === "en";
  const [siteLogo, setSiteLogo] = useState("/logo.png");

  useEffect(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((data) => {
        setSiteLogo(data.branding?.logo?.imageUrl || "/logo.png");
      })
      .catch(() => setSiteLogo("/logo.png"));
  }, []);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");

    const cleanName = name.trim();
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 100) {
      setError(en ? "Enter a valid name." : "সঠিক নাম লিখুন।");
      return;
    }

    if (!/^[+\d][\d\s()-]{6,19}$/.test(cleanMobile)) {
      setError(en ? "Enter a valid mobile number." : "সঠিক মোবাইল নম্বর লিখুন।");
      return;
    }

    if (password.length < 8) {
      setError(
        en
          ? "Password must be at least 8 characters."
          : "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(en ? "Passwords do not match." : "দুটি পাসওয়ার্ড মিলছে না।");
      return;
    }

    setLoading(true);

    try {
      await signOut(auth).catch(() => {});

      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );

      await updateProfile(credential.user, {
        displayName: cleanName,
      });

      const idToken = await credential.user.getIdToken(true);

      const response = await fetch("/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          name: cleanName,
          mobile: cleanMobile,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(
          result?.message ||
            (en
              ? "Account created, but session could not be started. Please try again."
              : "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু সেশন চালু হয়নি। আবার চেষ্টা করুন।"),
        );
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const messages: Record<string, string> = {
        "auth/email-already-in-use": en
          ? "This email is already registered."
          : "এই ইমেইলে আগে থেকেই অ্যাকাউন্ট রয়েছে।",
        "auth/invalid-email": en
          ? "Enter a valid email address."
          : "সঠিক ইমেইল ঠিকানা লিখুন।",
        "auth/weak-password": en
          ? "Choose a stronger password."
          : "আরও শক্তিশালী পাসওয়ার্ড দিন।",
        "auth/operation-not-allowed": en
          ? "Email registration is not enabled in Firebase."
          : "Firebase-এ Email/Password চালু নেই।",
        "auth/api-key-not-valid": en
          ? "Firebase API key is invalid."
          : "Firebase API Key সঠিক নয়।",
        "auth/network-request-failed": en
          ? "Check your internet connection."
          : "ইন্টারনেট সংযোগ পরীক্ষা করুন।",
        "auth/too-many-requests": en
          ? "Too many attempts. Try again later."
          : "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করুন।",
      };

      setError(
        messages[code] ||
          (code
            ? `Registration failed: ${code}`
            : en
              ? "Registration failed. Please try again."
              : "রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="customer-register">
      <section className="register-card">
        <div className="register-heading">
          <div className="register-logo">
            <Image
              src={siteLogo}
              alt="মুক্ত বাজার"
              width={48}
              height={48}
              unoptimized
            />
          </div>
          <h1>মুক্ত বাজার</h1>
          <p>
            {en
              ? "Create your customer account"
              : "আপনার Customer অ্যাকাউন্ট তৈরি করুন"}
          </p>
        </div>

        <div className="register-body">
          <h2>{en ? "Create Account" : "নতুন অ্যাকাউন্ট খুলুন"}</h2>
          <p className="register-subtitle">
            {en
              ? "Fill in your information to get started."
              : "অ্যাকাউন্ট খুলতে নিচের তথ্যগুলো পূরণ করুন।"}
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="customer-name">
              {en ? "Full Name" : "আপনার নাম"}
            </label>
            <input
              id="customer-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={en ? "Your full name" : "আপনার সম্পূর্ণ নাম"}
              maxLength={100}
              required
            />

            <label htmlFor="customer-mobile">
              {en ? "Mobile Number" : "মোবাইল নম্বর"}
            </label>
            <input
              id="customer-mobile"
              type="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              required
            />

            <label htmlFor="customer-email">
              {en ? "Email Address" : "ইমেইল ঠিকানা"}
            </label>
            <input
              id="customer-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
            />

            <label htmlFor="customer-password">
              {en ? "Password" : "পাসওয়ার্ড"}
            </label>
            <div className="register-password">
              <input
                id="customer-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={en ? "At least 8 characters" : "কমপক্ষে ৮ অক্ষর"}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword
                  ? en ? "Hide" : "লুকান"
                  : en ? "Show" : "দেখুন"}
              </button>
            </div>

            <label htmlFor="customer-confirm-password">
              {en ? "Confirm Password" : "পাসওয়ার্ড আবার লিখুন"}
            </label>
            <input
              id="customer-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={en ? "Enter password again" : "পাসওয়ার্ড আবার লিখুন"}
              required
            />

            {error && (
              <p className="register-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading
                ? en ? "Creating account..." : "অ্যাকাউন্ট তৈরি হচ্ছে..."
                : en ? "Create Account" : "অ্যাকাউন্ট তৈরি করুন"}
            </button>
          </form>

          <p className="register-login">
            {en ? "Already have an account?" : "আগে থেকেই অ্যাকাউন্ট আছে?"}
            {" "}
            <a href="/account/login">
              {en ? "Login" : "লগইন"}
            </a>
          </p>

          <Link href="/" className="register-home">
            {en ? "← Back to Home" : "← হোমপেজে ফিরে যান"}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .customer-register {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px 14px;
          background: var(--page);
        }
        .register-card {
          width: 100%;
          max-width: 440px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--white);
          color: var(--text);
          box-shadow: var(--shadow);
        }
        .register-heading {
          padding: 27px 20px;
          text-align: center;
          color: white;
          background: linear-gradient(135deg, var(--green-dark), var(--green));
        }
        .register-logo {
          display: grid;
          width: 58px;
          height: 58px;
          margin: 0 auto 10px;
          place-items: center;
          border: 1px solid #ffffff40;
          border-radius: 17px;
          background: #ffffff20;
          font-size: 28px;
        }
        .register-logo img {
          width: 48px;
          height: 48px;
          object-fit: contain;
        }
        .register-heading h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
        }
        .register-heading p {
          margin: 5px 0 0;
          color: #e5f4e9;
          font-size: 13px;
        }
        .register-body {
          padding: 23px;
          color: var(--text);
        }
        .register-body h2 {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
        }
        .register-subtitle {
          margin: 5px 0 19px;
          color: var(--muted);
          font-size: 13px;
        }
        .register-body label {
          display: block;
          margin: 13px 0 6px;
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
        }
        .register-body input {
          width: 100%;
          min-height: 46px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          outline: none;
          background: var(--page);
          color: var(--text);
          font-size: 14px;
        }
        .register-body input:focus {
          border-color: var(--green);
          background: var(--white);
        }
        .register-body input::placeholder {
          color: var(--muted);
          opacity: 1;
        }
        .register-password {
          position: relative;
        }
        .register-password input {
          padding-right: 70px;
        }
        .register-password button {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: var(--green);
          font-size: 12px;
          font-weight: 700;
        }
        .register-error {
          margin: 15px 0 0;
          padding: 10px 12px;
          border-radius: 9px;
          background: #fff0f0;
          color: #b42318;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .register-submit {
          width: 100%;
          min-height: 48px;
          margin-top: 21px;
          border: 0;
          border-radius: 11px;
          background: var(--green);
          color: white;
          font-weight: 800;
        }
        .register-submit:disabled {
          opacity: 0.6;
        }
        .register-login {
          margin: 19px 0 8px;
          text-align: center;
          color: var(--muted);
          color: var(--muted);
          font-size: 13px;
        }
        .register-login a,
        .register-home {
          color: var(--green);
          font-weight: 700;
        }
        .register-home {
          display: block;
          margin-top: 14px;
          text-align: center;
          font-size: 13px;
        }
        @media (max-width: 380px) {
          .register-body {
            padding: 18px;
          }
        }
      `}</style>
    </main>
  );
}
