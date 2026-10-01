import { randomInt } from "crypto";
import { ensurePaidAtSchema, sql } from "./db";
import { ensurePromoSchema, normalizeCode } from "./promoCodes";
import { creerBonOffert, formatMontant } from "./bonCadeau";
import { deviseValide } from "./bonCadeauMontants";
import { convertPrice, type Currency } from "./currency";
import { LANGS, type Lang } from "./email-i18n";
import { parrainageTextes } from "./i18n/relances";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";

/**
 * Le parrainage.
 *
 * Decision du proprietaire : l'ami beneficie de −20 % sur sa commande, et
 * quand il PAIE, le parrain recoit automatiquement un bon de 5 €. Le site n'a
 * pas de budget publicitaire ; un client content qui en amene un autre est le
 * canal le moins cher qui existe, a condition qu'on le lui demande.
 *
 * Un code par client, cree la premiere fois qu'on le lui montre (e-mail de
 * livraison, page des cadeaux offerts) puis toujours le meme : un code qui
 * change d'un e-mail a l'autre ne se partage pas.
 *
 * Techniquement, c'est un code promo a 20 % sans limite d'usage qui porte
 * l'adresse de son parrain (`promo_codes.parrain_email`). La recompense est un
 * bon cadeau ordinaire (lib/bonCadeau.ts), cree une fois par commande payee.
 */

const REMISE_AMI_POURCENT = 20;
const RECOMPENSE_EUR = 5;
const VALIDITE_MOIS = 12;

/* Meme alphabet que les bons : sans 0/O ni 1/I/L, le code se dicte et se
   recopie sans erreur. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function bloc(n: number): string {
  return Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
function nouveauCode(): string {
  return `AMI-${bloc(4)}-${bloc(4)}`;
}

function langue(brut: unknown): Lang {
  return (LANGS as readonly string[]).includes(String(brut)) ? (brut as Lang) : "en";
}

/**
 * Le code de parrainage de ce client, cree s'il n'existe pas encore.
 *
 * Idempotent, y compris sous concurrence : l'index UNIQUE sur
 * `lower(parrain_email)` fait echouer le second INSERT, qui relit alors le
 * code du premier.
 *
 * Chaque appel repousse l'expiration a 12 mois : un code qu'on vient de
 * montrer au client ne doit pas expirer la semaine suivante. Un code
 * desactive par l'admin le reste (`active` n'est pas touche).
 */
export async function codeParrainage(email: string, lang: Lang): Promise<string> {
  await ensurePromoSchema();
  const parrain = email.trim().toLowerCase();
  if (!parrain) throw new Error("Parrainage : adresse vide");

  const expire = new Date();
  expire.setMonth(expire.getMonth() + VALIDITE_MOIS);

  for (let essai = 0; essai < 5; essai++) {
    const existant = await sql`
      UPDATE promo_codes
      SET ends_at = GREATEST(COALESCE(ends_at, ${expire.toISOString()}::timestamptz), ${expire.toISOString()}::timestamptz),
          parrain_lang = ${lang}
      WHERE lower(parrain_email) = ${parrain}
      RETURNING code
    `;
    if (existant[0]) return String(existant[0].code);

    const cree = await sql`
      INSERT INTO promo_codes (code, kind, value, currency, min_subtotal, max_uses, ends_at, parrain_email, parrain_lang)
      VALUES (${nouveauCode()}, 'percent', ${REMISE_AMI_POURCENT}, NULL, 0, NULL, ${expire.toISOString()}, ${parrain}, ${lang})
      ON CONFLICT DO NOTHING
      RETURNING code
    `;
    if (cree[0]) return String(cree[0].code);
    // Conflit : un appel concurrent a cree le code (relu au tour suivant), ou le code tire existait.
  }
  throw new Error(`Parrainage : impossible de creer un code pour ${parrain}`);
}

/**
 * La devise dans laquelle ce client paie : celle de sa derniere commande
 * payee, EUR a defaut. Le bon de recompense doit etre dans cette devise, sinon
 * la caisse le refuserait (`currency_mismatch` dans validatePromoCode).
 */
