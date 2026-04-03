"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import ChatWidget from "@/components/ChatWidget";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.includes("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Navbar />
      {children}
      <FooterCartoon />
      <ChatWidget />
    </>
  );
}
