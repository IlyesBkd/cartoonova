import { randomInt } from "crypto";
import type Stripe from "stripe";
import { sql } from "./db";
import { type Currency } from "./currency";
import { deviseValide } from "./bonCadeauMontants";
export { deviseValide, montantsBon } from "./bonCadeauMontants";
import { bonCadeauTextes, LANGS, type Lang } from "./email-i18n";
import { bonToken } from "./emailToken";
import { SITE_URL } from "./site";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";
import { alerteDiscord, COULEUR_SOLEIL } from "./discord";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";
import { toEUR } from "./currency";
import { envoyerEmail } from "@/lib/envoiEmail";
import { signalerPanne } from "@/lib/alerteServeur";

/**
 * Le bon cadeau.
 *
 * Pour qui veut offrir un portrait sans avoir la photo, ou sans gacher la
 * surprise : un montant, un code, une version imprimable. Le destinataire
 * choisit son univers et envoie ses photos lui-meme.
 *
 * Techniquement, un bon est un code promo de type « amount » qui porte un
 * SOLDE (`promo_codes.solde`) : il s'utilise en plusieurs fois. Il est debite
 * apres paiement de la commande qui l'utilise (`lib/finaliserCommande.ts`).
 *
 * Il se vend jusqu'au 24 decembre au soir : rien a produire, rien a livrer.
 */

/** Duree de validite : 12 mois, l'usage pour une carte cadeau. */
const VALIDITE_MOIS = 12;

/* Alphabet sans caracteres ambigus (0/O, 1/I/L) : le code se recopie a la
   main depuis une carte imprimee. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function bloc(n: number): string {
  return Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
function nouveauCode(): string {
  return `CADEAU-${bloc(4)}-${bloc(4)}`;
}

export interface BonCadeau {
  code: string;
  montant: number;
  devise: Currency;
  solde: number;
  expireLe: string;
  prenom: string | null;
  message: string | null;
  lang: Lang;
}

/** Lit un bon par son code (pour la version imprimable). */
export async function lireBon(code: string): Promise<BonCadeau | null> {
  const rows = await sql`
    SELECT code, value, currency, solde, ends_at, achat_payment_intent
    FROM promo_codes WHERE code = ${code} AND solde IS NOT NULL
  `;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    code: String(r.code),
    montant: Number(r.value),
    devise: (r.currency as Currency) ?? "EUR",
    solde: Number(r.solde),
    expireLe: r.ends_at ? new Date(r.ends_at as string).toISOString() : "",
    prenom: null,
    message: null,
    lang: "fr",
  };
}

function langue(brut: unknown): Lang {
  return (LANGS as readonly string[]).includes(String(brut)) ? (brut as Lang) : "en";
}

/**
 * Cree le bon paye par ce PaymentIntent, une seule fois.
 *
 * Appelee par le webhook Stripe ET par la page de succes : la contrainte
 * UNIQUE sur `achat_payment_intent` tranche la course — le second appel
 * retrouve le bon cree par le premier, sans renvoyer d'e-mail.
 */
export async function finaliserBonCadeau(pi: Stripe.PaymentIntent): Promise<BonCadeau> {
  const meta = pi.metadata ?? {};
  const devise = deviseValide(pi.currency) ?? "EUR";
  const montant = pi.amount / 100;
  const lang = langue(meta.lang);
  const prenom = meta.prenom?.trim() || null;
  const message = meta.message?.trim() || null;
  const email = meta.email?.trim() || pi.receipt_email || "";

  const expire = new Date();
  expire.setMonth(expire.getMonth() + VALIDITE_MOIS);

  // Un code tire au hasard peut, tres rarement, exister deja : on retente.
  let cree: { code: string } | null = null;
  for (let essai = 0; essai < 5 && !cree; essai++) {
    const rows = await sql`
      INSERT INTO promo_codes (code, kind, value, currency, min_subtotal, max_uses, ends_at, solde, achat_payment_intent, acheteur_email)
      VALUES (${nouveauCode()}, 'amount', ${montant}, ${devise}, 0, NULL, ${expire.toISOString()}, ${montant}, ${pi.id}, ${email || null})
      ON CONFLICT DO NOTHING
      RETURNING code
    `;
    if (rows[0]) {
      cree = { code: String(rows[0].code) };
      break;
    }
    // Rien d'insere : soit le bon de ce paiement existe deja, soit le code tire existait.
    const existant = await sql`SELECT code FROM promo_codes WHERE achat_payment_intent = ${pi.id}`;
    if (existant[0]) {
      return { code: String(existant[0].code), montant, devise, solde: montant, expireLe: expire.toISOString(), prenom, message, lang };
    }
  }
  if (!cree) throw new Error(`Bon cadeau : impossible de creer un code pour ${pi.id}`);

  const bon: BonCadeau = { code: cree.code, montant, devise, solde: montant, expireLe: expire.toISOString(), prenom, message, lang };

  await Promise.all([
    email ? envoyerBon(email, bon) : Promise.resolve(),
    alerteDiscord({
      titre: "🎁 BON CADEAU VENDU",
      couleur: COULEUR_SOLEIL,
      champs: [
        { name: "Code", value: bon.code, inline: true },
        { name: "Montant", value: `${montant} ${devise}`, inline: true },
        { name: "Acheteur", value: email || "?", inline: true },
        ...(prenom ? [{ name: "Pour", value: prenom, inline: true }] : []),
      ],
      piedDePage: "Cartoonova • bon cadeau",
    }).catch((e) => console.error("[bonCadeau] alerte Discord impossible:", e)),
    mesureServeur(MESURES.bonCadeauAchete, {
      identifiant: email || pi.id,
      proprietes: { value: montant, currency: devise, revenue_eur: toEUR(montant, devise), transaction_id: pi.id },
    }).catch(() => {}),
  ]);

  return bon;
}

