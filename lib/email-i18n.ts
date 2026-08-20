export type Lang = "fr"| "en"| "es"| "de"| "it";

// Country code → language mapping
const countryToLang: Record<string, Lang>= {
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
 /* Pays-Bas : le site est en neerlandais depuis l'ajout de la locale nl,
    mais ces gabarits d'e-mail ne le sont pas encore. On declare donc
    l'anglais explicitement plutot que de laisser le repli l'y amener par
    accident — et pour que ce soit cette ligne, et non un comportement par
    defaut, qu'on modifie le jour ou les e-mails seront traduits. */
 NL: "en",
 /* Pologne : meme raison que les Pays-Bas — le site parle polonais, ces
    gabarits pas encore. */
 PL: "en",
};

export function getLangFromCountry(country: string | null | undefined): Lang {
 if (!country) return "fr";
 return countryToLang[country.toUpperCase()] || "en";
}

// ─── Confirmation email (order placed) ────────────────────────────────
export const confirmationEmail: Record<Lang, {
 subject: string;
 title: string;
 orderConfirmed: (ref: string) =>string;
 summary: string;
 format: string;
 people: string;
 animals: string;
 option: string;
 total: string;
 artistsWorking: string;
 deliveryTime: string;
 /** Libelle du bouton vers la page de suivi de commande. */
 trackOrder: string;
 thanks: string;
 team: string;
}>= {
 fr: {
 subject: "Commande confirmée - Vos artistes commencent!",
 title: "BOOM! C'est dans la boîte!",
 orderConfirmed: (ref) =>`Votre commande #${ref} est confirmée`,
 summary: "Récapitulatif",
 format: "Format",
 people: "Personnes",
 animals: "Animaux",
 option: "Option",
 total: "Total",
 artistsWorking: "Nos artistes se mettent au travail!",
 deliveryTime: "Le dessin est réalisé en 2 jours. Si vous avez commandé une impression (poster, toile), comptez 3 jours ouvrés supplémentaires pour la fabrication et l'envoi.",
 trackOrder: "Suivre ma commande",
 thanks: "Merci pour votre confiance! ",
 team: "L'équipe Cartoonova",
 },
 en: {
 subject: "Order confirmed - Your artists are on it!",
 title: "BOOM! You're all set!",
 orderConfirmed: (ref) =>`Your order #${ref} is confirmed`,
 summary: "Summary",
 format: "Format",
 people: "People",
 animals: "Animals",
 option: "Option",
 total: "Total",
 artistsWorking: "Our artists are getting to work!",
 deliveryTime: "The artwork is completed within 2 days. If you ordered a physical print (poster, canvas), add 3 business days for production and shipping.",
 trackOrder: "Track my order",
 thanks: "Thank you for your trust! ",
 team: "The Cartoonova Team",
 },
 es: {
 subject: "Pedido confirmado - ¡Tus artistas empiezan!",
 title: "¡BOOM! ¡Todo listo!",
 orderConfirmed: (ref) =>`Tu pedido #${ref} está confirmado`,
 summary: "Resumen",
 format: "Formato",
 people: "Personas",
 animals: "Animales",
 option: "Opción",
 total: "Total",
 artistsWorking: "¡Nuestros artistas se ponen manos a la obra!",
 deliveryTime: "El dibujo se realiza en 2 días. Si pediste una impresión física (póster, lienzo), añade 3 días laborables adicionales para la fabricación y el envío.",
 trackOrder: "Seguir mi pedido",
 thanks: "¡Gracias por tu confianza! ",
 team: "El equipo Cartoonova",
 },
 de: {
 subject: "Bestellung bestätigt - Ihre Künstler legen los!",
 title: "BOOM! Alles klar!",
 orderConfirmed: (ref) =>`Ihre Bestellung #${ref} ist bestätigt`,
 summary: "Zusammenfassung",
 format: "Format",
 people: "Personen",
 animals: "Tiere",
 option: "Option",
 total: "Gesamt",
 artistsWorking: "Unsere Künstler machen sich an die Arbeit!",
 deliveryTime: "Die Zeichnung wird innerhalb von 2 Tagen fertiggestellt. Bei einem physischen Druck (Poster, Leinwand) kommen 3 Werktage für Herstellung und Versand hinzu.",
 trackOrder: "Bestellung verfolgen",
 thanks: "Vielen Dank für Ihr Vertrauen! ",
 team: "Das Cartoonova-Team",
 },
 it: {
 subject: "Ordine confermato - I tuoi artisti iniziano!",
 title: "BOOM! Tutto pronto!",
 orderConfirmed: (ref) =>`Il tuo ordine #${ref} è confermato`,
 summary: "Riepilogo",
 format: "Formato",
 people: "Persone",
 animals: "Animali",
 option: "Opzione",
 total: "Totale",
 artistsWorking: "I nostri artisti si mettono al lavoro!",
 deliveryTime: "Il disegno viene realizzato in 2 giorni. Se hai ordinato una stampa fisica (poster, tela), aggiungi 3 giorni lavorativi in più per la produzione e la spedizione.",
 trackOrder: "Segui il mio ordine",
 thanks: "Grazie per la tua fiducia! ",
 team: "Il team Cartoonova",
 },
};

