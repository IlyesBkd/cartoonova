import type { Lang } from "@/lib/email-i18n";

/* Textes de la page de succes ajoutes avec la caisse d'octobre 2026.
   Hors de `successPage` (lib/email-i18n.ts) pour ne pas toucher ce fichier
   partage ; meme forme, meme cle de langue. */
export interface TextesDepotSucces {
  /** Bouton principal quand la commande n'a pas encore de photo. */
  envoyer: string;
  /** Ligne d'explication sous le bouton. */
  pourquoi: string;
}

export const depotSucces: Record<Lang, TextesDepotSucces> = {
  fr: {
    envoyer: "Envoie tes photos maintenant",
    pourquoi: "L'illustrateur commence dès qu'il a tes photos. Ça prend une minute.",
  },
  en: {
    envoyer: "Send your photos now",
    pourquoi: "Your illustrator starts as soon as your photos arrive. It takes a minute.",
  },
  es: {
    envoyer: "Envía tus fotos ahora",
    pourquoi: "El ilustrador empieza en cuanto recibe tus fotos. Te lleva un minuto.",
  },
  de: {
    envoyer: "Jetzt deine Fotos senden",
    pourquoi: "Dein Illustrator legt los, sobald deine Fotos da sind. Dauert nur eine Minute.",
  },
  it: {
    envoyer: "Invia subito le tue foto",
    pourquoi: "L'illustratore inizia appena riceve le tue foto. Ci vuole un minuto.",
  },
  nl: {
    envoyer: "Stuur nu je foto's",
    pourquoi: "De illustrator begint zodra je foto's binnen zijn. Het duurt maar een minuut.",
  },
  pl: {
    envoyer: "Wyślij teraz swoje zdjęcia",
    pourquoi: "Ilustrator zaczyna, gdy tylko dostanie Twoje zdjęcia. To zajmie minutę.",
  },
  sv: {
    envoyer: "Skicka dina foton nu",
    pourquoi: "Illustratören börjar så fort dina foton har kommit. Det tar en minut.",
  },
  da: {
    envoyer: "Send dine billeder nu",
    pourquoi: "Illustratoren går i gang, så snart dine billeder er modtaget. Det tager et minut.",
  },
  pt: {
    envoyer: "Envia as tuas fotos agora",
    pourquoi: "O ilustrador começa assim que recebe as tuas fotos. Demora um minuto.",
  },
};
