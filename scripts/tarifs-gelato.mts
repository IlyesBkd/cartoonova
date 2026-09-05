/**
 * Ce que coutent VRAIMENT, chez Gelato, les trois supports vendus sur le site.
 *
 *   GELATO_API_KEY=xxx npx tsx scripts/tarifs-gelato.mts
 *   GELATO_API_KEY=xxx npx tsx scripts/tarifs-gelato.mts --pays FR,DE,US
 *   GELATO_API_KEY=xxx npx tsx scripts/tarifs-gelato.mts --explore
 *
 * ── Pourquoi un script et pas un tableau fige ────────────────────────────
 *
 * Les tarifs Gelato ne sont publies nulle part, et ils bougent. Ils dependent
 * du pays de PRODUCTION — l'imprimeur est choisi au plus pres du client, donc
 * une toile n'a pas le meme prix a Lyon et a Chicago —, de la destination, et
 * du palier d'abonnement du compte. Un chiffre recopie dans un fichier serait
 * faux au premier changement, sans que rien ne le signale.
 *
 * ── Ce qu'il faut avoir compris avant de lire la sortie ──────────────────
 *
 * Le catalogue rend DEUX prix, et confondre les deux fait croire a une marge
 * qui n'existe pas :
 *
 *   - `/products/{uid}/prices` ne rend que la PRODUCTION.
 *   - le port ne se chiffre qu'a la commande, par un devis, parce qu'il depend
 *     du poids, de la destination et du transporteur retenu ce jour-la.
 *
 * L'ecart n'est pas cosmetique. Une toile 30x40 livree en France coutait
 * 23,49 EUR de production le jour ou ce script a ete ecrit — et 17,69 EUR de
 * port, soit trois quarts de la production en plus. Une marge calculee sans
 * lui aurait annonce 15 EUR la ou il en restait 3.
 *
 * Le script demande donc un devis complet par pays. C'est plus lent qu'une
 * grille de prix, et c'est le seul chiffre qui vaille.
 */

import { DEFAULT_PRICES_BY_CURRENCY } from "../lib/types";
import { TAILLE_IMPRESSION } from "../lib/supportCommande";

const CLE = process.env.GELATO_API_KEY || "";

/* Gelato repartit ses endpoints sur des sous-domaines distincts. */
const PRODUITS = "https://product.gelatoapis.com/v3";
const COMMANDES = "https://order.gelatoapis.com/v4";

/**
 * Les references qui correspondent a ce que le site vend, toutes en 30x40
 * VERTICAL — un portrait ne se commande pas en paysage.
 *
 * Elles ont ete relevees dans le catalogue, pas devinees : `--explore` les
 * retrouve, et c'est par la qu'il faut repasser si l'offre change. La toile
 * retenue est la fine (2 cm, « slim ») ; le cadre est le chene (`natural-wood`)
 * sur papier mat 200 g, ce que la fiche produit annonce au client.
 */
const REFERENCES = {
  canvas:
    "canvas_s_product_cf_300x400-mm_cm_canvas_cthck_wood-fsc-slim_cl_4-0_ver",
  posterSimple:
    "flat_product_pf_300x400-mm_pt_200-gsm-uncoated_cl_4-0_ct_none_prt_none_sft_none_set_none_ver",
  framed:
    "frame_and_poster_product_frs_300x400-mm_frc_natural-wood_frm_wood_frp_w12xt22-mm_gt_plexiglass__pf_300x400-mm_pt_200-gsm-uncoated_cl_4-0_ct_none_prt_none_ver",
} as const;

type Support = keyof typeof REFERENCES;

/* Correspondance entre un support du site et son champ de prix. Meme table que
   `PRINT_PRICE_FIELD` dans lib/pricing.ts — elle y est privee, et la dupliquer
   ici vaut mieux que d'elargir la surface publique d'un module que la caisse
   utilise. */
const CHAMP_PRIX = { canvas: "canvas", framed: "poster", posterSimple: "posterSimple" } as const;

