"use client";

import { useCallback, useEffect, useRef } from "react";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

interface ProductConfig {
  productId: string;
  productName: string;
  category?: string;
  /** Univers du catalogue — Simpson, DBZ, Pixar… Permet de comparer les
      styles entre eux, ce que `product_id` seul ne permet pas de lire. */
  univers?: string;
}

interface SelectedOptions {
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background?: string;
  printOption: string;
}

/**
 * Mesure de la fiche produit.
 *
 * Le prix et la devise accompagnent desormais chaque evenement du parcours.
 * Sans eux, l'entonnoir ne comptait que des tetes : impossible de savoir si
 * les visiteurs qui abandonnent sont ceux qui ont configure un poster encadre
 * a 89 EUR ou un fichier numerique a 29 EUR — alors que c'est exactement la
 * question que pose le configurateur.
 */
export function useProductTracking(config: ProductConfig) {
  const viewTracked = useRef(false);

  const base = useCallback(
    () => ({
      product_id: config.productId,
      product_name: config.productName,
      category: config.category || "portrait_personnalise",
      univers: config.univers ?? null,
    }),
    [config.productId, config.productName, config.category, config.univers]
  );

  // Une seule vue par montage, quoi qu'il arrive au rendu.
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;

    mesure(MESURES.produitVu, {
      product_id: config.productId,
      product_name: config.productName,
      category: config.category || "portrait_personnalise",
      univers: config.univers ?? null,
    });
  }, [config.productId, config.productName, config.category, config.univers]);

  const trackOptionSelected = useCallback(
    (
      optionType: "format" | "background" | "addon" | "print" | "people" | "animals",
      optionValue: string | number,
      priceImpact: number = 0
    ) => {
      mesure(MESURES.optionChoisie, {
        ...base(),
        option_type: optionType,
        option_value: optionValue,
        price_impact: priceImpact,
      });
    },
    [base]
  );

  /** Navigation dans la galerie : combien de visuels sont reellement regardes. */
  const trackGalleryBrowsed = useCallback(
    (index: number, source: "vignette" | "fleche" | "balayage") => {
      mesure(MESURES.galerieParcourue, { ...base(), index, source });
    },
    [base]
  );

  /* ═══ depot de photos ══════════════════════════════════════════════════
     Trois evenements la ou il n'y en avait qu'un. Le succes seul ne dit rien :
     il faut le denominateur (combien de depots commences) et les echecs pour
     savoir si l'etape coute des commandes. Une commande sans photo est
     impossible a honorer — c'est le point de rupture le plus cher du tunnel. */

  const trackPhotoUploadStarted = useCallback(
    (photoCount: number) => {
      mesure(MESURES.envoiPhotoDemarre, { ...base(), photo_count: photoCount });
    },
    [base]
  );

  const trackPhotoUploaded = useCallback(
    (photoCount: number = 1, dureeMs?: number) => {
      mesure(MESURES.photoEnvoyee, {
        ...base(),
        photo_count: photoCount,
        duration_ms: dureeMs ?? null,
      });
    },
    [base]
  );

  const trackPhotoUploadFailed = useCallback(
    (raison: string) => {
      mesure(MESURES.envoiPhotoEchoue, { ...base(), reason: raison });
    },
    [base]
  );

  /** Clic sur « commander » sans photo : le formulaire refuse et renvoie a
      l'etape d'envoi. */
  const trackPurchaseBlocked = useCallback(
    (emplacement: "principal" | "barre_collante") => {
      mesure(MESURES.achatBloqueSansPhoto, { ...base(), placement: emplacement });
    },
    [base]
  );

  /** Clic sur le bouton d'achat. La barre collante est un ajout recent : sans
      cette distinction, rien ne dit si elle sert. */
  const trackBuyClicked = useCallback(
    (emplacement: "principal" | "barre_collante", value: number, currency: string) => {
      mesure(MESURES.achatClique, { ...base(), placement: emplacement, value, currency });
    },
    [base]
  );

  const trackCheckoutStarted = useCallback(
    (value: number, currency: string, selectedOptions: SelectedOptions) => {
      mesure(MESURES.caisseDemarree, {
        ...base(),
        value,
        currency,
        ...aplatirOptions(selectedOptions),
      });
    },
    [base]
  );

  return {
    trackOptionSelected,
    trackGalleryBrowsed,
    trackPhotoUploadStarted,
    trackPhotoUploaded,
    trackPhotoUploadFailed,
    trackPurchaseBlocked,
    trackBuyClicked,
    trackCheckoutStarted,
  };
}

/**
 * Les options partaient jusqu'ici dans un objet imbrique `selected_options`.
 * PostHog ne sait pas filtrer ni grouper sur une propriete imbriquee : la
 * question « le format pleine page convertit-il moins ? » etait donc
 * inaccessible alors que la donnee etait bien envoyee. A plat, elle
 * s'interroge.
 */
function aplatirOptions(o: SelectedOptions): Record<string, unknown> {
  return {
    format: o.format,
    people: o.people,
    animals: o.animals,
    background: o.background ?? null,
    print_option: o.printOption,
  };
}
