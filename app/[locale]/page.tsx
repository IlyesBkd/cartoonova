import PageAccueil from "@/components/pages/PageAccueil";

/* Le corps de l'accueil vit dans `components/pages/PageAccueil.tsx` : la page
   pilier `/portrait-personnalise-cartoon` sert exactement le meme, a son
   propre chemin. Extrait plutot que recopie — deux copies d'une page finissent
   toujours par diverger. */

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <PageAccueil locale={locale} />;
}
