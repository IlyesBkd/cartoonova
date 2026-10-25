import type { Locale } from "../i18n/config";

/** Copy only: the standard clock starts when BOTH payment and photos are received. */
export const PREVIEW_PROMISE: Record<Locale, string> = {
  fr: "Premier aperçu sous 2 jours ouvrés après réception du paiement et des photos.",
  en: "First preview within 2 business days after receipt of payment and photos.",
  es: "Primera vista previa en 2 días hábiles tras recibir el pago y las fotos.",
  de: "Erste Vorschau innerhalb von 2 Werktagen nach Eingang der Zahlung und der Fotos.",
  it: "Prima anteprima entro 2 giorni lavorativi dalla ricezione del pagamento e delle foto.",
  nl: "Eerste voorbeeld binnen 2 werkdagen na ontvangst van de betaling en de foto's.",
  pl: "Pierwszy podgląd w ciągu 2 dni roboczych od otrzymania płatności i zdjęć.",
  sv: "Första förhandsvisningen inom 2 arbetsdagar efter att betalning och foton har tagits emot.",
  da: "Første forhåndsvisning inden for 2 hverdage efter modtagelse af betaling og fotos.",
  pt: "Primeira pré-visualização em 2 dias úteis após a receção do pagamento e das fotos.",
};

/** Printing follows customer approval; no fixed approval time or total arrival guarantee. */
export const PRINT_PROMISE: Record<Locale, string> = {
  fr: "Pour un tirage, la fabrication et la livraison prennent ensuite 3 à 7 jours ouvrés après ta validation de l'aperçu.",
  en: "For a print, production and delivery then take 3 to 7 business days after you approve the preview.",
  es: "Para una impresión, la producción y la entrega tardan después de 3 a 7 días hábiles tras tu aprobación de la vista previa.",
  de: "Bei einem Druck dauern Herstellung und Lieferung anschließend 3 bis 7 Werktage nach deiner Freigabe der Vorschau.",
  it: "Per una stampa, produzione e consegna richiedono poi da 3 a 7 giorni lavorativi dopo la tua approvazione dell'anteprima.",
  nl: "Voor een print duren productie en levering daarna 3 tot 7 werkdagen nadat je het voorbeeld hebt goedgekeurd.",
  pl: "W przypadku wydruku produkcja i dostawa zajmują następnie 3–7 dni roboczych po zaakceptowaniu przez Ciebie podglądu.",
  sv: "För ett tryck tar produktion och leverans sedan 3 till 7 arbetsdagar efter att du har godkänt förhandsvisningen.",
  da: "For et tryk tager produktion og levering derefter 3 til 7 hverdage, efter at du har godkendt forhåndsvisningen.",
  pt: "Para uma impressão, a produção e a entrega demoram depois 3 a 7 dias úteis após aprovares a pré-visualização.",
};
