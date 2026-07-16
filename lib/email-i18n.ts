export type Lang = "fr" | "en" | "es" | "de" | "it";

// Country code → language mapping
const countryToLang: Record<string, Lang> = {
  // French
  FR: "fr", MC: "fr", BE: "fr", LU: "fr", CH: "fr",
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es",
  // German
  DE: "de", AT: "de",
  // Italian
  IT: "it", SM: "it", VA: "it",
  // English (default)
  US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", ZA: "en",
  IN: "en", SG: "en", PH: "en", NG: "en", KE: "en",
};

export function getLangFromCountry(country: string | null | undefined): Lang {
  if (!country) return "fr";
  return countryToLang[country.toUpperCase()] || "en";
}

// ─── Confirmation email (order placed) ────────────────────────────────
export const confirmationEmail: Record<Lang, {
  subject: string;
  title: string;
  orderConfirmed: (ref: string) => string;
  summary: string;
  format: string;
  people: string;
  animals: string;
  option: string;
  total: string;
  artistsWorking: string;
  deliveryTime: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: "🎉 Commande confirmée - Vos artistes commencent !",
    title: "🎉 BOOM ! C'est dans la boîte !",
    orderConfirmed: (ref) => `Votre commande #${ref} est confirmée`,
    summary: "Récapitulatif",
    format: "Format",
    people: "Personnes",
    animals: "Animaux",
    option: "Option",
    total: "Total",
    artistsWorking: "🎨 Nos artistes se mettent au travail !",
    deliveryTime: "Vous recevrez votre illustration dans 3-5 jours ouvrables.",
    thanks: "Merci pour votre confiance ! 🎨",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: "🎉 Order confirmed - Your artists are on it!",
    title: "🎉 BOOM! You're all set!",
    orderConfirmed: (ref) => `Your order #${ref} is confirmed`,
    summary: "Summary",
    format: "Format",
    people: "People",
    animals: "Animals",
    option: "Option",
    total: "Total",
    artistsWorking: "🎨 Our artists are getting to work!",
    deliveryTime: "You'll receive your illustration within 3-5 business days.",
    thanks: "Thank you for your trust! 🎨",
    team: "The Cartoonova Team",
  },
  es: {
    subject: "🎉 Pedido confirmado - ¡Tus artistas empiezan!",
    title: "🎉 ¡BOOM! ¡Todo listo!",
    orderConfirmed: (ref) => `Tu pedido #${ref} está confirmado`,
    summary: "Resumen",
    format: "Formato",
    people: "Personas",
    animals: "Animales",
    option: "Opción",
    total: "Total",
    artistsWorking: "🎨 ¡Nuestros artistas se ponen manos a la obra!",
    deliveryTime: "Recibirás tu ilustración en 3-5 días laborables.",
    thanks: "¡Gracias por tu confianza! 🎨",
    team: "El equipo Cartoonova",
  },
  de: {
    subject: "🎉 Bestellung bestätigt - Ihre Künstler legen los!",
    title: "🎉 BOOM! Alles klar!",
    orderConfirmed: (ref) => `Ihre Bestellung #${ref} ist bestätigt`,
    summary: "Zusammenfassung",
    format: "Format",
    people: "Personen",
    animals: "Tiere",
    option: "Option",
    total: "Gesamt",
    artistsWorking: "🎨 Unsere Künstler machen sich an die Arbeit!",
    deliveryTime: "Sie erhalten Ihre Illustration innerhalb von 3-5 Werktagen.",
    thanks: "Vielen Dank für Ihr Vertrauen! 🎨",
    team: "Das Cartoonova-Team",
  },
  it: {
    subject: "🎉 Ordine confermato - I tuoi artisti iniziano!",
    title: "🎉 BOOM! Tutto pronto!",
    orderConfirmed: (ref) => `Il tuo ordine #${ref} è confermato`,
    summary: "Riepilogo",
    format: "Formato",
    people: "Persone",
    animals: "Animali",
    option: "Opzione",
    total: "Totale",
    artistsWorking: "🎨 I nostri artisti si mettono al lavoro!",
    deliveryTime: "Riceverai la tua illustrazione entro 3-5 giorni lavorativi.",
    thanks: "Grazie per la tua fiducia! 🎨",
    team: "Il team Cartoonova",
  },
};

