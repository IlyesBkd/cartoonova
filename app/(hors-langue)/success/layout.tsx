/* Le fournisseur PostHog est desormais pose par `app/(hors-langue)/layout.tsx`
   pour toutes les pages hors langue (suivi, depot, apercu, bonus, bon) : il
   ne vivait qu'ici, et ces pages n'envoyaient aucune vue de page. Le garder
   aussi ici doublerait chaque mesure de la page de succes. */

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