// ─── Final image email (delivery) ─────────────────────────────────────
export const finalImageEmail: Record<Lang, {
 subject: string;
 title: string;
 greeting: (name: string | null) =>string;
 ready: (ref: string) =>string;
 download: string;
 feedback: string;
 thanks: string;
 team: string;
}>= {
 fr: {
 subject: "Votre illustration Cartoonova est prête!",
 title: "Votre illustration est prête!",
 greeting: (name) =>name? `Bonjour ${name},`: "Bonjour,",
 ready: (ref) =>`Votre commande <strong>#${ref}</strong>a été finalisée par nos artistes. Découvrez le résultat ci-dessous:`,
 download: "Télécharger mon illustration",
 feedback: "Si vous avez des retours ou besoin d'une modification, répondez simplement à cet email.",
 thanks: "Merci pour votre confiance! ",
 team: "L'équipe Cartoonova",
 },
 en: {
 subject: "Your Cartoonova illustration is ready!",
 title: "Your illustration is ready!",
 greeting: (name) =>name? `Hello ${name},`: "Hello,",
 ready: (ref) =>`Your order <strong>#${ref}</strong>has been completed by our artists. Check out the result below:`,
 download: "Download my illustration",
 feedback: "If you have any feedback or need a revision, simply reply to this email.",
 thanks: "Thank you for your trust! ",
 team: "The Cartoonova Team",
 },
 es: {
 subject: "¡Tu ilustración Cartoonova está lista!",
 title: "¡Tu ilustración está lista!",
 greeting: (name) =>name? `Hola ${name},`: "Hola,",
 ready: (ref) =>`Tu pedido <strong>#${ref}</strong>ha sido finalizado por nuestros artistas. Descubre el resultado a continuación:`,
 download: "Descargar mi ilustración",
 feedback: "Si tienes algún comentario o necesitas una modificación, simplemente responde a este email.",
 thanks: "¡Gracias por tu confianza! ",
 team: "El equipo Cartoonova",
 },
 de: {
 subject: "Ihre Cartoonova-Illustration ist fertig!",
 title: "Ihre Illustration ist fertig!",
 greeting: (name) =>name? `Hallo ${name},`: "Hallo,",
 ready: (ref) =>`Ihre Bestellung <strong>#${ref}</strong>wurde von unseren Künstlern fertiggestellt. Entdecken Sie das Ergebnis:`,
 download: "Meine Illustration herunterladen",
 feedback: "Wenn Sie Feedback haben oder eine Änderung benötigen, antworten Sie einfach auf diese E-Mail.",
 thanks: "Vielen Dank für Ihr Vertrauen! ",
 team: "Das Cartoonova-Team",
 },
 it: {
 subject: "La tua illustrazione Cartoonova è pronta!",
 title: "La tua illustrazione è pronta!",
 greeting: (name) =>name? `Ciao ${name},`: "Ciao,",
 ready: (ref) =>`Il tuo ordine <strong>#${ref}</strong>è stato completato dai nostri artisti. Scopri il risultato qui sotto:`,
 download: "Scarica la mia illustrazione",
 feedback: "Se hai dei commenti o hai bisogno di una modifica, rispondi semplicemente a questa email.",
 thanks: "Grazie per la tua fiducia! ",
 team: "Il team Cartoonova",
 },
};

// ─── Poster confirmation email (before printing/shipping) ────────────
export const posterConfirmationEmail: Record<Lang, {
 subject: string;
 title: string;
 greeting: (name: string | null) =>string;
 intro: (ref: string) =>string;
 attachmentNote: string;
 cta: string;
 reassurance: string;
 thanks: string;
 team: string;
}>= {
 fr: {
 subject: "Confirmez votre visuel avant impression",
 title: "Un dernier accord avant impression",
 greeting: (name) =>name? `Bonjour ${name},`: "Bonjour,",
 intro: (ref) =>`Votre poster de la commande <strong>#${ref}</strong>est prêt à partir en impression. Vous trouverez la photo finale ci-dessous et en pièce jointe de cet email.`,
 attachmentNote: "Le visuel final est joint à cet email.",
 cta: "Voir et valider mon visuel",
 reassurance: "Une fois votre confirmation reçue, nous lançons l'impression et l'expédition de votre poster.",
 thanks: "Merci pour votre confiance! ",
 team: "L'équipe Cartoonova",
 },
 en: {
 subject: "Confirm your artwork before printing",
 title: "One last check before printing",
 greeting: (name) =>name? `Hello ${name},`: "Hello,",
 intro: (ref) =>`Your poster for order <strong>#${ref}</strong>is ready to go to print. You'll find the final photo below and attached to this email.`,
 attachmentNote: "The final artwork is attached to this email.",
 cta: "View and confirm my artwork",
 reassurance: "Once we receive your confirmation, we'll start printing and shipping your poster.",
 thanks: "Thank you for your trust! ",
 team: "The Cartoonova Team",
 },
 es: {
 subject: "Confirma tu diseño antes de imprimir",
 title: "Una última confirmación antes de imprimir",
 greeting: (name) =>name? `Hola ${name},`: "Hola,",
 intro: (ref) =>`Tu póster del pedido <strong>#${ref}</strong>está listo para imprimirse. Encontrarás la foto final debajo y adjunta a este correo.`,
 attachmentNote: "El diseño final está adjunto a este correo.",
 cta: "Ver y confirmar mi diseño",
 reassurance: "En cuanto recibamos tu confirmación, empezaremos a imprimir y enviar tu póster.",
 thanks: "¡Gracias por tu confianza! ",
 team: "El equipo Cartoonova",
 },
 de: {
 subject: "Bestätigen Sie Ihr Motiv vor dem Druck",
 title: "Eine letzte Bestätigung vor dem Druck",
 greeting: (name) =>name? `Hallo ${name},`: "Hallo,",
 intro: (ref) =>`Ihr Poster zur Bestellung <strong>#${ref}</strong>ist druckfertig. Das finale Bild finden Sie unten und im Anhang dieser E-Mail.`,
 attachmentNote: "Das finale Motiv ist dieser E-Mail beigefügt.",
 cta: "Motiv ansehen und bestätigen",
 reassurance: "Sobald Ihre Bestätigung eingeht, starten wir den Druck und Versand Ihres Posters.",
 thanks: "Vielen Dank für Ihr Vertrauen! ",
 team: "Das Cartoonova-Team",
 },
 it: {
 subject: "Conferma la tua grafica prima della stampa",
 title: "Un'ultima conferma prima della stampa",
 greeting: (name) =>name? `Ciao ${name},`: "Ciao,",
 intro: (ref) =>`Il tuo poster dell'ordine <strong>#${ref}</strong>è pronto per la stampa. Trovi la foto finale qui sotto e in allegato a questa email.`,
 attachmentNote: "La grafica finale è allegata a questa email.",
 cta: "Visualizza e conferma la mia grafica",
 reassurance: "Non appena riceviamo la tua conferma, avviamo la stampa e la spedizione del tuo poster.",
 thanks: "Grazie per la tua fiducia! ",
 team: "Il team Cartoonova",
 },
};