// ─── Final image email (delivery) ─────────────────────────────────────
export const finalImageEmail: Record<Lang, {
  subject: string;
  title: string;
  greeting: (name: string | null) => string;
  ready: (ref: string) => string;
  download: string;
  feedback: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: "🎨 Votre illustration Cartoonova est prête !",
    title: "🎨 Votre illustration est prête !",
    greeting: (name) => name ? `Bonjour ${name},` : "Bonjour,",
    ready: (ref) => `Votre commande <strong>#${ref}</strong> a été finalisée par nos artistes. Découvrez le résultat ci-dessous :`,
    download: "Télécharger mon illustration",
    feedback: "Si vous avez des retours ou besoin d'une modification, répondez simplement à cet email.",
    thanks: "Merci pour votre confiance ! 🎨",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: "🎨 Your Cartoonova illustration is ready!",
    title: "🎨 Your illustration is ready!",
    greeting: (name) => name ? `Hello ${name},` : "Hello,",
    ready: (ref) => `Your order <strong>#${ref}</strong> has been completed by our artists. Check out the result below:`,
    download: "Download my illustration",
    feedback: "If you have any feedback or need a revision, simply reply to this email.",
    thanks: "Thank you for your trust! 🎨",
    team: "The Cartoonova Team",
  },
  es: {
    subject: "🎨 ¡Tu ilustración Cartoonova está lista!",
    title: "🎨 ¡Tu ilustración está lista!",
    greeting: (name) => name ? `Hola ${name},` : "Hola,",
    ready: (ref) => `Tu pedido <strong>#${ref}</strong> ha sido finalizado por nuestros artistas. Descubre el resultado a continuación:`,
    download: "Descargar mi ilustración",
    feedback: "Si tienes algún comentario o necesitas una modificación, simplemente responde a este email.",
    thanks: "¡Gracias por tu confianza! 🎨",
    team: "El equipo Cartoonova",
  },
  de: {
    subject: "🎨 Ihre Cartoonova-Illustration ist fertig!",
    title: "🎨 Ihre Illustration ist fertig!",
    greeting: (name) => name ? `Hallo ${name},` : "Hallo,",
    ready: (ref) => `Ihre Bestellung <strong>#${ref}</strong> wurde von unseren Künstlern fertiggestellt. Entdecken Sie das Ergebnis:`,
    download: "Meine Illustration herunterladen",
    feedback: "Wenn Sie Feedback haben oder eine Änderung benötigen, antworten Sie einfach auf diese E-Mail.",
    thanks: "Vielen Dank für Ihr Vertrauen! 🎨",
    team: "Das Cartoonova-Team",
  },
  it: {
    subject: "🎨 La tua illustrazione Cartoonova è pronta!",
    title: "🎨 La tua illustrazione è pronta!",
    greeting: (name) => name ? `Ciao ${name},` : "Ciao,",
    ready: (ref) => `Il tuo ordine <strong>#${ref}</strong> è stato completato dai nostri artisti. Scopri il risultato qui sotto:`,
    download: "Scarica la mia illustrazione",
    feedback: "Se hai dei commenti o hai bisogno di una modifica, rispondi semplicemente a questa email.",
    thanks: "Grazie per la tua fiducia! 🎨",
    team: "Il team Cartoonova",
  },
};

