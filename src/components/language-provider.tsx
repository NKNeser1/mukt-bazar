
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "bn" | "en";
export type Theme = "light" | "dark";

const translations = {
  bn: {
    announcement: "মুক্ত বাজারে স্বাগতম",
    announcementSub: "সহজ কেনাকাটা, সবার জন্য",
    tagline: "আপনার বিশ্বস্ত অনলাইন শপ",
    search: "পণ্য খুঁজুন...",
    searchButton: "খুঁজুন",
    home: "হোম",
    categories: "ক্যাটাগরি",
    offers: "অফার",
    orders: "আমার অর্ডার",
    cart: "কার্ট",
    allProducts: "সব পণ্য",
    food: "খাবার",
    beauty: "বিউটি",
    electronics: "ইলেকট্রনিক্স",
    fashion: "ফ্যাশন",
    heroLabel: "আপনার পছন্দের অনলাইন দোকান",
    heroTitle: "পছন্দের পণ্য,",
    heroAccent: "সাশ্রয়ী দামে।",
    heroDescription:
      "দৈনন্দিন প্রয়োজন থেকে পছন্দের সবকিছু—সহজ কেনাকাটা এখন এক ঠিকানায়।",
    shopNow: "কেনাকাটা শুরু করুন",
    easyOrder: "সহজ অর্ডার",
    cashOnDelivery: "ক্যাশ অন ডেলিভারি",
    specialProducts: "বিশেষ পণ্য",
    popularProducts: "জনপ্রিয় পণ্য",
    viewAll: "সব দেখুন",
    addToCart: "কার্টে যোগ করুন",
    addedToCart: "কার্টে যোগ হয়েছে",
    emptyCart: "আপনার কার্ট এখন খালি",
    cartItems: "টি পণ্য আপনার কার্টে আছে",
    noProducts: "কোনো পণ্য পাওয়া যায়নি",
    browseProducts: "অন্য নামে বা ক্যাটাগরিতে খুঁজুন",
    benefitsTitle: "আপনার কেনাকাটা হোক আরও সহজ",
    benefitShopping: "সহজ কেনাকাটা",
    benefitShoppingSub: "সহজে পণ্য বাছাই করুন",
    benefitPayment: "নিরাপদ পেমেন্ট",
    benefitPaymentSub: "সুবিধামতো পেমেন্ট করুন",
    benefitDelivery: "সুবিধাজনক ডেলিভারি",
    benefitDeliverySub: "ঘরে বসেই পণ্য পান",
    footerDescription: "আপনার দৈনন্দিন কেনাকাটার নির্ভরযোগ্য ঠিকানা।",
    currency: "৳",
  },
  en: {
    announcement: "Welcome to Mukt Bazar",
    announcementSub: "Easy shopping for everyone",
    tagline: "Your trusted online shop",
    search: "Search products...",
    searchButton: "Search",
    home: "Home",
    categories: "Categories",
    offers: "Offers",
    orders: "My Orders",
    cart: "Cart",
    allProducts: "All Products",
    food: "Food",
    beauty: "Beauty",
    electronics: "Electronics",
    fashion: "Fashion",
    heroLabel: "Your favourite online store",
    heroTitle: "Products you love,",
    heroAccent: "prices you'll love.",
    heroDescription:
      "From daily essentials to your favourites—easy shopping in one place.",
    shopNow: "Start Shopping",
    easyOrder: "Easy Ordering",
    cashOnDelivery: "Cash on Delivery",
    specialProducts: "Special Picks",
    popularProducts: "Popular Products",
    viewAll: "View All",
    addToCart: "Add to Cart",
    addedToCart: "Added to cart",
    emptyCart: "Your cart is empty",
    cartItems: "items in your cart",
    noProducts: "No products found",
    browseProducts: "Try another keyword or category",
    benefitsTitle: "A better way to shop",
    benefitShopping: "Easy Shopping",
    benefitShoppingSub: "Find products with ease",
    benefitPayment: "Secure Payment",
    benefitPaymentSub: "Choose your preferred payment",
    benefitDelivery: "Convenient Delivery",
    benefitDeliverySub: "Get products at your doorstep",
    footerDescription: "Your reliable destination for everyday shopping.",
    currency: "৳",
  },
} as const;

export type TranslationKey = keyof typeof translations.bn;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext =
  createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>("bn");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      try {
        const saved = window.localStorage.getItem("mukt-bazar-language");

        if (saved === "bn" || saved === "en") {
          setLanguageState(saved);
        }
      } catch {
        // Continue with Bangla if storage is unavailable.
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      try {
        const saved = window.localStorage.getItem("mukt-bazar-theme");
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
        }
      } catch {
        // Continue with light theme if storage is unavailable.
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  }, [theme]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);

    try {
      window.localStorage.setItem(
        "mukt-bazar-language",
        nextLanguage,
      );
    } catch {
      // Language still changes for the current session.
    }
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);

    try {
      window.localStorage.setItem("mukt-bazar-theme", nextTheme);
    } catch {
      // Theme still changes for the current session.
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[language][key],
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, theme, setTheme, t }),
    [language, setLanguage, theme, setTheme, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider",
    );
  }

  return context;
}