// ─── Poster confirmation public page ──────────────────────────────────
export const posterConfirmationPage: Record<Lang, {
 pageTitle: string;
 heading: (ref: string) =>string;
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
 alreadyRespondedConfirmed: (date: string) =>string;
 alreadyRespondedChanges: (date: string) =>string;
 invalidTitle: string;
 invalidBody: string;
 sending: string;
}>= {
 fr: {
 pageTitle: "Confirmez votre poster — Cartoonova",
 heading: (ref) =>`Commande #${ref}`,
 description: "Merci de vérifier attentivement le visuel ci-dessous avant que nous lancions l'impression de votre poster.",
 confirmButton: "Je confirme, imprimez et envoyez",
 changesButton: "Je demande une modification",
 confirmedTitle: "Merci, c'est confirmé!",
 confirmedBody: "Votre poster part en impression puis en expédition. Vous recevrez un email dès son envoi.",
 changesPrompt: "Quelle modification souhaitez-vous?",
 changesPlaceholder: "Ex: le fond doit être bleu et non vert...",
 changesSubmit: "Envoyer ma demande",
 changesTitle: "Bien reçu!",
 changesBody: "Votre demande a été transmise à notre équipe. Nous ne lancerons pas l'impression avant votre accord.",
 alreadyRespondedConfirmed: (date) =>`Vous avez déjà confirmé ce visuel le ${date}.`,
 alreadyRespondedChanges: (date) =>`Vous avez déjà demandé une modification le ${date}. Vous pouvez changer d'avis ci-dessous.`,
 invalidTitle: "Lien invalide ou expiré",
 invalidBody: "Ce lien de confirmation n'est plus valide. Contactez-nous à info.cartoonova@gmail.com avec votre numéro de commande.",
 sending: "Envoi en cours...",
 },
 en: {
 pageTitle: "Confirm your poster — Cartoonova",
 heading: (ref) =>`Order #${ref}`,
 description: "Please review the artwork below carefully before we send your poster to print.",
 confirmButton: "I confirm, print and ship it",
 changesButton: "I'd like a change",
 confirmedTitle: "Thanks, you're all set!",
 confirmedBody: "Your poster is going to print and will ship soon. You'll get an email as soon as it's on its way.",
 changesPrompt: "What would you like changed?",
 changesPlaceholder: "E.g. the background should be blue, not green...",
 changesSubmit: "Send my request",
 changesTitle: "Got it!",
 changesBody: "Your request has been sent to our team. We won't start printing until you approve it.",
 alreadyRespondedConfirmed: (date) =>`You already confirmed this artwork on ${date}.`,
 alreadyRespondedChanges: (date) =>`You already requested a change on ${date}. You can change your mind below.`,
 invalidTitle: "Invalid or expired link",
 invalidBody: "This confirmation link is no longer valid. Contact us at info.cartoonova@gmail.com with your order number.",
 sending: "Sending...",
 },
 es: {
 pageTitle: "Confirma tu póster — Cartoonova",
 heading: (ref) =>`Pedido #${ref}`,
 description: "Revisa con atención el diseño de abajo antes de que enviemos tu póster a imprimir.",
 confirmButton: "Confirmo, imprímanlo y envíenlo",
 changesButton: "Quiero un cambio",
 confirmedTitle: "¡Gracias, todo listo!",
 confirmedBody: "Tu póster pasa a imprenta y se enviará pronto. Te avisaremos por email en cuanto salga.",
 changesPrompt: "¿Qué te gustaría cambiar?",
 changesPlaceholder: "Ej: el fondo debería ser azul, no verde...",
 changesSubmit: "Enviar mi solicitud",
 changesTitle: "¡Recibido!",
 changesBody: "Tu solicitud ha sido enviada a nuestro equipo. No imprimiremos hasta tu aprobación.",
 alreadyRespondedConfirmed: (date) =>`Ya confirmaste este diseño el ${date}.`,
 alreadyRespondedChanges: (date) =>`Ya pediste un cambio el ${date}. Puedes cambiar de opinión abajo.`,
 invalidTitle: "Enlace no válido o caducado",
 invalidBody: "Este enlace de confirmación ya no es válido. Contáctanos en info.cartoonova@gmail.com con tu número de pedido.",
 sending: "Enviando...",
 },
 de: {
 pageTitle: "Poster bestätigen — Cartoonova",
 heading: (ref) =>`Bestellung #${ref}`,
 description: "Bitte prüfen Sie das Motiv unten sorgfältig, bevor wir Ihr Poster in den Druck geben.",
 confirmButton: "Ich bestätige, drucken und versenden",
 changesButton: "Ich möchte eine Änderung",
 confirmedTitle: "Danke, alles bestätigt!",
 confirmedBody: "Ihr Poster geht in den Druck und wird bald versendet. Sie erhalten eine E-Mail, sobald es unterwegs ist.",
 changesPrompt: "Was möchten Sie geändert haben?",
 changesPlaceholder: "Z. B. der Hintergrund sollte blau statt grün sein...",
 changesSubmit: "Anfrage senden",
 changesTitle: "Verstanden!",
 changesBody: "Ihre Anfrage wurde an unser Team weitergeleitet. Wir starten den Druck erst nach Ihrer Freigabe.",
 alreadyRespondedConfirmed: (date) =>`Sie haben dieses Motiv bereits am ${date} bestätigt.`,
 alreadyRespondedChanges: (date) =>`Sie haben bereits am ${date} eine Änderung angefragt. Sie können Ihre Meinung unten ändern.`,
 invalidTitle: "Ungültiger oder abgelaufener Link",
 invalidBody: "Dieser Bestätigungslink ist nicht mehr gültig. Kontaktieren Sie uns unter info.cartoonova@gmail.com mit Ihrer Bestellnummer.",
 sending: "Wird gesendet...",
 },
 it: {
 pageTitle: "Conferma il tuo poster — Cartoonova",
 heading: (ref) =>`Ordine #${ref}`,
 description: "Controlla attentamente la grafica qui sotto prima che mandiamo il tuo poster in stampa.",
 confirmButton: "Confermo, stampatelo e speditelo",
 changesButton: "Vorrei una modifica",
 confirmedTitle: "Grazie, tutto confermato!",
 confirmedBody: "Il tuo poster va in stampa e verrà spedito a breve. Ti avviseremo via email non appena partirà.",
 changesPrompt: "Cosa vorresti modificare?",
 changesPlaceholder: "Es: lo sfondo dovrebbe essere blu, non verde...",
 changesSubmit: "Invia la mia richiesta",
 changesTitle: "Ricevuto!",
 changesBody: "La tua richiesta è stata inviata al nostro team. Non avvieremo la stampa senza la tua approvazione.",
 alreadyRespondedConfirmed: (date) =>`Hai già confermato questa grafica il ${date}.`,
 alreadyRespondedChanges: (date) =>`Hai già richiesto una modifica il ${date}. Puoi cambiare idea qui sotto.`,
 invalidTitle: "Link non valido o scaduto",
 invalidBody: "Questo link di conferma non è più valido. Contattaci a info.cartoonova@gmail.com con il numero del tuo ordine.",
 sending: "Invio in corso...",
 },
};