const NOM: Record<Support, string> = {
  canvas: "Toile",
  posterSimple: "Poster papier mat",
  framed: "Poster encadré chêne",
};

/* Une adresse reelle par pays. Le devis refuse un code postal incoherent, et
   le transporteur retenu depend de la ville : un chiffre obtenu sur une
   adresse inventee ne vaudrait pas mieux qu'une estimation. */
const ADRESSES: Record<string, [string, string, string]> = {
  FR: ["10 rue de Rivoli", "Paris", "75001"],
  BE: ["Rue Neuve 1", "Bruxelles", "1000"],
  DE: ["Hauptstr 1", "Berlin", "10115"],
  ES: ["Gran Via 1", "Madrid", "28013"],
  IT: ["Via Roma 1", "Milano", "20121"],
  NL: ["Damrak 1", "Amsterdam", "1012"],
  PL: ["Marszalkowska 1", "Warszawa", "00-001"],
  SE: ["Drottninggatan 1", "Stockholm", "11151"],
  DK: ["Vestergade 1", "Kobenhavn", "1456"],
  PT: ["Rua Augusta 1", "Lisboa", "1100-053"],
  GB: ["1 Oxford St", "London", "W1D 1BS"],
  US: ["1 Main St", "New York", "10001"],
  CA: ["1 Yonge St", "Toronto", "M5E 1E5"],
  AU: ["1 George St", "Sydney", "2000"],
  CH: ["Bahnhofstr 1", "Zurich", "8001"],
};