// ─── Poster confirmation email (before printing/shipping) ────────────
export const posterConfirmationEmail: Record<Lang, {
  subject: string;
  title: string;
  greeting: (name: string | null) => string;
  intro: (ref: string) => string;
  attachmentNote: string;
  cta: string;
  reassurance: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: "✅ Confirmez votre visuel avant impression",
    title: "✅ Un dernier accord avant impression",
    greeting: (name) => name ? `Bonjour ${name},` : "Bonjour,",
    intro: (ref) => `Votre poster de la commande <strong>#${ref}</strong> est prêt à partir en impression. Vous trouverez la photo finale ci-dessous et en pièce jointe de cet email.`,
    attachmentNote: "📎 Le visuel final est joint à cet email.",
    cta: "Voir et valider mon visuel",
    reassurance: "Une fois votre confirmation reçue, nous lançons l'impression et l'expédition de votre poster.",
    thanks: "Merci pour votre confiance ! 🎨",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: "✅ Confirm your artwork before printing",
    title: "✅ One last check before printing",
    greeting: (name) => name ? `Hello ${name},` : "Hello,",
    intro: (ref) => `Your poster for order <strong>#${ref}</strong> is ready to go to print. You'll find the final photo below and attached to this email.`,
    attachmentNote: "📎 The final artwork is attached to this email.",
    cta: "View and confirm my artwork",
    reassurance: "Once we receive your confirmation, we'll start printing and shipping your poster.",
    thanks: "Thank you for your trust! 🎨",
    team: "The Cartoonova Team",
  },
  es: {
    subject: "✅ Confirma tu diseño antes de imprimir",
    title: "✅ Una última confirmación antes de imprimir",
    greeting: (name) => name ? `Hola ${name},` : "Hola,",
    intro: (ref) => `Tu póster del pedido <strong>#${ref}</strong> está listo para imprimirse. Encontrarás la foto final debajo y adjunta a este correo.`,
    attachmentNote: "📎 El diseño final está adjunto a este correo.",
    cta: "Ver y confirmar mi diseño",
    reassurance: "En cuanto recibamos tu confirmación, empezaremos a imprimir y enviar tu póster.",
    thanks: "¡Gracias por tu confianza! 🎨",
    team: "El equipo Cartoonova",
  },
  de: {
    subject: "✅ Bestätigen Sie Ihr Motiv vor dem Druck",
    title: "✅ Eine letzte Bestätigung vor dem Druck",
    greeting: (name) => name ? `Hallo ${name},` : "Hallo,",
    intro: (ref) => `Ihr Poster zur Bestellung <strong>#${ref}</strong> ist druckfertig. Das finale Bild finden Sie unten und im Anhang dieser E-Mail.`,
    attachmentNote: "📎 Das finale Motiv ist dieser E-Mail beigefügt.",
    cta: "Motiv ansehen und bestätigen",
    reassurance: "Sobald Ihre Bestätigung eingeht, starten wir den Druck und Versand Ihres Posters.",
    thanks: "Vielen Dank für Ihr Vertrauen! 🎨",
    team: "Das Cartoonova-Team",
  },
  it: {
    subject: "✅ Conferma la tua grafica prima della stampa",
    title: "✅ Un'ultima conferma prima della stampa",
    greeting: (name) => name ? `Ciao ${name},` : "Ciao,",
    intro: (ref) => `Il tuo poster dell'ordine <strong>#${ref}</strong> è pronto per la stampa. Trovi la foto finale qui sotto e in allegato a questa email.`,
    attachmentNote: "📎 La grafica finale è allegata a questa email.",
    cta: "Visualizza e conferma la mia grafica",
    reassurance: "Non appena riceviamo la tua conferma, avviamo la stampa e la spedizione del tuo poster.",
    thanks: "Grazie per la tua fiducia! 🎨",
    team: "Il team Cartoonova",
  },
};