// ─── Review request email (sent a few days after delivery) ───────────
export const reviewRequestEmail: Record<Lang, {
 subject: string;
 title: string;
 greeting: (name: string | null) =>string;
 body: string;
 ask: string;
 cta: string;
 thanks: string;
 team: string;
}>= {
 fr: {
 subject: "Votre portrait vous plaît?",
 title: "Votre avis nous aide vraiment",
 greeting: (name) =>name? `Bonjour ${name},`: "Bonjour,",
 body: "Votre portrait est entre vos mains depuis quelques jours. On espère qu'il a fait son effet!",
 ask: "Nous sommes une jeune boutique: un mot honnête sur votre expérience — et, si vous le voulez bien, une photo du portrait chez vous — aide énormément les personnes qui hésitent. Vous n'avez qu'à répondre à cet email.",
 cta: "Répondre et donner mon avis",
 thanks: "Merci beaucoup ",
 team: "L'équipe Cartoonova",
 },
 en: {
 subject: "How do you like your portrait?",
 title: "Your feedback really helps",
 greeting: (name) =>name? `Hello ${name},`: "Hello,",
 body: "Your portrait has been with you for a few days now. We hope it landed well!",
 ask: "We're a young shop: an honest word about your experience — and, if you're up for it, a photo of the portrait at home — helps a lot of hesitant people decide. Just reply to this email.",
 cta: "Reply with my feedback",
 thanks: "Thank you so much ",
 team: "The Cartoonova Team",
 },
 es: {
 subject: "¿Qué te parece tu retrato?",
 title: "Tu opinión nos ayuda mucho",
 greeting: (name) =>name? `Hola ${name},`: "Hola,",
 body: "Hace unos días que tienes tu retrato. ¡Esperamos que haya causado buena impresión!",
 ask: "Somos una tienda joven: unas palabras honestas sobre tu experiencia — y, si te apetece, una foto del retrato en tu casa — ayudan muchísimo a quien duda. Solo tienes que responder a este email.",
 cta: "Responder y dar mi opinión",
 thanks: "Muchas gracias ",
 team: "El equipo Cartoonova",
 },
 de: {
 subject: "Wie gefällt Ihnen Ihr Portrait?",
 title: "Ihre Rückmeldung hilft uns wirklich",
 greeting: (name) =>name? `Hallo ${name},`: "Hallo,",
 body: "Ihr Portrait ist seit einigen Tagen bei Ihnen. Wir hoffen, es hat Eindruck gemacht!",
 ask: "Wir sind ein junger Shop: ein ehrliches Wort zu Ihrer Erfahrung — und, wenn Sie mögen, ein Foto des Portraits bei Ihnen zu Hause — hilft Unentschlossenen enorm. Antworten Sie einfach auf diese E-Mail.",
 cta: "Antworten und Feedback geben",
 thanks: "Vielen Dank ",
 team: "Das Cartoonova-Team",
 },
 it: {
 subject: "Ti piace il tuo ritratto?",
 title: "La tua opinione ci aiuta davvero",
 greeting: (name) =>name? `Ciao ${name},`: "Ciao,",
 body: "Il tuo ritratto è con te da qualche giorno. Speriamo abbia fatto colpo!",
 ask: "Siamo una bottega giovane: due parole sincere sulla tua esperienza — e, se ti va, una foto del ritratto a casa tua — aiutano molto chi è indeciso. Ti basta rispondere a questa email.",
 cta: "Rispondere e lasciare la mia opinione",
 thanks: "Grazie mille ",
 team: "Il team Cartoonova",
 },
};

// ─── Welcome sequence (3 emails after newsletter signup) ─────────────
export interface WelcomeStep {
 subject: string;
 title: string;
 paragraphs: string[];
 cta: string;
 ctaPath: string;
 unsubscribe: string;
 team: string;
}

