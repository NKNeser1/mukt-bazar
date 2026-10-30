"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function IntroScreen() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [animation, setAnimation] = useState(0);

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

  return (
    <div className="mb-intro-overlay" role="status" aria-label="মুক্ত বাজার লোড হচ্ছে">
      <div className={`mb-intro-content mb-intro-motion-${animation}`}>
        <Image
          className="mb-intro-logo"
          src="/logo.png"
          alt="মুক্ত বাজার"
          width={256}
          height={256}
          priority
        />

        <h1 className="mb-intro-title">
          <span>মুক্ত</span> বাজার
        </h1>

        <p className="mb-intro-tagline">
          সবার জন্য সেরা পণ্য, সবার জন্য মুক্ত বাজার।
        </p>

        <div className="mb-intro-progress">
          <span />
        </div>

        <p className="mb-intro-loading">আপনার জন্য সেরা পণ্য খোঁজা হচ্ছে...</p>
      </div>
    </div>
  );
}