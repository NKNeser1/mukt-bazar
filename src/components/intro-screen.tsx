"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

type Branding = {
  logo?: { imageUrl: string } | null;
  intro?: {
    image?: { imageUrl: string } | null;
    title?: string;
    tagline?: string;
    loadingText?: string;
  };
};

const defaultBranding: Branding = {
  logo: null,
  intro: {
    image: null,
    title: "মুক্ত বাজার",
    tagline: "সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।",
    loadingText: "আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে...",
  },
};

export default function IntroScreen() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [animation, setAnimation] = useState(0);
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const controller = new AbortController();

    async function loadBranding() {
      try {
        const response = await fetch("/api/site-settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data.success && data.branding) {
          setBranding(data.branding);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[Intro Branding]", error);
        }
      }
    }

    void loadBranding();

    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    let hideTimer: ReturnType<typeof setTimeout>;
    const initTimer = setTimeout(() => {
      try {
        if (sessionStorage.getItem("mb-intro-shown")) {
          setVisible(false);
          return;
        }

        const count = Number(
          localStorage.getItem("mb-intro-count") || "0"
        );

        setAnimation(count % 3);
        localStorage.setItem("mb-intro-count", String(count + 1));
        sessionStorage.setItem("mb-intro-shown", "1");
      } catch {
        setAnimation(Math.floor(Math.random() * 3));
      }

      hideTimer = setTimeout(() => setVisible(false), 1500);
    }, 0);

    return () => {
      clearTimeout(initTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [pathname]);

  if (pathname.startsWith("/admin") || !visible) return null;

  const intro = branding.intro;
  const imageUrl =
    intro?.image?.imageUrl ||
    branding.logo?.imageUrl ||
    "/logo.png";

  return (
    <div className="mb-intro-overlay" role="status" aria-label="মুক্ত বাজার লোড হচ্ছে">
      <div className={`mb-intro-content mb-intro-motion-${animation}`}>
        <Image
          className="mb-intro-logo"
          src={imageUrl}
          alt={intro?.title || "মুক্ত বাজার"}
          width={256}
          height={256}
          priority
          unoptimized
        />

        <h1 className="mb-intro-title">
          {intro?.title || "মুক্ত বাজার"}
        </h1>

        <p className="mb-intro-tagline">
          {intro?.tagline || "সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।"}
        </p>

        <div className="mb-intro-progress">
          <span />
        </div>

        <p className="mb-intro-loading">
          {intro?.loadingText || "আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে..."}
        </p>
      </div>
    </div>
  );
}
