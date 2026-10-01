import type { Metadata } from "next";
import Stripe from "stripe";
import { parseBonToken } from "@/lib/emailToken";
import { bonCadeauTextes, LANGS, type Lang } from "@/lib/email-i18n";
import { formatDate, formatMontant, lireBon } from "@/lib/bonCadeau";
import { sql } from "@/lib/db";
import BoutonImprimer from "./BoutonImprimer";

/* Le bon cadeau, pret a imprimer (format A5) ou a enregistrer en PDF.

   Le prenom, le message et la langue ne sont pas en base : ils voyagent dans
   les metadonnees du paiement Stripe, relues ici. Inutile d'ajouter trois
   colonnes pour une page qu'on ouvre une ou deux fois. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export default async function BonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const code = parseBonToken(decodeURIComponent(token));
  const bon = code ? await lireBon(code) : null;

  if (!bon) {
    return (
      <main className="suivi">
        <div className="suivi__carte suivi__carte--vide">
          <h1>{bonCadeauTextes.fr.invalide}</h1>
          <p>{bonCadeauTextes.en.invalide}</p>
        </div>
      </main>
    );
  }

  // Prenom, message et langue : sur le paiement qui a achete le bon.
  let lang: Lang = "fr";
  let prenom: string | null = null;
  let message: string | null = null;
  const achat = await sql`SELECT achat_payment_intent FROM promo_codes WHERE code = ${bon.code}`;
  const piId = achat[0]?.achat_payment_intent as string | undefined;
  if (piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      if ((LANGS as readonly string[]).includes(pi.metadata?.lang)) lang = pi.metadata.lang as Lang;
      prenom = pi.metadata?.prenom || null;
      message = pi.metadata?.message || null;
    } catch {
      // Sans Stripe, le bon reste affichable : seul l'habillage personnel manque.
    }
  }

  const t = bonCadeauTextes[lang];
  const valeur = formatMontant(bon.montant, bon.devise, lang);

  return (
    <main className="suivi bonus">
      <div className="bon-imprimable">
        <p className="bon-imprimable__marque">Cartoonova</p>
        <h1>{t.carteTitre}</h1>
        {prenom && <p className="bon-imprimable__pour">{t.pour(prenom)}</p>}
        <p className="bon-imprimable__valeur">{valeur}</p>
        {message && <blockquote className="bon-imprimable__message">{message}</blockquote>}
        <div className="bon-code">
          <small>{t.code}</small>
          <b>{bon.code}</b>
        </div>
        <p className="bon-imprimable__mode">{t.modeEmploi}</p>
        <p className="bon-imprimable__validite">{t.validite(formatDate(bon.expireLe, lang))}</p>
        {bon.solde < bon.montant && (
          <p className="bon-imprimable__validite">{t.solde(formatMontant(bon.solde, bon.devise, lang))}</p>
        )}
      </div>
      <BoutonImprimer libelle={t.imprimer} />
    </main>
  );
}
