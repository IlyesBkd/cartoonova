import { jetonGoogle, lireCompteDeService } from "./googleAuth";

/**
 * Surveillance du compte Google Merchant Center.
 *
 * Un compte marchand tombe en silence : un flux qui cesse d'etre lu, un prix
 * qui s'ecarte de celui de la page, une suspension — rien de tout cela ne
 * previent qui que ce soit. Le canal disparait des resultats et on ne s'en
 * apercoit qu'en allant regarder. D'ou cette lecture quotidienne, branchee sur
 * la meme vigie que le reste.
 *
 * L'acces passe par le compte de service deja utilise pour Search Console. Il
 * a fallu, une fois, enregistrer le projet Cloud aupres du compte marchand
 * (methode `developerRegistration.registerGcp`) : Google refuse cet
 * enregistrement a un compte de service, il a donc ete fait au nom d'un humain.
 *
 * Note de version : l'API Merchant v1beta a ete retiree le 28 fevrier 2026,
 * seule la v1 repond.
 */

const PORTEE = "https://www.googleapis.com/auth/content";
const RACINE = "https://merchantapi.googleapis.com";

/** Au-dela, la part de produits refuses cesse d'etre un accident isole. */
const SEUIL_ALERTE_REFUS = 0.1;

export interface EtatMerchant {
  problemesCompte: { gravite: string; titre: string }[];
  produits: number;
  parLangue: Record<string, number>;
  problemesProduit: { libelle: string; nombre: number }[];
  /** Part des produits portant au moins un probleme bloquant. */
  partRefusee: number;
}

export function compteMerchant(): string | null {
  const id = process.env.MERCHANT_ACCOUNT_ID;
  if (!id || !lireCompteDeService()) return null;
  return id;
}

export async function etatMerchant(): Promise<EtatMerchant> {
  const compte = compteMerchant();
  if (!compte) throw new Error("compte Merchant non configure");

  const jeton = await jetonGoogle(PORTEE);
  const entetes = { authorization: `Bearer ${jeton}` };

  /* Problemes de compte : suspension, informations d'entreprise manquantes,
     site non revendique. Ce sont les plus graves — ils coupent tout le canal,
     pas une fiche. */
  const rProblemes = await fetch(`${RACINE}/accounts/v1/accounts/${compte}/issues`, { headers: entetes });
  if (!rProblemes.ok) {
    const detail = (await rProblemes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`lecture des problemes refusee (${rProblemes.status}) : ${detail.error?.message ?? ""}`);
  }
  const problemesCompte = (((await rProblemes.json()) as {
    accountIssues?: { severity?: string; title?: string }[];
  }).accountIssues ?? []).map((p) => ({
    gravite: p.severity ?? "?",
    titre: p.title ?? "(sans titre)",
  }));

  /* Etat des fiches. La pagination est bornee : le catalogue tient largement
     dans quelques pages, et une boucle sans limite dans un cron est une panne
     qui attend son heure. */
  const parLangue: Record<string, number> = {};
  const compteurs = new Map<string, number>();
  let produits = 0;
  let refuses = 0;
  let page = "";
  let tours = 0;

  do {
    const url =
      `${RACINE}/products/v1/accounts/${compte}/products?pageSize=250` +
      (page ? `&pageToken=${page}` : "");
    const r = await fetch(url, { headers: entetes });
    if (!r.ok) break;

    const c = (await r.json()) as {
      products?: {
        contentLanguage?: string;
        productStatus?: { itemLevelIssues?: { severity?: string; description?: string; code?: string }[] };
      }[];
      nextPageToken?: string;
    };

    for (const p of c.products ?? []) {
      produits++;
      const langue = p.contentLanguage ?? "?";
      parLangue[langue] = (parLangue[langue] ?? 0) + 1;

      let bloquant = false;
      for (const pb of p.productStatus?.itemLevelIssues ?? []) {
        const libelle = `[${pb.severity ?? "?"}] ${pb.description ?? pb.code ?? "?"}`;
        compteurs.set(libelle, (compteurs.get(libelle) ?? 0) + 1);
        if ((pb.severity ?? "").toUpperCase().includes("DISAPPROV")) bloquant = true;
      }
      if (bloquant) refuses++;
    }

    page = c.nextPageToken ?? "";
  } while (page && ++tours < 20);

  return {
    problemesCompte,
    produits,
    parLangue,
    problemesProduit: [...compteurs]
      .map(([libelle, nombre]) => ({ libelle, nombre }))
      .sort((a, b) => b.nombre - a.nombre)
      .slice(0, 5),
    partRefusee: produits > 0 ? refuses / produits : 0,
  };
}

/** Anomalies a faire remonter, formulees pour un message d'alerte. */
export function anomaliesMerchant(etat: EtatMerchant): string[] {
  const anomalies: string[] = [];

  for (const p of etat.problemesCompte) {
    anomalies.push(`Merchant Center — ${p.gravite} : ${p.titre}`);
  }

  if (etat.produits === 0) {
    anomalies.push("Merchant Center : aucun produit dans le compte");
  } else if (etat.partRefusee > SEUIL_ALERTE_REFUS) {
    anomalies.push(
      `Merchant Center : ${Math.round(etat.partRefusee * 100)} % des fiches refusees` +
        (etat.problemesProduit[0] ? ` — ${etat.problemesProduit[0].libelle}` : "")
    );
  }

  return anomalies;
}
