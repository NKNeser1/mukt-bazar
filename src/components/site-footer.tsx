"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const groups = [
  {
    title: "মুক্ত বাজার",
    links: [
      { href: "/info/about", label: "আমাদের সম্পর্কে" },
      { href: "/info/contact", label: "যোগাযোগ করুন" },
    ],
  },
  {
    title: "ক্রেতা সেবা",
    links: [
      { href: "/info/delivery", label: "ডেলিভারি সম্পর্কে" },
      { href: "/info/returns", label: "রিটার্ন ও রিফান্ড" },
    ],
  },
  {
    title: "নীতি ও শর্তাবলি",
    links: [
      { href: "/info/privacy", label: "গোপনীয়তা নীতি" },
      { href: "/info/terms", label: "ব্যবহারের শর্তাবলি" },
      { href: "/info/disclaimer", label: "সতর্কতা ও দায়সীমা" },
    ],
  },
];

export default function SiteFooter() {
  const [siteLogo, setSiteLogo] = useState("/logo.png");

  useEffect(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((data) => {
        setSiteLogo(data.branding?.logo?.imageUrl || "/logo.png");
      })
      .catch(() => setSiteLogo("/logo.png"));
  }, []);

  return (
    <footer className="mb-footer">
      <div className="mb-footer-top">
        <Link className="mb-brand" href="/">
          <Image
            src={siteLogo}
            alt="মুক্ত বাজার"
            width={120}
            height={120}
            className="mb-brand-logo"
            unoptimized
          />
          <span>
            <strong>মুক্ত বাজার</strong>
            <small>MUKT BAZAR</small>
          </span>
        </Link>
        <p>প্রতিদিনের কেনাকাটা হোক সহজ, স্বচ্ছ ও আনন্দময়।</p>
      </div>

      <div className="mb-footer-links">
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mb-footer-bottom">
        <span>© {new Date().getFullYear()} Mukt Bazar</span>
        <Link href="/">হোমপেজে ফিরে যান</Link>
      </div>
    </footer>
  );
}
