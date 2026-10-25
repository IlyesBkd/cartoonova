import type { Lang } from "@/lib/email-i18n";

// Dedicated catalogue: usable on token pages without an intl provider.
export const PHOTO_PRIVACY: Record<Lang, { notice: string; details: string }> = {
  "fr": {
    "notice": "Vos photos sources servent à réaliser votre commande. Vos photos et votre portrait final ne sont pas utilisés pour notre promotion sans autorisation séparée. Commander ne donne pas cette autorisation.",
    "details": "Stockage et demandes de suppression"
  },
  "en": {
    "notice": "Your source photos are used to create your order. Your photos and final portrait are not used for our promotion without separate authorisation. Ordering does not give that authorisation.",
    "details": "Storage and deletion requests"
  },
  "de": {
    "notice": "Ihre Ausgangsfotos dienen zur Ausführung Ihrer Bestellung. Ihre Fotos und Ihr fertiges Porträt werden ohne gesonderte Zustimmung nicht für unsere Werbung genutzt. Eine Bestellung erteilt diese Zustimmung nicht.",
    "details": "Speicherung und Löschanfragen"
  },
  "es": {
    "notice": "Sus fotos originales se utilizan para realizar su pedido. Sus fotos y su retrato final no se utilizan para nuestra promoción sin autorización independiente. Realizar un pedido no concede esa autorización.",
    "details": "Almacenamiento y solicitudes de eliminación"
  },
  "it": {
    "notice": "Le sue foto originali servono a realizzare l’ordine. Le foto e il ritratto finale non vengono usati per la nostra promozione senza autorizzazione separata. Ordinare non concede tale autorizzazione.",
    "details": "Archiviazione e richieste di cancellazione"
  },
  "nl": {
    "notice": "Uw bronfoto’s worden gebruikt om uw bestelling te maken. Uw foto’s en uiteindelijke portret worden niet voor onze promotie gebruikt zonder afzonderlijke toestemming. Bestellen geeft die toestemming niet.",
    "details": "Opslag en verwijderingsverzoeken"
  },
  "pl": {
    "notice": "Zdjęcia źródłowe służą do realizacji zamówienia. Zdjęcia i gotowy portret nie są wykorzystywane do naszej promocji bez odrębnej zgody. Złożenie zamówienia nie oznacza udzielenia takiej zgody.",
    "details": "Przechowywanie i wnioski o usunięcie"
  },
  "sv": {
    "notice": "Dina källfoton används för att skapa din beställning. Dina foton och ditt färdiga porträtt används inte för vår marknadsföring utan separat tillstånd. Att beställa ger inte detta tillstånd.",
    "details": "Lagring och begäran om radering"
  },
  "da": {
    "notice": "Dine kildefotos bruges til at lave din bestilling. Dine fotos og dit færdige portræt bruges ikke til vores markedsføring uden særskilt tilladelse. En bestilling giver ikke denne tilladelse.",
    "details": "Opbevaring og anmodninger om sletning"
  },
  "pt": {
    "notice": "As suas fotografias originais servem para realizar a encomenda. As fotografias e o retrato final não são usados para a nossa promoção sem autorização separada. Encomendar não concede essa autorização.",
    "details": "Armazenamento e pedidos de eliminação"
  }
};