async function deviseDuClient(email: string): Promise<Currency> {
  await ensurePaidAtSchema();
  const rows = await sql`
    SELECT currency FROM orders
    WHERE lower(customer_email) = lower(${email}) AND paid_at IS NOT NULL
    ORDER BY paid_at DESC
    LIMIT 1
  `;
  return deviseValide(rows[0]?.currency) ?? "EUR";
}

/** 5 € dans la devise du parrain, arrondi a l'unite superieure. */
function montantRecompense(devise: Currency): number {
  return devise === "EUR" ? RECOMPENSE_EUR : convertPrice(RECOMPENSE_EUR, devise);
}

/** Le code et la recompense deja formatee, pour l'afficher au parrain. */
export async function infosParrainage(
  email: string,
  lang: Lang
): Promise<{ code: string; recompense: string }> {
  const [code, devise] = await Promise.all([codeParrainage(email, lang), deviseDuClient(email)]);
  return { code, recompense: formatMontant(montantRecompense(devise), devise, lang) };
}

/**
 * Recompense le parrain si cette commande payee a utilise un code AMI-.
 *
 * Appelee par `finaliserCommande`, donc une fois par commande ; la cle
 * `parrainage:<commande>` du bon garantit l'unicite meme si ce n'etait pas le
 * cas. Ne leve jamais : la finalisation d'une commande ne doit pas dependre
 * d'un bonus.
 *
 * Pas de recompense :
 * - quand l'acheteur est le parrain (insensible a la casse) — c'est ici, et
 *   non a la saisie du code, que l'auto-parrainage se refuse, car l'adresse de
 *   l'acheteur n'est connue qu'a la commande. Il garde ses −20 %, pas le bon ;
 * - quand ce meme ami a deja paye une autre commande avec ce code : on
 *   recompense un ami amene, pas chacune de ses commandes.
 */
export async function recompenserParrain(order: {
  id: string;
  customer_email: string;
  promo_code: string | null;
}): Promise<void> {
  try {
    if (!order.promo_code) return;
    await ensurePromoSchema();
    const code = normalizeCode(order.promo_code);
    const rows = await sql`
      SELECT code, parrain_email, parrain_lang FROM promo_codes
      WHERE code = ${code} AND parrain_email IS NOT NULL
    `;
    const promo = rows[0] as { code: string; parrain_email: string; parrain_lang: string | null } | undefined;
    if (!promo) return;

    const parrain = promo.parrain_email.trim().toLowerCase();
    if (parrain === order.customer_email.trim().toLowerCase()) {
      console.log(`[parrainage] auto-parrainage ignoré: ${code} sur ${order.id}`);
      return;
    }

    await ensurePaidAtSchema();
    const dejaAmene = await sql`
      SELECT 1 FROM orders
      WHERE lower(customer_email) = lower(${order.customer_email})
        AND promo_code = ${code}
        AND paid_at IS NOT NULL
        AND id <> ${order.id}::uuid
      LIMIT 1
    `;
    if (dejaAmene.length) return;

    const lang = langue(promo.parrain_lang);
    const devise = await deviseDuClient(parrain);
    const montant = montantRecompense(devise);
    const t = parrainageTextes[lang];

    const bon = await creerBonOffert({
      email: parrain,
      montant,
      devise,
      raison: `Parrainage : ${order.customer_email} a payé la commande ${order.id.slice(0, 8)} avec ${code}`,
      lang,
      cle: `parrainage:${order.id}`,
      textes: (valeur) => ({
        sujet: t.recompenseSujet(valeur),
        titre: t.recompenseTitre,
        intro: t.recompenseIntro(valeur),
      }),
    });
    if (!bon) return;

    await mesureServeur(MESURES.parrainageRecompense, {
      identifiant: parrain,
      proprietes: { order_id: order.id, code_ami: code, bon: bon.code, value: montant, currency: devise },
    }).catch(() => {});
  } catch (erreur) {
    console.error("[parrainage] récompense impossible pour", order.id, erreur);
  }
}
