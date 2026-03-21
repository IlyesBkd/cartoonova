import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cartoonova - Transformez vos photos en caricatures cartoon",
  description: "Créez votre caricature personnalisée style Simpson. Artistes professionnels, satisfaction garantie.",
  icons: {
    icon: "/flaticon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${poppins.variable} antialiased`}>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
