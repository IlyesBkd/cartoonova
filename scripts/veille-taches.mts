/**
 * Qui n'a pas rapporte cette nuit ?
 *
 *   npx tsx scripts/veille-taches.mts
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 *
 * Toutes les autres sondes repondent a « comment va le site ». Celle-ci
 * repond a « est-ce que les sondes vont bien », question que personne ne
 * posait et dont la reponse etait non.
 *
 * Septembre 2026 : credits OpenAI epuises et quota SerpAPI atteint. Le
 * redacteur de fiches s'arrete a 139 pages sur 350, le moteur de blog cesse de
 * generer et vide son stock de brouillons. Les deux continuent de se terminer
 * sans erreur, et GitHub affiche une coche verte cinq fois par jour pendant une
 * semaine. Il n'y a eu ni panne visible, ni alerte, ni trace.
 *
 * ── Les deux pannes qu'elle attrape ──────────────────────────────────────
 *
 * MUETTE — aucun passage reussi depuis plus longtemps que la tolerance. Le
 * workflow ne s'est pas declenche, ou il echoue avant d'ecrire quoi que ce
 * soit. C'est la panne facile ; elle etait quand meme invisible.
 *
 * STERILE — la tache tourne, se termine bien, et ne produit rien, plusieurs
 * fois d'affilee. C'est la panne couteuse : tous les voyants sont au vert et
 * le travail ne se fait pas. C'est exactement ce qui s'est passe.
 *
 * ── Ce qu'elle n'attrape pas ─────────────────────────────────────────────
 *
 * Une tache qui produit du contenu faux ou mediocre. La quantite se mesure,
 * pas la qualite. C'est le rapport Discord de fin de passage qui tient lieu de
 * relecture, et ca reste un oeil humain une fois par semaine.
 *
 * ── Code de sortie ───────────────────────────────────────────────────────
 *
 * Toujours 0 quand la veille elle-meme a pu s'executer, meme si elle trouve
 * des problemes. Un workflow rouge tous les jours jusqu'a reparation devient
 * un voyant qu'on apprend a ignorer, et c'est precisement le defaut qu'on
 * corrige ici. L'alerte Discord est le signal ; l'echec de sortie est reserve
 * au cas ou la veille n'a pas pu lire la base.
 */

import {
  avecJournal,
  passagesRecents,
  type DernierPassage,
} from "../lib/journalTaches";
import { TACHES_ATTENDUES, type TacheAttendue } from "../lib/tachesAttendues";
import {
  alerteDiscord,
  COULEUR_ALERTE,
  COULEUR_ATTENTION,
  COULEUR_SOLEIL,
  type ChampDiscord,
} from "../lib/discord";

type Etat = "ok" | "muette" | "sterile" | "jamais-vue";

interface Diagnostic {
  tache: TacheAttendue;
  etat: Etat;
  /** Phrase courte, destinee a l'alerte. */
  motif: string;
}

const HEURE_MS = 3_600_000;

function heuresDepuis(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / HEURE_MS;
}

function diagnostiquer(tache: TacheAttendue, passages: DernierPassage[]): Diagnostic {
  if (passages.length === 0) {
    return {
      tache,
      etat: "jamais-vue",
      motif:
        "aucun passage enregistre — la tache n'est pas encore branchee sur le journal",
    };
  }

  const reussis = passages.filter((p) => p.ok);
  const dernierReussi = reussis[0];

  if (!dernierReussi) {
    const dernier = passages[0]!;
    return {
      tache,
      etat: "muette",
      motif: `${passages.length} passage(s) consecutif(s) en echec — dernier : ${
        dernier.erreur?.slice(0, 160) ?? "sans message"
      }`,
    };
  }

  const age = heuresDepuis(dernierReussi.demarre_le);
  if (age > tache.toleranceHeures) {
    return {
      tache,
      etat: "muette",
      motif: `dernier passage reussi il y a ${Math.round(age)} h (tolerance ${
        tache.toleranceHeures
      } h)`,
    };
  }

  // Sterilite : la tache tourne mais ne produit plus rien. On ne compte que les
  // passages reussis — un echec est deja signale par ailleurs, et le melanger
  // ici masquerait la difference entre « casse » et « ne sert a rien ».
  const seuil = tache.steriliteApres;
  if (seuil) {
    const mesures = reussis.filter((p) => p.produit !== null).slice(0, seuil);
    if (mesures.length >= seuil && mesures.every((p) => p.produit === 0)) {
      return {
        tache,
        etat: "sterile",
        motif: `${seuil} passages reussis d'affilee sans rien produire`,
      };
    }
  }

  return { tache, etat: "ok", motif: "" };
}

