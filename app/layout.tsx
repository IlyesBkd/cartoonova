// Root layout is intentionally minimal.
// All rendering is handled by app/[locale]/layout.tsx via next-intl.
// This file exists only as a required Next.js entry point.

import Script from "next/script";

const AW_ID = "AW-18013095662";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Google Ads — gtag.js */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${AW_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${AW_ID}');
        `}
      </Script>
      {children}
    </>
  );
}
