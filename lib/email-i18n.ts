type Lang = "fr" | "en" | "es" | "de" | "it";

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