export const welcomeSequence: Record<Lang, [WelcomeStep, WelcomeStep, WelcomeStep]>= {
 fr: [
 {
 subject: "Bienvenue chez Cartoonova",
 title: "Ravis de vous compter parmi nous",
 paragraphs: [
 "Cartoonova, c'est un atelier: vous envoyez une photo, un illustrateur la redessine à la main dans le style de votre choix — Simpson, One Piece, Dragon Ball, Ghibli, Rick &amp; Morty ou Disney.",
 "Le dessin est réalisé en 2 jours. Si vous choisissez une impression (poster ou toile), comptez 3 jours ouvrés de plus pour la fabrication et la livraison. La version numérique, elle, part par email.",
 "Vous recevrez deux autres messages de notre part: un sur le choix de la photo, un sur le style à choisir selon la personne. Rien d'autre, et jamais de spam.",
 ],
 cta: "Découvrir les styles",
 ctaPath: "/collections",
 unsubscribe: "Me désinscrire",
 team: "L'équipe Cartoonova",
 },
 {
 subject: "La photo qui donne le meilleur portrait",
 title: "Comment choisir votre photo",
 paragraphs: [
 "C'est la question qu'on nous pose le plus souvent, et c'est ce qui fait le plus de différence sur le résultat final.",
 "Ce qui marche: un visage net et bien éclairé, de face ou légèrement de trois quarts, sans lunettes de soleil ni casquette qui cache le regard. La lumière du jour près d'une fenêtre vaut mieux que n'importe quel flash.",
 "Ce qui complique le travail: les photos floues, très sombres, prises de loin, ou fortement filtrées. Pour un portrait de groupe, mieux vaut plusieurs photos individuelles nettes qu'une seule photo de groupe lointaine — l'illustrateur les réunit ensuite.",
 "Dans le doute, envoyez la photo: on vous dit franchement si elle convient avant de commencer.",
 ],
 cta: "Commander mon portrait",
 ctaPath: "/collections",
 unsubscribe: "Me désinscrire",
 team: "L'équipe Cartoonova",
 },
 {
 subject: "Quel style pour quelle personne?",
 title: "Choisir le bon style",
 paragraphs: [
 "Six styles, six effets très différents. Le bon choix dépend surtout de la personne à qui vous l'offrez.",
 "Simpson: le plus universel, celui qui fait rire tout le monde, idéal pour une famille ou un couple. One Piece: l'avis de recherche, parfait pour un ado ou un fan de manga. Dragon Ball: l'énergie, très apprécié en cadeau entre amis.",
 "Ghibli: le plus doux et le plus décoratif, celui qui s'accroche dans un salon. Rick &amp; Morty: l'humour décalé, pour quelqu'un qui n'aime pas les cadeaux sages. Disney: la version conte de fées, qui fonctionne très bien pour un enfant ou un mariage.",
 "Si vous hésitez encore, répondez à cet email en décrivant la personne: on vous oriente.",
 ],
 cta: "Voir les six styles",
 ctaPath: "/collections",
 unsubscribe: "Me désinscrire",
 team: "L'équipe Cartoonova",
 },
 ],
 en: [
 {
 subject: "Welcome to Cartoonova",
 title: "Glad to have you here",
 paragraphs: [
 "Cartoonova is a studio: you send a photo, an illustrator redraws it by hand in the style you pick — Simpsons, One Piece, Dragon Ball, Ghibli, Rick &amp; Morty or Disney.",
 "The artwork is done within 2 days. If you choose a print (poster or canvas), add 3 business days for production and delivery. The digital version is sent by email.",
 "You'll get two more emails from us: one about choosing your photo, one about picking the right style for the person. Nothing else, and never spam.",
 ],
 cta: "See the styles",
 ctaPath: "/collections",
 unsubscribe: "Unsubscribe",
 team: "The Cartoonova Team",
 },
 {
 subject: "The photo that makes the best portrait",
 title: "How to choose your photo",
 paragraphs: [
 "It's the question we get most often, and it's what makes the biggest difference to the final result.",
 "What works: a sharp, well-lit face, straight on or slightly at an angle, with no sunglasses or cap hiding the eyes. Daylight near a window beats any flash.",
 "What makes it harder: blurry, very dark, distant or heavily filtered photos. For a group portrait, several sharp individual photos beat one distant group shot — the illustrator brings them together afterwards.",
 "When in doubt, send the photo: we'll tell you honestly whether it works before starting.",
 ],
 cta: "Order my portrait",
 ctaPath: "/collections",
 unsubscribe: "Unsubscribe",
 team: "The Cartoonova Team",
 },
 {
 subject: "Which style for which person?",
 title: "Picking the right style",
 paragraphs: [
 "Six styles, six very different effects. The right pick mostly depends on who you're giving it to.",
 "Simpsons: the most universal, the one that makes everyone laugh, ideal for a family or a couple. One Piece: the wanted poster, perfect for a teenager or a manga fan. Dragon Ball: pure energy, a favourite between friends.",
 "Ghibli: the softest and most decorative, the one that ends up on a living room wall. Rick &amp; Morty: offbeat humour, for someone who doesn't like safe gifts. Disney: the fairy-tale version, which works beautifully for a child or a wedding.",
 "Still hesitating? Reply to this email describing the person and we'll point you somewhere.",
 ],
 cta: "See all six styles",
 ctaPath: "/collections",
 unsubscribe: "Unsubscribe",
 team: "The Cartoonova Team",
 },
 ],
 es: [
 {
 subject: "Bienvenido a Cartoonova",
 title: "Nos alegra tenerte aquí",
 paragraphs: [
 "Cartoonova es un taller: envías una foto y un ilustrador la vuelve a dibujar a mano en el estilo que elijas — Simpson, One Piece, Dragon Ball, Ghibli, Rick &amp; Morty o Disney.",
 "El dibujo se realiza en 2 días. Si eliges una impresión (póster o lienzo), añade 3 días hábiles para la fabricación y el envío. La versión digital se envía por email.",
 "Recibirás dos emails más: uno sobre cómo elegir la foto y otro sobre qué estilo escoger según la persona. Nada más, y nunca spam.",
 ],
 cta: "Descubrir los estilos",
 ctaPath: "/collections",
 unsubscribe: "Darme de baja",
 team: "El equipo Cartoonova",
 },
 {
 subject: "La foto que da el mejor retrato",
 title: "Cómo elegir tu foto",
 paragraphs: [
 "Es la pregunta que más nos hacen, y es lo que más influye en el resultado final.",
 "Lo que funciona: una cara nítida y bien iluminada, de frente o ligeramente de perfil, sin gafas de sol ni gorra que tape la mirada. La luz del día junto a una ventana supera a cualquier flash.",
 "Lo que complica el trabajo: fotos borrosas, muy oscuras, tomadas de lejos o con muchos filtros. Para un retrato de grupo, mejor varias fotos individuales nítidas que una foto de grupo lejana — el ilustrador las reúne después.",
 "Si tienes dudas, envía la foto: te diremos con franqueza si sirve antes de empezar.",
 ],
 cta: "Pedir mi retrato",
 ctaPath: "/collections",
 unsubscribe: "Darme de baja",
 team: "El equipo Cartoonova",
 },
 {
 subject: "¿Qué estilo para qué persona?",
 title: "Elegir el estilo adecuado",
 paragraphs: [
 "Seis estilos, seis efectos muy distintos. La elección depende sobre todo de a quién se lo regalas.",
 "Simpson: el más universal, el que hace reír a todos, ideal para una familia o una pareja. One Piece: el cartel de búsqueda, perfecto para un adolescente o un fan del manga. Dragon Ball: pura energía, muy apreciado entre amigos.",
 "Ghibli: el más suave y decorativo, el que acaba colgado en el salón. Rick &amp; Morty: humor gamberro, para quien no quiere un regalo prudente. Disney: la versión cuento de hadas, que funciona muy bien para un niño o una boda.",
 "¿Sigues dudando? Responde a este email describiendo a la persona y te orientamos.",
 ],
 cta: "Ver los seis estilos",
 ctaPath: "/collections",
 unsubscribe: "Darme de baja",
 team: "El equipo Cartoonova",
 },
 ],
 de: [
 {
 subject: "Willkommen bei Cartoonova",
 title: "Schön, dass Sie da sind",
 paragraphs: [
 "Cartoonova ist ein Atelier: Sie schicken ein Foto, ein Illustrator zeichnet es von Hand neu — im Stil Ihrer Wahl: Simpsons, One Piece, Dragon Ball, Ghibli, Rick &amp; Morty oder Disney.",
 "Die Zeichnung entsteht innerhalb von 2 Tagen. Bei einem Druck (Poster oder Leinwand) kommen 3 Werktage für Herstellung und Versand dazu. Die digitale Fassung kommt per E-Mail.",
 "Sie erhalten noch zwei E-Mails von uns: eine zur Wahl des Fotos, eine zur Wahl des passenden Stils. Mehr nicht, und niemals Spam.",
 ],
 cta: "Stile entdecken",
 ctaPath: "/collections",
 unsubscribe: "Abmelden",
 team: "Das Cartoonova-Team",
 },
 {
 subject: "Das Foto, aus dem das beste Portrait wird",
 title: "So wählen Sie Ihr Foto",
 paragraphs: [
 "Das ist die häufigste Frage — und der größte Hebel für das Endergebnis.",
 "Was funktioniert: ein scharfes, gut ausgeleuchtetes Gesicht, frontal oder leicht seitlich, ohne Sonnenbrille oder Mütze über den Augen. Tageslicht am Fenster schlägt jeden Blitz.",
 "Was die Arbeit erschwert: unscharfe, sehr dunkle, weit entfernte oder stark gefilterte Fotos. Für ein Gruppenportrait sind mehrere scharfe Einzelfotos besser als eine entfernte Gruppenaufnahme — der Illustrator fügt sie zusammen.",
 "Im Zweifel: schicken Sie das Foto. Wir sagen Ihnen ehrlich, ob es passt, bevor wir anfangen.",
 ],
 cta: "Portrait bestellen",
 ctaPath: "/collections",
 unsubscribe: "Abmelden",
 team: "Das Cartoonova-Team",
 },
 {
 subject: "Welcher Stil für wen?",
 title: "Den richtigen Stil wählen",
 paragraphs: [
 "Sechs Stile, sechs sehr unterschiedliche Wirkungen. Die Wahl hängt vor allem davon ab, wem Sie es schenken.",
 "Simpsons: der universellste, bringt alle zum Lachen, ideal für Familie oder Paar. One Piece: der Steckbrief, perfekt für Jugendliche und Manga-Fans. Dragon Ball: pure Energie, beliebt unter Freunden.",
 "Ghibli: der sanfteste und dekorativste, der im Wohnzimmer landet. Rick &amp; Morty: schräger Humor, für alle, die keine braven Geschenke mögen. Disney: die Märchenfassung, wunderbar für Kinder oder eine Hochzeit.",
 "Noch unschlüssig? Antworten Sie auf diese E-Mail und beschreiben Sie die Person — wir helfen weiter.",
 ],
 cta: "Alle sechs Stile ansehen",
 ctaPath: "/collections",
 unsubscribe: "Abmelden",
 team: "Das Cartoonova-Team",
 },
 ],
 it: [
 {
 subject: "Benvenuto in Cartoonova",
 title: "Felici di averti qui",
 paragraphs: [
 "Cartoonova è un atelier: mandi una foto e un illustratore la ridisegna a mano nello stile che scegli — Simpson, One Piece, Dragon Ball, Ghibli, Rick &amp; Morty o Disney.",
 "Il disegno è realizzato in 2 giorni. Se scegli una stampa (poster o tela), aggiungi 3 giorni lavorativi per produzione e consegna. La versione digitale arriva per email.",
 "Riceverai altre due email da noi: una su come scegliere la foto, una su quale stile scegliere in base alla persona. Nient'altro, e mai spam.",
 ],
 cta: "Scoprire gli stili",
 ctaPath: "/collections",
 unsubscribe: "Disiscrivermi",
 team: "Il team Cartoonova",
 },
 {
 subject: "La foto da cui nasce il ritratto migliore",
 title: "Come scegliere la tua foto",
 paragraphs: [
 "È la domanda che ci fanno più spesso, ed è ciò che incide di più sul risultato finale.",
 "Cosa funziona: un viso nitido e ben illuminato, frontale o leggermente di tre quarti, senza occhiali da sole o cappellino che coprano lo sguardo. La luce del giorno vicino a una finestra batte qualsiasi flash.",
 "Cosa complica il lavoro: foto sfocate, molto scure, scattate da lontano o molto filtrate. Per un ritratto di gruppo, meglio più foto individuali nitide che una sola foto di gruppo lontana — l'illustratore le unisce dopo.",
 "Nel dubbio, mandaci la foto: ti diciamo con sincerità se va bene prima di iniziare.",
 ],
 cta: "Ordinare il mio ritratto",
 ctaPath: "/collections",
 unsubscribe: "Disiscrivermi",
 team: "Il team Cartoonova",
 },
 {
 subject: "Quale stile per quale persona?",
 title: "Scegliere lo stile giusto",
 paragraphs: [
 "Sei stili, sei effetti molto diversi. La scelta dipende soprattutto da chi lo riceve.",
 "Simpson: il più universale, quello che fa ridere tutti, ideale per una famiglia o una coppia. One Piece: il manifesto da ricercato, perfetto per un adolescente o un fan dei manga. Dragon Ball: pura energia, molto apprezzato tra amici.",
 "Ghibli: il più delicato e decorativo, quello che finisce appeso in salotto. Rick &amp; Morty: umorismo irriverente, per chi non ama i regali prudenti. Disney: la versione fiaba, perfetta per un bambino o un matrimonio.",
 "Ancora indeciso? Rispondi a questa email descrivendo la persona e ti diamo una dritta.",
 ],
 cta: "Vedere i sei stili",
 ctaPath: "/collections",
 unsubscribe: "Disiscrivermi",
 team: "Il team Cartoonova",
 },
 ],
};

