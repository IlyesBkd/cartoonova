"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import ChatWidget from "@/components/ChatWidget";
import ExitIntentDialog from "@/components/ExitIntentDialog";
import { PRODUCT_COLOR_SCHEMES } from "@/components/ProductColorProvider";

const PRODUCT_SLUGS = Object.keys(PRODUCT_COLOR_SCHEMES);

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = pathname.includes("/admin") || pathname.includes("/simpson-mockups");

  if (isBare) return <>{children}</>;

  const isProductPage = pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => PRODUCT_SLUGS.includes(segment));

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <FooterCartoon />
      <ChatWidget />
      {isProductPage && <ExitIntentDialog />}
    </>
  );
}