function champ(d: Diagnostic): ChampDiscord {
  const pastille = d.etat === "sterile" ? "🟠" : "🔴";
  return {
    name: `${pastille} ${d.tache.libelle}`,
    value: `\`${d.tache.nom}\` — ${d.motif}`,
  };
}

async function veiller() {
  const diagnostics: Diagnostic[] = [];
  for (const tache of TACHES_ATTENDUES) {
    // Huit passages suffisent : la plus frequente tourne cinq fois par jour, et
    // le plus grand seuil de sterilite est six.
    const passages = await passagesRecents(tache.nom, 8);
    diagnostics.push(diagnostiquer(tache, passages));
  }

  const muettes = diagnostics.filter((d) => d.etat === "muette");
  const steriles = diagnostics.filter((d) => d.etat === "sterile");
  // « Jamais vue » n'est pas une panne tant que le branchement est en cours :
  // on la signale sans la traiter comme une alerte, sinon la premiere semaine
  // de deploiement crie pour rien.
  const jamaisVues = diagnostics.filter((d) => d.etat === "jamais-vue");
  const problemes = [...muettes, ...steriles];

  for (const d of diagnostics) {
    const marque =
      d.etat === "ok" ? "✓" : d.etat === "jamais-vue" ? "·" : "!";
    console.log(
      `[veille] ${marque} ${d.tache.nom}${d.motif ? ` — ${d.motif}` : ""}`,
    );
  }

  if (problemes.length > 0) {
    await alerteDiscord({
      titre: `Veille des taches — ${problemes.length} tache(s) en defaut`,
      couleur: muettes.length > 0 ? COULEUR_ALERTE : COULEUR_ATTENTION,
      champs: problemes.map(champ),
      piedDePage:
        "Une tache sterile se termine sans erreur et ne fait rien : verifier d'abord les quotas d'API.",
    });
  } else if (new Date().getUTCDay() === 1) {
    // Battement hebdomadaire. Sans lui, le silence de la veille serait ambigu :
    // « tout va bien » et « la veille elle-meme est morte » se ressemblent.
    await alerteDiscord({
      titre: "Veille des taches — tout tourne",
      couleur: COULEUR_SOLEIL,
      champs: [
        {
          name: "Surveillees",
          value: `${TACHES_ATTENDUES.length - jamaisVues.length} / ${TACHES_ATTENDUES.length} taches rapportent`,
        },
      ],
    });
  }

  if (jamaisVues.length > 0) {
    console.log(
      `[veille] ${jamaisVues.length} tache(s) pas encore branchee(s) : ${jamaisVues
        .map((d) => d.tache.nom)
        .join(", ")}`,
    );
  }

  console.log(
    `[veille] ${diagnostics.length - problemes.length - jamaisVues.length} ok · ${muettes.length} muette(s) · ${steriles.length} sterile(s) · ${jamaisVues.length} jamais vue(s)`,
  );

  return { produit: diagnostics.length, muettes: muettes.length, steriles: steriles.length };
}

await avecJournal("veille-taches", veiller).catch((e) => {
  console.error("[veille] echec:", e);
  process.exit(1);
});
