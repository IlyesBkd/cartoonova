// Root layout is intentionally minimal.
// All rendering is handled by app/[locale]/layout.tsx via next-intl.
// This file exists only as a required Next.js entry point.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
