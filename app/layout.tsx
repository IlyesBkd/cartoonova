import Script from "next/script";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const AW_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${poppins.variable} antialiased`}>
      <body>
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
      </body>
    </html>
  );
}