// ─── Poster confirmation public page ──────────────────────────────────
export const posterConfirmationPage: Record<Lang, {
  pageTitle: string;
  heading: (ref: string) => string;
  description: string;
  confirmButton: string;
  changesButton: string;
  confirmedTitle: string;
  confirmedBody: string;
  changesPrompt: string;
  changesPlaceholder: string;
  changesSubmit: string;
  changesTitle: string;
  changesBody: string;
  alreadyRespondedConfirmed: (date: string) => string;
  alreadyRespondedChanges: (date: string) => string;
  invalidTitle: string;
  invalidBody: string;
  sending: string;
}> = {
  fr: {
    pageTitle: "Confirmez votre poster — Cartoonova",
    heading: (ref) => `Commande #${ref}`,
    description: "Merci de vérifier attentivement le visuel ci-dessous avant que nous lancions l'impression de votre poster.",
    confirmButton: "✅ Je confirme, imprimez et envoyez",
    changesButton: "✏️ Je demande une modification",
    confirmedTitle: "Merci, c'est confirmé !",
    confirmedBody: "Votre poster part en impression puis en expédition. Vous recevrez un email dès son envoi.",
    changesPrompt: "Quelle modification souhaitez-vous ?",
    changesPlaceholder: "Ex : le fond doit être bleu et non vert...",
    changesSubmit: "Envoyer ma demande",
    changesTitle: "Bien reçu !",
    changesBody: "Votre demande a été transmise à notre équipe. Nous ne lancerons pas l'impression avant votre accord.",
    alreadyRespondedConfirmed: (date) => `Vous avez déjà confirmé ce visuel le ${date}.`,
    alreadyRespondedChanges: (date) => `Vous avez déjà demandé une modification le ${date}. Vous pouvez changer d'avis ci-dessous.`,
    invalidTitle: "Lien invalide ou expiré",
    invalidBody: "Ce lien de confirmation n'est plus valide. Contactez-nous à info.cartoonova@gmail.com avec votre numéro de commande.",
    sending: "Envoi en cours...",
  },
  en: {
    pageTitle: "Confirm your poster — Cartoonova",
    heading: (ref) => `Order #${ref}`,
    description: "Please review the artwork below carefully before we send your poster to print.",
    confirmButton: "✅ I confirm, print and ship it",
    changesButton: "✏️ I'd like a change",
    confirmedTitle: "Thanks, you're all set!",
    confirmedBody: "Your poster is going to print and will ship soon. You'll get an email as soon as it's on its way.",
    changesPrompt: "What would you like changed?",
    changesPlaceholder: "E.g. the background should be blue, not green...",
    changesSubmit: "Send my request",
    changesTitle: "Got it!",
    changesBody: "Your request has been sent to our team. We won't start printing until you approve it.",
    alreadyRespondedConfirmed: (date) => `You already confirmed this artwork on ${date}.`,
    alreadyRespondedChanges: (date) => `You already requested a change on ${date}. You can change your mind below.`,
    invalidTitle: "Invalid or expired link",
    invalidBody: "This confirmation link is no longer valid. Contact us at info.cartoonova@gmail.com with your order number.",
    sending: "Sending...",
  },
  es: {
    pageTitle: "Confirma tu póster — Cartoonova",
    heading: (ref) => `Pedido #${ref}`,
    description: "Revisa con atención el diseño de abajo antes de que enviemos tu póster a imprimir.",
    confirmButton: "✅ Confirmo, imprímanlo y envíenlo",
    changesButton: "✏️ Quiero un cambio",
    confirmedTitle: "¡Gracias, todo listo!",
    confirmedBody: "Tu póster pasa a imprenta y se enviará pronto. Te avisaremos por email en cuanto salga.",
    changesPrompt: "¿Qué te gustaría cambiar?",
    changesPlaceholder: "Ej: el fondo debería ser azul, no verde...",
    changesSubmit: "Enviar mi solicitud",
    changesTitle: "¡Recibido!",
    changesBody: "Tu solicitud ha sido enviada a nuestro equipo. No imprimiremos hasta tu aprobación.",
    alreadyRespondedConfirmed: (date) => `Ya confirmaste este diseño el ${date}.`,
    alreadyRespondedChanges: (date) => `Ya pediste un cambio el ${date}. Puedes cambiar de opinión abajo.`,
    invalidTitle: "Enlace no válido o caducado",
    invalidBody: "Este enlace de confirmación ya no es válido. Contáctanos en info.cartoonova@gmail.com con tu número de pedido.",
    sending: "Enviando...",
  },
  de: {
    pageTitle: "Poster bestätigen — Cartoonova",
    heading: (ref) => `Bestellung #${ref}`,
    description: "Bitte prüfen Sie das Motiv unten sorgfältig, bevor wir Ihr Poster in den Druck geben.",
    confirmButton: "✅ Ich bestätige, drucken und versenden",
    changesButton: "✏️ Ich möchte eine Änderung",
    confirmedTitle: "Danke, alles bestätigt!",
    confirmedBody: "Ihr Poster geht in den Druck und wird bald versendet. Sie erhalten eine E-Mail, sobald es unterwegs ist.",
    changesPrompt: "Was möchten Sie geändert haben?",
    changesPlaceholder: "Z. B. der Hintergrund sollte blau statt grün sein...",
    changesSubmit: "Anfrage senden",
    changesTitle: "Verstanden!",
    changesBody: "Ihre Anfrage wurde an unser Team weitergeleitet. Wir starten den Druck erst nach Ihrer Freigabe.",
    alreadyRespondedConfirmed: (date) => `Sie haben dieses Motiv bereits am ${date} bestätigt.`,
    alreadyRespondedChanges: (date) => `Sie haben bereits am ${date} eine Änderung angefragt. Sie können Ihre Meinung unten ändern.`,
    invalidTitle: "Ungültiger oder abgelaufener Link",
    invalidBody: "Dieser Bestätigungslink ist nicht mehr gültig. Kontaktieren Sie uns unter info.cartoonova@gmail.com mit Ihrer Bestellnummer.",
    sending: "Wird gesendet...",
  },
  it: {
    pageTitle: "Conferma il tuo poster — Cartoonova",
    heading: (ref) => `Ordine #${ref}`,
    description: "Controlla attentamente la grafica qui sotto prima che mandiamo il tuo poster in stampa.",
    confirmButton: "✅ Confermo, stampatelo e speditelo",
    changesButton: "✏️ Vorrei una modifica",
    confirmedTitle: "Grazie, tutto confermato!",
    confirmedBody: "Il tuo poster va in stampa e verrà spedito a breve. Ti avviseremo via email non appena partirà.",
    changesPrompt: "Cosa vorresti modificare?",
    changesPlaceholder: "Es: lo sfondo dovrebbe essere blu, non verde...",
    changesSubmit: "Invia la mia richiesta",
    changesTitle: "Ricevuto!",
    changesBody: "La tua richiesta è stata inviata al nostro team. Non avvieremo la stampa senza la tua approvazione.",
    alreadyRespondedConfirmed: (date) => `Hai già confermato questa grafica il ${date}.`,
    alreadyRespondedChanges: (date) => `Hai già richiesto una modifica il ${date}. Puoi cambiare idea qui sotto.`,
    invalidTitle: "Link non valido o scaduto",
    invalidBody: "Questo link di conferma non è più valido. Contattaci a info.cartoonova@gmail.com con il numero del tuo ordine.",
    sending: "Invio in corso...",
  },
};