interface Devis {
  production: number;
  port: number;
  transporteur: string;
  jours: number | null;
  paysProduction: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { "X-API-KEY": CLE, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${url} → ${r.status}`);
  return (await r.json()) as T;
}

/**
 * Production ET port pour un produit livre dans un pays.
 *
 * Renvoie null quand le pays n'est pas desservi — ce qui est une reponse en
 * soi : inutile de proposer une toile la ou personne ne peut l'imprimer.
 */
async function devis(productUid: string, pays: string): Promise<Devis | null> {
  const adresse = ADRESSES[pays];
  if (!adresse) return null;
  const [rue, ville, cp] = adresse;

  try {
    const r = await api<{
      quotes: {
        products: { price: number }[];
        shipmentMethods: { name: string; price: number; maxDeliveryDays: number | null }[];
        productionCountry: string | null;
      }[];
    }>(`${COMMANDES}/orders:quote`, {
      method: "POST",
      body: JSON.stringify({
        orderReferenceId: `sonde-${pays}-${Date.now()}`,
        customerReferenceId: "cartoonova",
        currency: "EUR",
        recipient: {
          country: pays,
          firstName: "Cartoonova",
          lastName: "Sonde",
          addressLine1: rue,
          city: ville,
          postCode: cp,
          email: "support@cartoonova.com",
        },
        /* Un fichier quelconque suffit : le devis ne l'imprime pas, il lui
           faut seulement une URL valide pour accepter la ligne. */
        products: [
          {
            itemReferenceId: "i1",
            productUid,
            fileUrl: "https://www.cartoonova.com/logo.png",
            quantity: 1,
          },
        ],
      }),
    });

    const q = r.quotes?.[0];
    const envois = q?.shipmentMethods ?? [];
    if (!q || !envois.length) return null;

    /* Le moins cher, pas le plus rapide : c'est celui qui fixe la marge
       plancher, et c'est celui qu'on choisira en pratique. */
    const moins = envois.reduce((a, b) => (b.price < a.price ? b : a));
    return {
      production: q.products[0].price,
      port: moins.price,
      transporteur: moins.name,
      jours: moins.maxDeliveryDays,
      paysProduction: q.productionCountry,
    };
  } catch {
    return null;
  }
}

/** Retrouve les references 30x40 du catalogue, quand l'offre change. */
async function explorer(): Promise<void> {
  const { data: catalogues } = await api<{ data: { catalogUid: string; title: string }[] }>(
    `${PRODUITS}/catalogs`
  );
  const murs = catalogues.filter((c) => ["canvas", "posters", "framed-posters"].includes(c.catalogUid));

  /* Le nom de l'attribut de taille change d'un catalogue a l'autre — et un
     filtre qui se trompe de nom ne rend pas une erreur, il rend zero produit,
     ce qui se lit comme « ca n'existe pas ». D'ou une cle par catalogue. */
  const FILTRE: Record<string, Record<string, string[]>> = {
    canvas: { CanvasFormat: ["300x400-mm"], Orientation: ["ver"] },
    posters: { PaperFormat: ["300x400-mm"], Orientation: ["ver"] },
    "framed-posters": { FrameSize: ["300x400-mm"], Orientation: ["ver"] },
  };

  for (const c of murs) {
    const r = await api<{ products: { productUid: string; attributes: Record<string, string> }[] }>(
      `${PRODUITS}/catalogs/${c.catalogUid}/products:search`,
      { method: "POST", body: JSON.stringify({ attributeFilters: FILTRE[c.catalogUid], limit: 100 }) }
    );
    console.log(`\n── ${c.title} — ${TAILLE_IMPRESSION} vertical : ${r.products.length} références`);
    for (const p of r.products) {
      const a = p.attributes;
      const resume = [a.CanvasThicknessType, a.CanvasFrame, a.FrameColor, a.FrameMaterial, a.PaperType]
        .filter(Boolean)
        .join(" · ");
      console.log(`   ${resume}\n     ${p.productUid}`);
    }
  }
}

async function tarifer(pays: string[]): Promise<void> {
  const grille = DEFAULT_PRICES_BY_CURRENCY.EUR;

  for (const support of Object.keys(REFERENCES) as Support[]) {
    const supplement = grille[CHAMP_PRIX[support]];
    /* Ce que le client paie reellement pour un portrait simple : le prix de
       base plus le supplement du support. Comparer le seul supplement au cout
       complet ferait passer chaque commande pour deficitaire. */
    const encaisse = grille.base + supplement;

    console.log(`\n═══ ${NOM[support]} ${TAILLE_IMPRESSION} ═══`);
    console.log(`    ${REFERENCES[support]}`);
    console.log(`    Encaissé : ${grille.base} € de base + ${supplement} € de support = ${encaisse} €\n`);
    console.log(`    Pays   Production     Port    Revient     Marge   Production / délai`);

    for (const p of pays) {
      const d = await devis(REFERENCES[support], p);
      if (!d) {
        console.log(`    ${p.padEnd(6)}          —        —          —         —   (non desservi)`);
        continue;
      }
      const revient = d.production + d.port;
      const marge = encaisse - revient;
      const alerte = marge < 5 ? "  ⚠" : "";
      console.log(
        `    ${p.padEnd(6)} ${d.production.toFixed(2).padStart(9)} ${d.port.toFixed(2).padStart(8)} ` +
          `${revient.toFixed(2).padStart(10)} ${marge.toFixed(2).padStart(9)}   ` +
          `${d.paysProduction ?? "?"}, ${d.jours ?? "?"} j${alerte}`
      );
    }
  }

  console.log(`
⚠ Ces prix dépendent du palier d'abonnement de la clé utilisée. Un compte
  gratuit et un compte Gelato+ ne voient pas les mêmes chiffres.

  La marge affichée ignore Stripe (~1,5 % + 0,25 €), la TVA, et l'acquisition.
  Elle dit ce qu'il reste après impression et livraison, rien de plus.
`);
}

async function main(): Promise<void> {
  if (!CLE) {
    console.error(`
GELATO_API_KEY manquante.

  gelato.com → Developer → API Key → Add API key
  puis :  GELATO_API_KEY=xxx npx tsx scripts/tarifs-gelato.mts
`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.includes("--explore")) return explorer();

  const i = args.indexOf("--pays");
  const pays = i >= 0 && args[i + 1] ? args[i + 1].split(",") : Object.keys(ADRESSES);
  await tarifer(pays);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
