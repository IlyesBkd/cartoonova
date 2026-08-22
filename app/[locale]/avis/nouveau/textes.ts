import type { Locale } from "@/i18n/config";

/**
 * Textes du formulaire d'avis.
 *
 * Ils vivent ici plutot que dans `messages/*.json` pour la meme raison que
 * ceux des emails dans `lib/email-i18n.ts` : un ensemble court, ferme, propre a
 * un seul ecran, se relit et se traduit plus surement d'un bloc que reparti
 * dans dix fichiers.
 */

export interface TextesAvis {
  titre: string;
  intro: string;
  introVerifie: string;
  nom: string;
  nomAide: string;
  note: string;
  message: string;
  messageAide: string;
  envoyer: string;
  envoi: string;
  merciTitre: string;
  merciPublie: string;
  merciModere: string;
  erreur: string;
  erreurTexte: string;
}

export const TEXTES_AVIS: Record<Locale, TextesAvis> = {
  fr: {
    titre: "Votre avis",
    intro: "Racontez votre experience en quelques lignes. Elle aidera les personnes qui hesitent.",
    introVerifie: "Votre commande est reconnue : votre avis sera publie directement.",
    nom: "Votre prenom",
    nomAide: "Affiche a cote de votre avis.",
    note: "Votre note",
    message: "Votre avis",
    messageAide: "20 caracteres minimum.",
    envoyer: "Publier mon avis",
    envoi: "Envoi...",
    merciTitre: "Merci !",
    merciPublie: "Votre avis est en ligne.",
    merciModere: "Votre avis nous est bien parvenu, il sera verifie avant publication.",
    erreur: "L'envoi a echoue. Reessayez dans un instant.",
    erreurTexte: "Merci d'ecrire au moins 20 caracteres.",
  },
  en: {
    titre: "Your review",
    intro: "Tell us about your experience in a few lines. It helps people who are hesitating.",
    introVerifie: "We recognise your order — your review will be published straight away.",
    nom: "Your first name",
    nomAide: "Shown next to your review.",
    note: "Your rating",
    message: "Your review",
    messageAide: "20 characters minimum.",
    envoyer: "Publish my review",
    envoi: "Sending...",
    merciTitre: "Thank you!",
    merciPublie: "Your review is live.",
    merciModere: "We've received your review — it will be checked before publication.",
    erreur: "Sending failed. Please try again in a moment.",
    erreurTexte: "Please write at least 20 characters.",
  },
  es: {
    titre: "Tu opinion",
    intro: "Cuentanos tu experiencia en unas lineas. Ayudara a quienes dudan.",
    introVerifie: "Reconocemos tu pedido: tu opinion se publicara directamente.",
    nom: "Tu nombre",
    nomAide: "Se muestra junto a tu opinion.",
    note: "Tu valoracion",
    message: "Tu opinion",
    messageAide: "Minimo 20 caracteres.",
    envoyer: "Publicar mi opinion",
    envoi: "Enviando...",
    merciTitre: "¡Gracias!",
    merciPublie: "Tu opinion ya esta publicada.",
    merciModere: "Hemos recibido tu opinion, se revisara antes de publicarse.",
    erreur: "El envio ha fallado. Intentalo de nuevo en un momento.",
    erreurTexte: "Escribe al menos 20 caracteres.",
  },
  de: {
    titre: "Ihre Bewertung",
    intro: "Erzahlen Sie in wenigen Zeilen von Ihrer Erfahrung. Das hilft Unentschlossenen.",
    introVerifie: "Ihre Bestellung ist erkannt — Ihre Bewertung wird direkt veroffentlicht.",
    nom: "Ihr Vorname",
    nomAide: "Wird neben Ihrer Bewertung angezeigt.",
    note: "Ihre Bewertung",
    message: "Ihr Text",
    messageAide: "Mindestens 20 Zeichen.",
    envoyer: "Bewertung veroffentlichen",
    envoi: "Wird gesendet...",
    merciTitre: "Vielen Dank!",
    merciPublie: "Ihre Bewertung ist online.",
    merciModere: "Wir haben Ihre Bewertung erhalten, sie wird vor der Veroffentlichung gepruft.",
    erreur: "Senden fehlgeschlagen. Bitte versuchen Sie es gleich noch einmal.",
    erreurTexte: "Bitte schreiben Sie mindestens 20 Zeichen.",
  },
  it: {
    titre: "La tua recensione",
    intro: "Raccontaci la tua esperienza in poche righe. Aiutera chi e indeciso.",
    introVerifie: "Riconosciamo il tuo ordine: la recensione sara pubblicata subito.",
    nom: "Il tuo nome",
    nomAide: "Mostrato accanto alla recensione.",
    note: "Il tuo voto",
    message: "La tua recensione",
    messageAide: "Minimo 20 caratteri.",
    envoyer: "Pubblica la recensione",
    envoi: "Invio...",
    merciTitre: "Grazie!",
    merciPublie: "La tua recensione e online.",
    merciModere: "Abbiamo ricevuto la recensione, sara verificata prima della pubblicazione.",
    erreur: "Invio non riuscito. Riprova tra un istante.",
    erreurTexte: "Scrivi almeno 20 caratteri.",
  },
  nl: {
    titre: "Jouw review",
    intro: "Vertel in een paar regels over je ervaring. Dat helpt twijfelaars.",
    introVerifie: "We herkennen je bestelling — je review wordt meteen geplaatst.",
    nom: "Je voornaam",
    nomAide: "Wordt naast je review getoond.",
    note: "Je beoordeling",
    message: "Je review",
    messageAide: "Minimaal 20 tekens.",
    envoyer: "Review plaatsen",
    envoi: "Versturen...",
    merciTitre: "Bedankt!",
    merciPublie: "Je review staat online.",
    merciModere: "We hebben je review ontvangen, hij wordt gecontroleerd voor publicatie.",
    erreur: "Versturen mislukt. Probeer het zo nog eens.",
    erreurTexte: "Schrijf minstens 20 tekens.",
  },
  pl: {
    titre: "Twoja opinia",
    intro: "Opisz swoje doswiadczenie w kilku zdaniach. Pomozesz osobom, ktore sie wahaja.",
    introVerifie: "Rozpoznajemy Twoje zamowienie — opinia zostanie opublikowana od razu.",
    nom: "Twoje imie",
    nomAide: "Wyswietlane obok opinii.",
    note: "Twoja ocena",
    message: "Twoja opinia",
    messageAide: "Minimum 20 znakow.",
    envoyer: "Opublikuj opinie",
    envoi: "Wysylanie...",
    merciTitre: "Dziekujemy!",
    merciPublie: "Twoja opinia jest juz widoczna.",
    merciModere: "Otrzymalismy opinie, sprawdzimy ja przed publikacja.",
    erreur: "Wysylanie nie powiodlo sie. Sprobuj za chwile.",
    erreurTexte: "Napisz co najmniej 20 znakow.",
  },
  sv: {
    titre: "Ditt omdome",
    intro: "Berätta om din upplevelse pa nagra rader. Det hjalper den som tvekar.",
    introVerifie: "Vi kanner igen din bestallning — ditt omdome publiceras direkt.",
    nom: "Ditt fornamn",
    nomAide: "Visas bredvid ditt omdome.",
    note: "Ditt betyg",
    message: "Ditt omdome",
    messageAide: "Minst 20 tecken.",
    envoyer: "Publicera mitt omdome",
    envoi: "Skickar...",
    merciTitre: "Tack!",
    merciPublie: "Ditt omdome ar publicerat.",
    merciModere: "Vi har tagit emot ditt omdome, det granskas fore publicering.",
    erreur: "Det gick inte att skicka. Forsok igen om en stund.",
    erreurTexte: "Skriv minst 20 tecken.",
  },
  da: {
    titre: "Din anmeldelse",
    intro: "Fortael om din oplevelse pa et par linjer. Det hjaelper dem, der er i tvivl.",
    introVerifie: "Vi genkender din ordre — din anmeldelse bliver udgivet med det samme.",
    nom: "Dit fornavn",
    nomAide: "Vises ved siden af din anmeldelse.",
    note: "Din vurdering",
    message: "Din anmeldelse",
    messageAide: "Mindst 20 tegn.",
    envoyer: "Udgiv min anmeldelse",
    envoi: "Sender...",
    merciTitre: "Tak!",
    merciPublie: "Din anmeldelse er online.",
    merciModere: "Vi har modtaget din anmeldelse, den bliver tjekket for udgivelse.",
    erreur: "Afsendelsen mislykkedes. Prov igen om et ojeblik.",
    erreurTexte: "Skriv mindst 20 tegn.",
  },
  pt: {
    titre: "A tua opiniao",
    intro: "Conta a tua experiencia em poucas linhas. Vai ajudar quem esta indeciso.",
    introVerifie: "Reconhecemos a tua encomenda: a opiniao sera publicada de imediato.",
    nom: "O teu nome",
    nomAide: "Mostrado ao lado da tua opiniao.",
    note: "A tua nota",
    message: "A tua opiniao",
    messageAide: "Minimo 20 caracteres.",
    envoyer: "Publicar a minha opiniao",
    envoi: "A enviar...",
    merciTitre: "Obrigado!",
    merciPublie: "A tua opiniao esta online.",
    merciModere: "Recebemos a tua opiniao, sera verificada antes da publicacao.",
    erreur: "O envio falhou. Tenta novamente daqui a pouco.",
    erreurTexte: "Escreve pelo menos 20 caracteres.",
  },
};