/**
 * Cree un bon OFFERT — rien n'a ete paye — une seule fois par `cle`.
 *
 * Meme table et meme mecanique de solde qu'un bon achete, pour qu'il
 * s'utilise exactement pareil a la caisse. La cle d'unicite prend la place du
 * PaymentIntent dans `achat_payment_intent` (« parrainage:<commande> ») : la
 * contrainte UNIQUE qui empeche un paiement de creer deux bons empeche ici
 * qu'une meme commande parrainee recompense deux fois, quel que soit
 * l'appelant qui passe en premier.
 *
 * Renvoie null si le bon de cette cle existait deja : rien n'est renvoye au
 * client ni signale une seconde fois.
 */
export async function creerBonOffert(input: {
  email: string;
  montant: number;
  devise: Currency;
  /** Pourquoi ce bon existe, en clair, pour l'alerte Discord. */
  raison: string;
  lang: Lang;
  /** Cle d'unicite, ex. `parrainage:<id de commande>`. */
  cle: string;
  /** Textes de l'e-mail, a partir du montant formate. Defaut : ceux de l'achat. */
  textes?: (valeur: string) => TextesBonOffert;
}): Promise<BonCadeau | null> {
  const email = input.email.trim().toLowerCase();
  const montant = Math.round(input.montant * 100) / 100;
  if (!email || !(montant > 0)) throw new Error("Bon offert : adresse ou montant invalide");

  const expire = new Date();
  expire.setMonth(expire.getMonth() + VALIDITE_MOIS);

  let code: string | null = null;
  for (let essai = 0; essai < 5 && !code; essai++) {
    const rows = await sql`
      INSERT INTO promo_codes (code, kind, value, currency, min_subtotal, max_uses, ends_at, solde, achat_payment_intent, acheteur_email)
      VALUES (${nouveauCode()}, 'amount', ${montant}, ${input.devise}, 0, NULL, ${expire.toISOString()}, ${montant}, ${input.cle}, ${email})
      ON CONFLICT DO NOTHING
      RETURNING code
    `;
    if (rows[0]) {
      code = String(rows[0].code);
      break;
    }
    // Rien d'insere : soit ce bon existe deja (on s'arrete), soit le code tire existait (on retente).
    const existant = await sql`SELECT code FROM promo_codes WHERE achat_payment_intent = ${input.cle}`;
    if (existant[0]) return null;
  }
  if (!code) throw new Error(`Bon offert : impossible de creer un code pour ${input.cle}`);

  const bon: BonCadeau = {
    code,
    montant,
    devise: input.devise,
    solde: montant,
    expireLe: expire.toISOString(),
    prenom: null,
    message: null,
    lang: input.lang,
  };
  const valeur = formatMontant(montant, input.devise, input.lang);

  await Promise.all([
    envoyerBon(email, bon, input.textes?.(valeur)),
    alerteDiscord({
      titre: "🎁 BON OFFERT",
      couleur: COULEUR_SOLEIL,
      champs: [
        { name: "Code", value: bon.code, inline: true },
        { name: "Montant", value: `${montant} ${input.devise}`, inline: true },
        { name: "Pour", value: email, inline: true },
        { name: "Raison", value: input.raison, inline: false },
      ],
      piedDePage: "Cartoonova • bon offert",
    }).catch((e) => console.error("[bonCadeau] alerte Discord impossible:", e)),
  ]);

  return bon;
}

export function lienImpression(code: string): string {
  return `${SITE_URL}/bon/${bonToken(code)}`;
}

export function formatMontant(montant: number, devise: Currency, lang: Lang): string {
  return new Intl.NumberFormat(lang, { style: "currency", currency: devise, maximumFractionDigits: 0 }).format(montant);
}

export function formatDate(iso: string, lang: Lang): string {
  return iso ? new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "";
}

/** Textes qui remplacent ceux de l'achat quand le bon est offert (parrainage...). */
interface TextesBonOffert {
  sujet: string;
  titre: string;
  intro: string;
}

async function envoyerBon(email: string, bon: BonCadeau, offert?: TextesBonOffert): Promise<void> {
  const t = bonCadeauTextes[bon.lang];
  const valeur = formatMontant(bon.montant, bon.devise, bon.lang);
  try {
    await envoyerEmail({
      from: EXPEDITEUR,
      to: [email],
      replyTo: SUPPORT_EMAIL,
      subject: offert?.sujet ?? t.emailSujet,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0;">
            <h1 style="font-size: 28px; font-weight: 900; text-align: center; margin: 0 0 16px; color: #000;">${offert?.titre ?? t.emailTitre}</h1>
            <p style="font-size: 16px; text-align: center; color: #333;">${offert?.intro ?? t.emailIntro(valeur)}</p>
            <div style="margin: 24px auto; padding: 18px; border: 3px dashed #000; border-radius: 12px; text-align: center; background: #fef3c7;">
              <p style="margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #555;">${t.code}</p>
              <p style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: .06em; color: #000;">${bon.code}</p>
            </div>
            <p style="font-size: 15px; text-align: center; color: #333;">${t.modeEmploi}</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${lienImpression(bon.code)}" target="_blank" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; padding: 14px 30px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px;">${t.imprimer}</a>
            </div>
            <p style="font-size: 13px; text-align: center; color: #777;">${t.validite(formatDate(bon.expireLe, bon.lang))}</p>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;"><p>${t.equipe}</p></div>
        </div>
      `,
    });
  } catch (erreur) {
    // Le bon existe et s'affiche sur la page de succes : un e-mail perdu ne le perd pas.
    await signalerPanne("e-mail du bon cadeau", erreur);
  }
}
