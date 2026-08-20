"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VARIANTS = [
  { slug: "popart-classic", label: "BD classique" },
  { slug: "popart-warhol", label: "Warhol" },
  { slug: "popart-manga", label: "Manga action" },
  { slug: "popart-vintage", label: "Vintage journal" },
  { slug: "popart-neon", label: "Néon street" },
];

export default function PopartVariantSwitcher() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentSlug = segments[segments.length - 1];
  const index = VARIANTS.findIndex((v) => v.slug === currentSlug);
  const base = pathname.replace(/\/simpson-mockups.*/, "/simpson-mockups");

  const prev = index > 0 ? VARIANTS[index - 1] : null;
  const next = index >= 0 && index < VARIANTS.length - 1 ? VARIANTS[index + 1] : null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(20,20,20,0.92)",
        color: "#fff",
        borderRadius: 999,
        padding: "8px 10px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
      }}
    >
      <Link href={base} style={{ color: "#aaa", textDecoration: "none", padding: "4px 8px" }}>
        ← Vue d&apos;ensemble
      </Link>
      <span style={{ opacity: 0.4 }}>|</span>
      {prev ? (
        <Link href={`${base}/${prev.slug}`} style={{ color: "#fff", textDecoration: "none", padding: "4px 8px" }}>
          ‹
        </Link>
      ) : (
        <span style={{ opacity: 0.3, padding: "4px 8px" }}>‹</span>
      )}
      <span style={{ fontWeight: 600 }}>
        {index >= 0 ? `${index + 1}/${VARIANTS.length} · ${VARIANTS[index].label}` : "Pop-art variants"}
      </span>
      {next ? (
        <Link href={`${base}/${next.slug}`} style={{ color: "#fff", textDecoration: "none", padding: "4px 8px" }}>
          ›
        </Link>
      ) : (
        <span style={{ opacity: 0.3, padding: "4px 8px" }}>›</span>
      )}
    </div>
  );
}