// ─── Re-order email (sent months after delivery) ─────────────────────
export const reorderEmail: Record<Lang, {
 subject: string;
 title: string;
 greeting: (name: string | null) =>string;
 body: string;
 cta: string;
 unsubscribe: string;
 thanks: string;
 team: string;
}>= {
 fr: {
 subject: "Une autre idée cadeau signée Cartoonova?",
 title: "Un autre portrait, un autre style",
 greeting: (name) =>name? `Bonjour ${name},`: "Bonjour,",
 body: "Un anniversaire, un mariage, un départ qui arrive? Nos autres styles — Simpson, One Piece, Dragon Ball, Ghibli, Rick & Morty, Disney — font le même effet avec une toute autre ambiance.",
 cta: "Voir les styles",
 unsubscribe: "Ne plus recevoir ce type d'email",
 thanks: "À très vite ",
 team: "L'équipe Cartoonova",
 },
 en: {
 subject: "Another gift idea from Cartoonova?",
 title: "Another portrait, another style",
 greeting: (name) =>name? `Hello ${name},`: "Hello,",
 body: "A birthday, a wedding, a farewell coming up? Our other styles — Simpsons, One Piece, Dragon Ball, Ghibli, Rick & Morty, Disney — land just as well with a completely different mood.",
 cta: "Browse the styles",
 unsubscribe: "Stop receiving these emails",
 thanks: "See you soon ",
 team: "The Cartoonova Team",
 },
 es: {
 subject: "¿Otra idea de regalo de Cartoonova?",
 title: "Otro retrato, otro estilo",
 greeting: (name) =>name? `Hola ${name},`: "Hola,",
 body: "¿Un cumpleaños, una boda, una despedida a la vista? Nuestros otros estilos — Simpson, One Piece, Dragon Ball, Ghibli, Rick & Morty, Disney — funcionan igual de bien con un ambiente totalmente distinto.",
 cta: "Ver los estilos",
 unsubscribe: "Dejar de recibir estos emails",
 thanks: "Hasta pronto ",
 team: "El equipo Cartoonova",
 },
 de: {
 subject: "Noch eine Geschenkidee von Cartoonova?",
 title: "Ein weiteres Portrait, ein anderer Stil",
 greeting: (name) =>name? `Hallo ${name},`: "Hallo,",
 body: "Ein Geburtstag, eine Hochzeit, ein Abschied steht an? Unsere anderen Stile — Simpsons, One Piece, Dragon Ball, Ghibli, Rick & Morty, Disney — wirken genauso gut, nur mit ganz anderer Stimmung.",
 cta: "Stile ansehen",
 unsubscribe: "Diese E-Mails abbestellen",
 thanks: "Bis bald ",
 team: "Das Cartoonova-Team",
 },
 it: {
 subject: "Un'altra idea regalo firmata Cartoonova?",
 title: "Un altro ritratto, un altro stile",
 greeting: (name) =>name? `Ciao ${name},`: "Ciao,",
 body: "Un compleanno, un matrimonio, un saluto in arrivo? Gli altri nostri stili — Simpson, One Piece, Dragon Ball, Ghibli, Rick & Morty, Disney — fanno lo stesso effetto con un'atmosfera del tutto diversa.",
 cta: "Vedere gli stili",
 unsubscribe: "Non ricevere più queste email",
 thanks: "A presto ",
 team: "Il team Cartoonova",
 },
};

