import type { Lang } from "@/lib/email-i18n";

/* Textes du bouton d'envoi de photos de la page de depot (/depot/[token]).

   Le meme geste que sur la fiche produit, et donc les memes mots : sur
   telephone — la ou s'ouvre le lien de l'e-mail — « glissez vos photos ici »
   ne designe rien, il n'y a rien a glisser. Le bouton dit l'action ; le
   glisser-deposer reste propose en second, aux seuls ecrans a souris.

   Un fichier a part plutot que `depotPhotosPage` dans `email-i18n.ts` : ces
   textes ne servent qu'a l'interface, pas aux e-mails. La page de depot
   vouvoie, comme les e-mails dont elle est le prolongement. */
export const depotBouton: Record<Lang, { bouton: string; boutonAutre: string; glisser: string }> = {
  fr: {
    bouton: "Ajouter une photo",
    boutonAutre: "Ajouter une autre photo",
    glisser: "ou glissez-les ici depuis votre ordinateur",
  },
  en: {
    bouton: "Add a photo",
    boutonAutre: "Add another photo",
    glisser: "or drag them here from your computer",
  },
  es: {
    bouton: "Añadir una foto",
    boutonAutre: "Añadir otra foto",
    glisser: "o arrástralas aquí desde tu ordenador",
  },
  de: {
    bouton: "Foto hinzufügen",
    boutonAutre: "Weiteres Foto hinzufügen",
    glisser: "oder ziehen Sie sie von Ihrem Computer hierher",
  },
  it: {
    bouton: "Aggiungi una foto",
    boutonAutre: "Aggiungi un'altra foto",
    glisser: "oppure trascinale qui dal tuo computer",
  },
  nl: {
    bouton: "Foto toevoegen",
    boutonAutre: "Nog een foto toevoegen",
    glisser: "of sleep ze hierheen vanaf uw computer",
  },
  pl: {
    bouton: "Dodaj zdjęcie",
    boutonAutre: "Dodaj kolejne zdjęcie",
    glisser: "lub przeciągnij je tutaj z komputera",
  },
  sv: {
    bouton: "Lägg till ett foto",
    boutonAutre: "Lägg till ett foto till",
    glisser: "eller dra hit dem från datorn",
  },
  da: {
    bouton: "Tilføj et foto",
    boutonAutre: "Tilføj et foto mere",
    glisser: "eller træk dem herind fra din computer",
  },
  pt: {
    bouton: "Adicionar uma foto",
    boutonAutre: "Adicionar outra foto",
    glisser: "ou arraste-as para aqui a partir do seu computador",
  },
};
