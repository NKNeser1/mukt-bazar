import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language-provider";
import SiteShell from "@/components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "মুক্ত বাজার | Mukt Bazar",
    template: "%s | মুক্ত বাজার",
  },
  description:
    "মুক্ত বাজার — বাংলাদেশের অনলাইন শপ। পছন্দের পণ্য খুঁজুন, সহজে অর্ডার করুন এবং ঘরে বসে কেনাকাটা করুন।",
  applicationName: "মুক্ত বাজার",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    siteName: "মুক্ত বাজার | Mukt Bazar",
    title: "মুক্ত বাজার | Mukt Bazar",
    description:
      "প্রতিদিনের কেনাকাটা হোক সহজ। অনলাইনে পছন্দের পণ্য, সহজ অর্ডার।",
    images: [
      {
        url: "/social-banner.png",
        width: 1424,
        height: 752,
        alt: "মুক্ত বাজার — প্রতিদিনের কেনাকাটা হোক সহজ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "মুক্ত বাজার | Mukt Bazar",
    description:
      "প্রতিদিনের কেনাকাটা হোক সহজ। অনলাইনে পছন্দের পণ্য, সহজ অর্ডার।",
    images: ["/social-banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn">
      <body>
        <LanguageProvider>
          <SiteShell>{children}</SiteShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
