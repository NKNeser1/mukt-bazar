"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { customerAuth } from "@/lib/customer-auth";
import { useLanguage } from "@/components/language-provider";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const en = language === "en";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getErrorMessage = (code: string) => {
    const messages: Record<string, [string, string]> = {
      "auth/invalid-email": [
        "ইমেইল ঠিকানা সঠিক নয়।",
        "The email address is invalid.",
      ],
      "auth/invalid-credential": [
        "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।",
        "Incorrect email or password.",
      ],
      "auth/user-not-found": [
        "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",
        "No account was found with this email.",
      ],
      "auth/wrong-password": [
        "পাসওয়ার্ড সঠিক নয়।",
        "The password is incorrect.",
      ],
      "auth/user-disabled": [
        "এই অ্যাকাউন্টটি বন্ধ রাখা হয়েছে।",
        "This account has been disabled.",
      ],
      "auth/too-many-requests": [
        "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
        "Too many attempts. Please try again later.",
      ],
      "auth/network-request-failed": [
        "ইন্টারনেট সংযোগ পরীক্ষা করুন।",
        "Please check your internet connection.",
      ],
      "auth/operation-not-allowed": [
        "ইমেইল ও পাসওয়ার্ড লগইন চালু নেই।",
        "Email and password sign-in is not enabled.",
      ],
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.": [
        "Firebase API Key সঠিক নয়।",
        "The Firebase API key is invalid.",
      ],
    };

    return messages[code]?.[en ? 1 : 0] ||
      (en ? "Something went wrong. Please try again." : "সমস্যা হয়েছে। আবার চেষ্টা করুন।");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError(en ? "Enter your email and password." : "ইমেইল ও পাসওয়ার্ড লিখুন।");
      return;
    }

    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        customerAuth,
        email.trim(),
        password
      );

      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await signOut(customerAuth);
        throw new Error(
          result.error ||
          (en ? "Customer login was not successful." : "কাস্টমার লগইন সফল হয়নি।")
        );
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      const error = err as Error & { code?: string };

      if (error.code) {
        setError(getErrorMessage(error.code));
      } else {
        setError(
          error.message ||
          (en ? "Login failed. Please try again." : "লগইন করা যায়নি। আবার চেষ্টা করুন।")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        en
          ? "Enter your registered email address first."
          : "প্রথমে আপনার রেজিস্টার করা ইমেইল লিখুন।"
      );
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(customerAuth, email.trim());

      setSuccess(
        en
          ? "Password reset link has been sent. Please check your email inbox and spam folder."
          : "পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।"
      );
    } catch (err) {
      const error = err as Error & { code?: string };

      setError(
        error.code
          ? getErrorMessage(error.code)
          : error.message ||
            (en ? "Could not send reset email." : "রিসেট ইমেইল পাঠানো যায়নি।")
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="customer-login">
      <section className="login-card">
        <div className="login-heading">
          <h1>{en ? "Customer Login" : "কাস্টমার লগইন"}</h1>
          <p>
            {en
              ? "Sign in to view your account and orders."
              : "আপনার অ্যাকাউন্ট ও অর্ডার দেখতে লগইন করুন।"}
          </p>
        </div>

        <form className="login-body" onSubmit={handleLogin}>
          <label htmlFor="login-email">
            {en ? "Email address" : "ইমেইল ঠিকানা"}
          </label>

          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={en ? "Enter your email" : "আপনার ইমেইল লিখুন"}
            required
          />

          <label htmlFor="login-password">
            {en ? "Password" : "পাসওয়ার্ড"}
          </label>

          <div className="login-password">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={en ? "Enter your password" : "পাসওয়ার্ড লিখুন"}
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

          <button
            type="button"
            className="login-reset"
            onClick={handlePasswordReset}
            disabled={resetLoading || loading}
          >
            {resetLoading
              ? en ? "Sending..." : "পাঠানো হচ্ছে..."
              : en ? "Forgot password? Reset it" : "পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন"}
          </button>

          {error && <p className="login-error" role="alert">{error}</p>}
          {success && <p className="login-success" role="status">{success}</p>}

          <button
            type="submit"
            className="login-submit"
            disabled={loading || resetLoading}
          >
            {loading
              ? en ? "Signing in..." : "লগইন হচ্ছে..."
              : en ? "Login" : "লগইন"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {en ? "Don't have an account?" : "অ্যাকাউন্ট নেই?"}{" "}
            <Link href="/account/register">
              {en ? "Register" : "রেজিস্ট্রেশন করুন"}
            </Link>
          </p>

          <Link href="/">
            {en ? "Back to home" : "হোমপেজে ফিরে যান"}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .customer-login {
          min-height: 65vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 14px;
          color: var(--text, #202a22);
        }

        .login-card {
          width: 100%;
          max-width: 430px;
          overflow: hidden;
          border: 1px solid var(--border, #e8ece6);
          border-radius: 16px;
          background: var(--white, #fff);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
        }

        .login-heading {
          padding: 24px 22px 18px;
          text-align: center;
          border-bottom: 1px solid var(--border, #e8ece6);
        }

        .login-heading h1 {
          margin: 0 0 8px;
          color: var(--green, #176b43);
          font-size: 23px;
          font-weight: 800;
        }

        .login-heading p {
          margin: 0;
          color: var(--muted, #788178);
          font-size: 13px;
        }

        .login-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 22px;
        }

        .login-body label {
          font-size: 14px;
          font-weight: 700;
        }

        .login-body input {
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid var(--border, #e8ece6);
          border-radius: 9px;
          outline: none;
          background: var(--page, #f7f9f6);
          color: var(--text, #202a22);
          font: inherit;
          font-size: 14px;
        }

        .login-body input:focus {
          border-color: var(--green, #176b43);
        }

        .login-password {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .login-password button {
          flex-shrink: 0;
          padding: 10px;
          border: 1px solid var(--border, #e8ece6);
          border-radius: 8px;
          background: var(--page, #f7f9f6);
          color: var(--green, #176b43);
          font-weight: 700;
        }

        .login-reset {
          align-self: flex-end;
          padding: 3px 0;
          border: 0;
          background: transparent;
          color: var(--green, #176b43);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-reset:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-submit {
          margin-top: 8px;
          padding: 13px;
          border: 0;
          border-radius: 9px;
          background: var(--green, #176b43);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }

        .login-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .login-error,
        .login-success {
          margin: 3px 0;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .login-error {
          background: #fff0ef;
          color: #b42318;
        }

        .login-success {
          background: #e9f5eb;
          color: #176b43;
        }

        .login-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 0 20px 22px;
          font-size: 13px;
          text-align: center;
        }

        .login-footer p {
          margin: 0;
        }

        .login-footer a {
          color: var(--green, #176b43);
          font-weight: 700;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
