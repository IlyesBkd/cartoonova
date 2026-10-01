import type { Lang } from "@/lib/email-i18n";

/**
 * Textes des e-mails envoyes par le serveur hors next-intl.
 *
 * Dans un fichier a part plutot que dans lib/email-i18n.ts, pour la meme
 * raison que lib/i18n/relances.ts : ce dernier est enorme et importe par des
 * composants clients. Ce fichier n'importe qu'un type.
 *
 * Tutoiement en francais, comme le reste du parcours post-achat.
 */

/* ─── Accuse de reception d'une demande de retouche ──────────────────────
   Un client a demande une retouche puis s'est plaint de n'avoir « aucune
   reponse » : la demande etait bien arrivee, mais rien ne le lui disait. Cet
   e-mail ne promet que ce qu'on tient — une reponse sous 24 h, pas la
   retouche elle-meme dans ce delai. */

export const accuseRetoucheEmail: Record<Lang, {
  subject: (ref: string) => string;
  title: string;
  greeting: (name: string | null) => string;
  body: string;
  delay: string;
  yourRequest: string;
  reply: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: (ref) => `On a bien reçu ta demande de retouche (commande ${ref})`,
    title: "Demande reçue",
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    body: "On a bien reçu ta demande de retouche sur ton portrait. Notre illustrateur s'en occupe.",
    delay: "Tu auras une réponse sous 24 h, avec le visuel corrigé ou une question si un détail n'est pas clair.",
    yourRequest: "Ta demande :",
    reply: "Un détail à ajouter ou une photo à nous montrer ? Réponds simplement à cet e-mail.",
    thanks: "Merci pour ta patience !",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: (ref) => `We've received your revision request (order ${ref})`,
    title: "Request received",
    greeting: (name) => (name ? `Hi ${name},` : "Hi there,"),
    body: "We've received your revision request for your portrait. Our illustrator is on it.",
    delay: "You'll hear back from us within 24 hours, with the updated artwork or a question if a detail isn't clear.",
    yourRequest: "Your request:",
    reply: "Something to add or a photo to show us? Just reply to this email.",
    thanks: "Thanks for your patience!",
    team: "The Cartoonova team",
  },
  es: {
    subject: (ref) => `Hemos recibido tu solicitud de retoque (pedido ${ref})`,
    title: "Solicitud recibida",
    greeting: (name) => (name ? `Hola ${name}:` : "¡Hola!"),
    body: "Hemos recibido tu solicitud de retoque de tu retrato. Nuestro ilustrador ya se está encargando.",
    delay: "Tendrás una respuesta en menos de 24 h, con el diseño corregido o una pregunta si algún detalle no está claro.",
    yourRequest: "Tu solicitud:",
    reply: "¿Quieres añadir algo o enseñarnos una foto? Responde simplemente a este e-mail.",
    thanks: "¡Gracias por tu paciencia!",
    team: "El equipo de Cartoonova",
  },
  de: {
    subject: (ref) => `Wir haben deinen Änderungswunsch erhalten (Bestellung ${ref})`,
    title: "Anfrage erhalten",
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    body: "Wir haben deinen Änderungswunsch für dein Porträt erhalten. Unser Illustrator kümmert sich darum.",
    delay: "Du bekommst innerhalb von 24 Stunden eine Antwort – mit dem überarbeiteten Entwurf oder einer Rückfrage, falls ein Detail unklar ist.",
    yourRequest: "Dein Wunsch:",
    reply: "Möchtest du etwas ergänzen oder uns ein Foto zeigen? Antworte einfach auf diese E-Mail.",
    thanks: "Danke für deine Geduld!",
    team: "Dein Cartoonova-Team",
  },
  it: {
    subject: (ref) => `Abbiamo ricevuto la tua richiesta di modifica (ordine ${ref})`,
    title: "Richiesta ricevuta",
    greeting: (name) => (name ? `Ciao ${name},` : "Ciao,"),
    body: "Abbiamo ricevuto la tua richiesta di modifica del ritratto. Il nostro illustratore se ne sta occupando.",
    delay: "Riceverai una risposta entro 24 ore, con il disegno corretto o una domanda se qualche dettaglio non è chiaro.",
    yourRequest: "La tua richiesta:",
    reply: "Vuoi aggiungere qualcosa o mostrarci una foto? Rispondi semplicemente a questa e-mail.",
    thanks: "Grazie per la pazienza!",
    team: "Il team Cartoonova",
  },
  nl: {
    subject: (ref) => `We hebben je verzoek om aanpassing ontvangen (bestelling ${ref})`,
    title: "Verzoek ontvangen",
    greeting: (name) => (name ? `Hoi ${name},` : "Hoi,"),
    body: "We hebben je verzoek om je portret aan te passen goed ontvangen. Onze illustrator gaat ermee aan de slag.",
    delay: "Je krijgt binnen 24 uur antwoord, met het aangepaste ontwerp of een vraag als een detail niet duidelijk is.",
    yourRequest: "Je verzoek:",
    reply: "Iets toe te voegen of een foto om ons te laten zien? Beantwoord gewoon deze e-mail.",
    thanks: "Bedankt voor je geduld!",
    team: "Het Cartoonova-team",
  },
  pl: {
    subject: (ref) => `Otrzymaliśmy Twoją prośbę o poprawkę (zamówienie ${ref})`,
    title: "Prośba otrzymana",
    greeting: (name) => (name ? `Cześć ${name},` : "Cześć,"),
    body: "Otrzymaliśmy Twoją prośbę o poprawkę portretu. Nasz ilustrator już się nią zajmuje.",
    delay: "Odpowiemy w ciągu 24 godzin – z poprawionym projektem albo z pytaniem, jeśli jakiś szczegół będzie niejasny.",
    yourRequest: "Twoja prośba:",
    reply: "Chcesz coś dodać albo pokazać nam zdjęcie? Po prostu odpowiedz na tego e-maila.",
    thanks: "Dziękujemy za cierpliwość!",
    team: "Zespół Cartoonova",
  },
  sv: {
    subject: (ref) => `Vi har tagit emot din begäran om ändring (order ${ref})`,
    title: "Begäran mottagen",
    greeting: (name) => (name ? `Hej ${name},` : "Hej,"),
    body: "Vi har tagit emot din begäran om ändring av ditt porträtt. Vår illustratör tar hand om den.",
    delay: "Du får svar inom 24 timmar, med den uppdaterade bilden eller en fråga om någon detalj är oklar.",
    yourRequest: "Din begäran:",
    reply: "Något att lägga till eller ett foto att visa oss? Svara bara på det här mejlet.",
    thanks: "Tack för ditt tålamod!",
    team: "Cartoonova-teamet",
  },
  da: {
    subject: (ref) => `Vi har modtaget din anmodning om rettelse (ordre ${ref})`,
    title: "Anmodning modtaget",
    greeting: (name) => (name ? `Hej ${name},` : "Hej,"),
    body: "Vi har modtaget din anmodning om at rette dit portræt. Vores illustrator er i gang.",
    delay: "Du får svar inden for 24 timer, med det rettede motiv eller et spørgsmål, hvis en detalje er uklar.",
    yourRequest: "Din anmodning:",
    reply: "Noget at tilføje eller et foto at vise os? Svar blot på denne e-mail.",
    thanks: "Tak for din tålmodighed!",
    team: "Cartoonova-teamet",
  },
  pt: {
    subject: (ref) => `Recebemos o teu pedido de alteração (encomenda ${ref})`,
    title: "Pedido recebido",
    greeting: (name) => (name ? `Olá ${name},` : "Olá,"),
    body: "Recebemos o teu pedido de alteração do retrato. O nosso ilustrador já está a tratar disso.",
    delay: "Vais ter uma resposta em menos de 24 h, com o desenho corrigido ou uma pergunta se algum detalhe não estiver claro.",
    yourRequest: "O teu pedido:",
    reply: "Queres acrescentar algo ou mostrar-nos uma foto? Responde simplesmente a este e-mail.",
    thanks: "Obrigado pela paciência!",
    team: "A equipa Cartoonova",
  },
};
