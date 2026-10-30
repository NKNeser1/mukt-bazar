
import Link from "next/link";

const links = [
  { href: "/", icon: "⌂", bn: "হোম", en: "Home" },
  { href: "/#products", icon: "▦", bn: "পণ্য", en: "Products" },
  { href: "/#categories", icon: "☷", bn: "ক্যাটাগরি", en: "Categories" },
  { href: "/#offers", icon: "％", bn: "অফার", en: "Offers" },
  { href: "/track-order", icon: "📦", bn: "অর্ডার", en: "Orders" },
];

export default function SiteNavigation() {
  return (
    <nav className="mb-site-nav" aria-label="প্রধান নেভিগেশন">
      {links.map((item) => (
        <Link href={item.href} key={item.href} className="mb-site-nav-link">
          <span className="mb-site-nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.bn}</span>
        </Link>
      ))}
    </nav>
  );
}
