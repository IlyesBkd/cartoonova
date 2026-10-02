import PostHogProvider from "@/components/PostHogProvider";

/* La page de succes mesure le paiement abouti : elle seule, hors de [locale],
   a besoin du fournisseur PostHog. La coque HTML est celle de
   `app/(hors-langue)/layout.tsx` — ce layout en rendait une seconde
   (<html>/<body> dans le <body>), ce qui cassait l'hydratation de la page. */

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return <PostHogProvider>{children}</PostHogProvider>;
}