/* ─── Page de suivi de commande ───────────────────────────────────────
   Le client n'avait aucun endroit ou verifier l'avancement : son seul repere
   etait l'e-mail de confirmation, et chaque « ou en est ma commande ? »
   devenait un echange avec le support. */

export type EtapeSuivi = "recue" | "dessin" | "apercu" | "envoyee";

export const orderTrackingPage: Record<Lang, {
  pageTitle: string;
  heading: (ref: string) => string;
  passedOn: (date: string) => string;
  summary: string;
  format: string;
  people: string;
  animals: string;
  option: string;
  total: string;
  photos: (n: number) => string;
  giftTitle: string;
  giftRecipient: string;
  giftDeliverAfter: string;
  giftMessage: string;
  steps: Record<EtapeSuivi, { title: string; body: string }>;
  finalTitle: string;
  finalBody: string;
  helpTitle: string;
  helpBody: string;
  invalidTitle: string;
  invalidBody: string;
}> = {
  fr: {
    pageTitle: "Suivi de commande — Cartoonova",
    heading: (ref) => `Commande #${ref}`,
    passedOn: (date) => `Passée le ${date}`,
    summary: "Votre commande",
    format: "Cadrage",
    people: "Personnes",
    animals: "Animaux",
    option: "Support",
    total: "Total payé",
    photos: (n) => (n > 1 ? `${n} photos bien reçues` : `${n} photo bien reçue`),
    giftTitle: "C’est un cadeau",
    giftRecipient: "Envoi à",
    giftDeliverAfter: "Pas avant le",
    giftMessage: "Votre message",
    steps: {
      recue: { title: "Commande reçue", body: "Nous avons votre paiement et vos photos." },
      dessin: { title: "Dessin en cours", body: "Un illustrateur travaille sur votre portrait. Comptez 2 jours." },
      apercu: { title: "Aperçu envoyé", body: "Vérifiez votre boîte mail : vous pouvez valider ou demander une retouche." },
      envoyee: { title: "Portrait envoyé", body: "Le fichier haute définition est parti par e-mail." },
    },
    finalTitle: "Votre portrait",
    finalBody: "Le voici tel qu’il vous a été envoyé.",
    helpTitle: "Une question ?",
    helpBody: "Répondez simplement à l’e-mail de confirmation, ou écrivez-nous à support@cartoonova.com en indiquant votre numéro de commande.",
    invalidTitle: "Lien invalide ou expiré",
    invalidBody: "Ce lien de suivi n’est plus valide. Écrivez-nous à support@cartoonova.com avec votre numéro de commande.",
  },
  en: {
    pageTitle: "Order tracking — Cartoonova",
    heading: (ref) => `Order #${ref}`,
    passedOn: (date) => `Placed on ${date}`,
    summary: "Your order",
    format: "Framing",
    people: "People",
    animals: "Pets",
    option: "Format",
    total: "Total paid",
    photos: (n) => (n > 1 ? `${n} photos received` : `${n} photo received`),
    giftTitle: "This is a gift",
    giftRecipient: "Send to",
    giftDeliverAfter: "Not before",
    giftMessage: "Your message",
    steps: {
      recue: { title: "Order received", body: "We have your payment and your photos." },
      dessin: { title: "Being drawn", body: "An illustrator is working on your portrait. Around 2 days." },
      apercu: { title: "Preview sent", body: "Check your inbox: you can approve it or ask for a change." },
      envoyee: { title: "Portrait sent", body: "The high-resolution file has been emailed to you." },
    },
    finalTitle: "Your portrait",
    finalBody: "Here it is, exactly as it was sent to you.",
    helpTitle: "A question?",
    helpBody: "Just reply to your confirmation email, or write to support@cartoonova.com quoting your order number.",
    invalidTitle: "Invalid or expired link",
    invalidBody: "This tracking link is no longer valid. Write to support@cartoonova.com with your order number.",
  },
  es: {
    pageTitle: "Seguimiento del pedido — Cartoonova",
    heading: (ref) => `Pedido n.º ${ref}`,
    passedOn: (date) => `Realizado el ${date}`,
    summary: "Tu pedido",
    format: "Encuadre",
    people: "Personas",
    animals: "Mascotas",
    option: "Formato",
    total: "Total pagado",
    photos: (n) => (n > 1 ? `${n} fotos recibidas` : `${n} foto recibida`),
    giftTitle: "Es un regalo",
    giftRecipient: "Enviar a",
    giftDeliverAfter: "No antes del",
    giftMessage: "Tu mensaje",
    steps: {
      recue: { title: "Pedido recibido", body: "Tenemos tu pago y tus fotos." },
      dessin: { title: "En proceso de dibujo", body: "Un ilustrador está trabajando en tu retrato. Unos 2 días." },
      apercu: { title: "Vista previa enviada", body: "Revisa tu correo: puedes validarla o pedir un cambio." },
      envoyee: { title: "Retrato enviado", body: "El archivo en alta definición ha salido por correo." },
    },
    finalTitle: "Tu retrato",
    finalBody: "Aquí está, tal como te lo enviamos.",
    helpTitle: "¿Alguna duda?",
    helpBody: "Responde al correo de confirmación o escríbenos a support@cartoonova.com indicando tu número de pedido.",
    invalidTitle: "Enlace no válido o caducado",
    invalidBody: "Este enlace de seguimiento ya no es válido. Escríbenos a support@cartoonova.com con tu número de pedido.",
  },
  de: {
    pageTitle: "Bestellverfolgung — Cartoonova",
    heading: (ref) => `Bestellung #${ref}`,
    passedOn: (date) => `Aufgegeben am ${date}`,
    summary: "Ihre Bestellung",
    format: "Bildausschnitt",
    people: "Personen",
    animals: "Tiere",
    option: "Format",
    total: "Bezahlt",
    photos: (n) => (n > 1 ? `${n} Fotos erhalten` : `${n} Foto erhalten`),
    giftTitle: "Das ist ein Geschenk",
    giftRecipient: "Senden an",
    giftDeliverAfter: "Nicht vor dem",
    giftMessage: "Ihre Nachricht",
    steps: {
      recue: { title: "Bestellung eingegangen", body: "Zahlung und Fotos liegen uns vor." },
      dessin: { title: "Wird gezeichnet", body: "Ein Illustrator arbeitet an Ihrem Portrait. Etwa 2 Tage." },
      apercu: { title: "Vorschau verschickt", body: "Prüfen Sie Ihr Postfach: freigeben oder Änderung anfragen." },
      envoyee: { title: "Portrait verschickt", body: "Die hochauflösende Datei ist per E-Mail unterwegs." },
    },
    finalTitle: "Ihr Portrait",
    finalBody: "Hier ist es, genau so wie versendet.",
    helpTitle: "Eine Frage?",
    helpBody: "Antworten Sie einfach auf die Bestellbestätigung oder schreiben Sie an support@cartoonova.com mit Ihrer Bestellnummer.",
    invalidTitle: "Ungültiger oder abgelaufener Link",
    invalidBody: "Dieser Link ist nicht mehr gültig. Schreiben Sie an support@cartoonova.com mit Ihrer Bestellnummer.",
  },
  it: {
    pageTitle: "Stato dell’ordine — Cartoonova",
    heading: (ref) => `Ordine #${ref}`,
    passedOn: (date) => `Effettuato il ${date}`,
    summary: "Il tuo ordine",
    format: "Inquadratura",
    people: "Persone",
    animals: "Animali",
    option: "Formato",
    total: "Totale pagato",
    photos: (n) => (n > 1 ? `${n} foto ricevute` : `${n} foto ricevuta`),
    giftTitle: "È un regalo",
    giftRecipient: "Invia a",
    giftDeliverAfter: "Non prima del",
    giftMessage: "Il tuo messaggio",
    steps: {
      recue: { title: "Ordine ricevuto", body: "Abbiamo il pagamento e le tue foto." },
      dessin: { title: "In disegno", body: "Un illustratore sta lavorando al tuo ritratto. Circa 2 giorni." },
      apercu: { title: "Anteprima inviata", body: "Controlla la posta: puoi approvarla o chiedere una modifica." },
      envoyee: { title: "Ritratto inviato", body: "Il file ad alta definizione è partito via e-mail." },
    },
    finalTitle: "Il tuo ritratto",
    finalBody: "Eccolo, esattamente come te l’abbiamo inviato.",
    helpTitle: "Una domanda?",
    helpBody: "Rispondi alla mail di conferma o scrivici a support@cartoonova.com indicando il numero d’ordine.",
    invalidTitle: "Link non valido o scaduto",
    invalidBody: "Questo link non è più valido. Scrivici a support@cartoonova.com con il numero d’ordine.",
  },
};

/* ─── Relance des commandes abandonnées ───────────────────────────────
   Un client qui a saisi son e-mail puis n'a pas confirmé le paiement n'était
   jamais recontacté : le panier partait sans un mot. Ton volontairement sobre —
   on rappelle que les photos sont conservées, on ne fait pas pression. */

export const abandonedCartEmail: Record<Lang, {
  subject: string;
  title: string;
  greeting: (name: string | null) => string;
  body: string;
  kept: string;
  cta: string;
  help: string;
  unsubscribe: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: "Votre portrait vous attend",
    title: "Vous y étiez presque",
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    body: "Vous avez commencé une commande de portrait, mais le paiement n’est jamais arrivé à son terme. Aucun souci — rien n’est perdu.",
    kept: "Vos photos sont bien conservées : il ne reste qu’à finaliser pour que l’un de nos illustrateurs s’y mette.",
    cta: "Terminer ma commande",
    help: "Un doute, une question sur les options ? Répondez simplement à cet e-mail.",
    unsubscribe: "Ne plus recevoir ce type d’e-mail",
    thanks: "À très vite,",
    team: "L’équipe Cartoonova",
  },
  en: {
    subject: "Your portrait is waiting",
    title: "You were almost there",
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    body: "You started a portrait order but the payment never went through. No problem — nothing is lost.",
    kept: "Your photos are safely stored: just finish the order and one of our illustrators will get started.",
    cta: "Finish my order",
    help: "Unsure about the options? Just reply to this email.",
    unsubscribe: "Stop receiving these emails",
    thanks: "See you soon,",
    team: "The Cartoonova team",
  },
  es: {
    subject: "Tu retrato te está esperando",
    title: "Casi lo tenías",
    greeting: (name) => (name ? `Hola ${name}:` : "Hola:"),
    body: "Empezaste un pedido de retrato, pero el pago no llegó a completarse. Tranquilo, no se ha perdido nada.",
    kept: "Tus fotos están guardadas: solo falta finalizar para que uno de nuestros ilustradores se ponga manos a la obra.",
    cta: "Terminar mi pedido",
    help: "¿Dudas con las opciones? Responde a este correo.",
    unsubscribe: "Dejar de recibir estos correos",
    thanks: "Hasta pronto,",
    team: "El equipo de Cartoonova",
  },
  de: {
    subject: "Ihr Portrait wartet auf Sie",
    title: "Fast geschafft",
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    body: "Sie haben eine Portrait-Bestellung begonnen, die Zahlung wurde aber nie abgeschlossen. Kein Problem — nichts ist verloren.",
    kept: "Ihre Fotos sind gespeichert: Sie müssen die Bestellung nur abschließen, dann legt einer unserer Illustratoren los.",
    cta: "Bestellung abschließen",
    help: "Fragen zu den Optionen? Antworten Sie einfach auf diese E-Mail.",
    unsubscribe: "Keine solchen E-Mails mehr erhalten",
    thanks: "Bis bald,",
    team: "Ihr Cartoonova-Team",
  },
  it: {
    subject: "Il tuo ritratto ti aspetta",
    title: "Ci eri quasi",
    greeting: (name) => (name ? `Ciao ${name},` : "Ciao,"),
    body: "Hai iniziato un ordine ma il pagamento non è mai andato a buon fine. Nessun problema — non hai perso nulla.",
    kept: "Le tue foto sono al sicuro: basta completare l’ordine e uno dei nostri illustratori si mette all’opera.",
    cta: "Completa l’ordine",
    help: "Dubbi sulle opzioni? Rispondi pure a questa e-mail.",
    unsubscribe: "Non ricevere più queste e-mail",
    thanks: "A presto,",
    team: "Il team Cartoonova",
  },
};
