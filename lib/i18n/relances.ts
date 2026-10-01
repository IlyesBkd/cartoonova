import type { Lang } from "@/lib/email-i18n";

/**
 * Textes des relances (caisse abandonnee, poster pour les clients numeriques)
 * et du parrainage.
 *
 * Dans un fichier a part plutot que dans lib/email-i18n.ts : ce dernier
 * depasse trois mille lignes et il est importe par des composants clients.
 * Ce fichier n'importe qu'un type, donc il ne tire rien dans le bundle.
 *
 * Tutoiement en francais, comme la page des cadeaux offerts et le reste du
 * parcours post-achat : ces e-mails prolongent une conversation deja engagee.
 */

/* ─── Relance de la caisse abandonnee ─────────────────────────────────────
   Pas de `kept` ici, contrairement a `abandonedCartEmail` : a l'etape de la
   caisse ou l'e-mail est saisi, aucune photo n'est encore enregistree. Dire
   « tes photos sont conservees » serait faux. */

export const relanceCaisseEmail: Record<Lang, {
  subject: string;
  title: string;
  greeting: string;
  body: string;
  reassure: string;
  cta: string;
  help: string;
  unsubscribe: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: "Ton portrait t'attend toujours",
    title: "Tu y étais presque",
    greeting: "Bonjour,",
    body: "Tu as commencé à commander ton portrait cartoon sans aller jusqu'au bout. Ton univers t'attend : il ne reste qu'à reprendre là où tu t'étais arrêté.",
    reassure: "Rien n'est débité tant que le paiement n'est pas validé, et tes photos peuvent être envoyées après la commande.",
    cta: "Reprendre ma commande",
    help: "Une question sur les options, les délais ou le style ? Réponds simplement à cet e-mail.",
    unsubscribe: "Ne plus recevoir ce type d'e-mail",
    thanks: "À très vite,",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: "Your portrait is still waiting",
    title: "You were almost there",
    greeting: "Hi,",
    body: "You started ordering your cartoon portrait but didn't quite finish. Your style is still waiting: just pick up where you left off.",
    reassure: "Nothing is charged until the payment is confirmed, and you can send your photos after ordering.",
    cta: "Resume my order",
    help: "A question about options, timing or style? Just reply to this email.",
    unsubscribe: "Stop receiving these emails",
    thanks: "See you soon,",
    team: "The Cartoonova team",
  },
  es: {
    subject: "Tu retrato todavía te espera",
    title: "Casi lo tenías",
    greeting: "Hola:",
    body: "Empezaste a pedir tu retrato cartoon pero no llegaste a terminar. Tu estilo te sigue esperando: solo tienes que retomarlo donde lo dejaste.",
    reassure: "No se cobra nada hasta que se confirma el pago, y puedes enviar tus fotos después de hacer el pedido.",
    cta: "Retomar mi pedido",
    help: "¿Alguna duda sobre las opciones, los plazos o el estilo? Responde simplemente a este correo.",
    unsubscribe: "No recibir más este tipo de correos",
    thanks: "¡Hasta pronto!",
    team: "El equipo de Cartoonova",
  },
  de: {
    subject: "Dein Porträt wartet noch auf dich",
    title: "Du warst fast fertig",
    greeting: "Hallo,",
    body: "Du hast mit der Bestellung deines Cartoon-Porträts begonnen, sie aber nicht abgeschlossen. Dein Stil wartet noch: Mach einfach dort weiter, wo du aufgehört hast.",
    reassure: "Es wird nichts abgebucht, bevor die Zahlung bestätigt ist, und deine Fotos kannst du auch nach der Bestellung schicken.",
    cta: "Bestellung fortsetzen",
    help: "Eine Frage zu Optionen, Lieferzeit oder Stil? Antworte einfach auf diese E-Mail.",
    unsubscribe: "Diese E-Mails nicht mehr erhalten",
    thanks: "Bis bald,",
    team: "Dein Cartoonova-Team",
  },
  it: {
    subject: "Il tuo ritratto ti aspetta ancora",
    title: "Ci eri quasi",
    greeting: "Ciao,",
    body: "Hai iniziato a ordinare il tuo ritratto cartoon senza arrivare alla fine. Il tuo stile ti aspetta: riprendi semplicemente da dove ti eri fermato.",
    reassure: "Non viene addebitato nulla finché il pagamento non è confermato, e puoi inviare le tue foto dopo l'ordine.",
    cta: "Riprendi il mio ordine",
    help: "Una domanda su opzioni, tempi o stile? Rispondi semplicemente a questa email.",
    unsubscribe: "Non ricevere più questo tipo di email",
    thanks: "A presto,",
    team: "Il team Cartoonova",
  },
  nl: {
    subject: "Je portret wacht nog op je",
    title: "Je was er bijna",
    greeting: "Hoi,",
    body: "Je bent begonnen met het bestellen van je cartoonportret, maar hebt het niet afgerond. Je stijl wacht nog op je: ga gewoon verder waar je gebleven was.",
    reassure: "Er wordt niets afgeschreven zolang de betaling niet is bevestigd, en je foto's kun je ook na de bestelling sturen.",
    cta: "Mijn bestelling hervatten",
    help: "Een vraag over de opties, de levertijd of de stijl? Beantwoord gewoon deze e-mail.",
    unsubscribe: "Deze e-mails niet meer ontvangen",
    thanks: "Tot snel,",
    team: "Het Cartoonova-team",
  },
  pl: {
    subject: "Twój portret wciąż na Ciebie czeka",
    title: "Prawie się udało",
    greeting: "Cześć,",
    body: "Zacząłeś zamawiać swój portret w stylu cartoon, ale nie dokończyłeś. Twój styl wciąż czeka: wystarczy wrócić tam, gdzie skończyłeś.",
    reassure: "Nic nie zostanie pobrane, dopóki płatność nie zostanie potwierdzona, a zdjęcia możesz wysłać po złożeniu zamówienia.",
    cta: "Wróć do zamówienia",
    help: "Masz pytanie o opcje, terminy lub styl? Po prostu odpowiedz na tego e-maila.",
    unsubscribe: "Nie chcę otrzymywać takich e-maili",
    thanks: "Do zobaczenia,",
    team: "Zespół Cartoonova",
  },
  sv: {
    subject: "Ditt porträtt väntar fortfarande",
    title: "Du var nästan klar",
    greeting: "Hej,",
    body: "Du började beställa ditt cartoonporträtt men slutförde det inte. Din stil väntar fortfarande: fortsätt bara där du slutade.",
    reassure: "Inget dras förrän betalningen är bekräftad, och du kan skicka dina foton efter beställningen.",
    cta: "Fortsätt min beställning",
    help: "En fråga om alternativ, leveranstid eller stil? Svara bara på det här mejlet.",
    unsubscribe: "Sluta ta emot den här typen av mejl",
    thanks: "Vi ses snart,",
    team: "Cartoonova-teamet",
  },
  da: {
    subject: "Dit portræt venter stadig",
    title: "Du var der næsten",
    greeting: "Hej,",
    body: "Du begyndte at bestille dit cartoonportræt, men gjorde det ikke færdigt. Din stil venter stadig: fortsæt bare, hvor du slap.",
    reassure: "Der trækkes intet, før betalingen er bekræftet, og du kan sende dine billeder efter bestillingen.",
    cta: "Fortsæt min bestilling",
    help: "Et spørgsmål om muligheder, levering eller stil? Svar bare på denne e-mail.",
    unsubscribe: "Modtag ikke længere denne type e-mails",
    thanks: "Vi ses snart,",
    team: "Cartoonova-teamet",
  },
  pt: {
    subject: "O teu retrato ainda está à tua espera",
    title: "Estavas quase lá",
    greeting: "Olá,",
    body: "Começaste a encomendar o teu retrato cartoon, mas não chegaste ao fim. O teu estilo continua à tua espera: basta retomar onde paraste.",
    reassure: "Nada é cobrado enquanto o pagamento não for confirmado, e podes enviar as tuas fotos depois da encomenda.",
    cta: "Retomar a minha encomenda",
    help: "Uma dúvida sobre as opções, os prazos ou o estilo? Responde simplesmente a este e-mail.",
    unsubscribe: "Deixar de receber este tipo de e-mail",
    thanks: "Até breve,",
    team: "A equipa Cartoonova",
  },
};

/* ─── Poster pour les clients du fichier numerique ────────────────────────
   Le prix annonce est celui du TIRAGE (`posterSimple`), pas d'un nouveau
   portrait : l'illustration existe deja. La fiche produit, elle, facture un
   portrait complet — d'ou la commande par simple reponse a l'e-mail, et un
   bouton qui sert a voir le rendu plutot qu'a payer. */

export const upsellPosterEmail: Record<Lang, {
  subject: (taille: string) => string;
  title: string;
  greeting: (name: string | null) => string;
  body: (taille: string) => string;
  price: (valeur: string) => string;
  reply: string;
  cta: string;
  unsubscribe: string;
  thanks: string;
  team: string;
}> = {
  fr: {
    subject: (t) => `Ton portrait en poster ${t}`,
    title: "Et si ton portrait passait au mur ?",
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (t) => `Ton portrait numérique te plaît ? On peut aussi l'imprimer en poster ${t} sur papier mat, livré chez toi.`,
    price: (v) => `Le tirage de ton portrait coûte <strong>${v}</strong> : on reprend l'illustration que tu as déjà, rien à redessiner.`,
    reply: "Pour le commander, réponds simplement à cet e-mail : on t'envoie le lien de paiement.",
    cta: "Voir le rendu en poster",
    unsubscribe: "Ne plus recevoir ce type d'e-mail",
    thanks: "À très vite,",
    team: "L'équipe Cartoonova",
  },
  en: {
    subject: (t) => `Your portrait as a ${t} poster`,
    title: "Ready to put your portrait on the wall?",
    greeting: (n) => (n ? `Hi ${n},` : "Hi,"),
    body: (t) => `Love your digital portrait? We can also print it as a ${t} poster on matte paper, delivered to your door.`,
    price: (v) => `The print of your portrait costs <strong>${v}</strong>: we use the illustration you already have, nothing to redraw.`,
    reply: "To order it, just reply to this email and we'll send you the payment link.",
    cta: "See it as a poster",
    unsubscribe: "Stop receiving these emails",
    thanks: "See you soon,",
    team: "The Cartoonova team",
  },
  es: {
    subject: (t) => `Tu retrato en póster ${t}`,
    title: "¿Y si tu retrato pasara a la pared?",
    greeting: (n) => (n ? `Hola ${n}:` : "Hola:"),
    body: (t) => `¿Te gusta tu retrato digital? También podemos imprimirlo en un póster de ${t} en papel mate, enviado a tu casa.`,
    price: (v) => `La impresión de tu retrato cuesta <strong>${v}</strong>: usamos la ilustración que ya tienes, no hay que redibujar nada.`,
    reply: "Para pedirlo, responde simplemente a este correo y te enviaremos el enlace de pago.",
    cta: "Ver cómo queda en póster",
    unsubscribe: "No recibir más este tipo de correos",
    thanks: "¡Hasta pronto!",
    team: "El equipo de Cartoonova",
  },
  de: {
    subject: (t) => `Dein Porträt als Poster ${t}`,
    title: "Wie wäre dein Porträt an der Wand?",
    greeting: (n) => (n ? `Hallo ${n},` : "Hallo,"),
    body: (t) => `Gefällt dir dein digitales Porträt? Wir können es auch als Poster ${t} auf mattem Papier drucken und zu dir nach Hause liefern.`,
    price: (v) => `Der Druck deines Porträts kostet <strong>${v}</strong>: Wir verwenden die Illustration, die du schon hast, es muss nichts neu gezeichnet werden.`,
    reply: "Zum Bestellen antworte einfach auf diese E-Mail, und wir schicken dir den Zahlungslink.",
    cta: "Als Poster ansehen",
    unsubscribe: "Diese E-Mails nicht mehr erhalten",
    thanks: "Bis bald,",
    team: "Dein Cartoonova-Team",
  },
  it: {
    subject: (t) => `Il tuo ritratto in poster ${t}`,
    title: "E se il tuo ritratto finisse sul muro?",
    greeting: (n) => (n ? `Ciao ${n},` : "Ciao,"),
    body: (t) => `Ti piace il tuo ritratto digitale? Possiamo anche stamparlo come poster ${t} su carta opaca, consegnato a casa tua.`,
    price: (v) => `La stampa del tuo ritratto costa <strong>${v}</strong>: usiamo l'illustrazione che hai già, niente da ridisegnare.`,
    reply: "Per ordinarlo, rispondi semplicemente a questa email: ti invieremo il link di pagamento.",
    cta: "Guarda come viene in poster",
    unsubscribe: "Non ricevere più questo tipo di email",
    thanks: "A presto,",
    team: "Il team Cartoonova",
  },
  nl: {
    subject: (t) => `Je portret als poster van ${t}`,
    title: "Zie je je portret al aan de muur?",
    greeting: (n) => (n ? `Hoi ${n},` : "Hoi,"),
    body: (t) => `Blij met je digitale portret? We kunnen het ook afdrukken als poster van ${t} op mat papier, bij je thuis geleverd.`,
    price: (v) => `De afdruk van je portret kost <strong>${v}</strong>: we gebruiken de illustratie die je al hebt, er hoeft niets opnieuw getekend te worden.`,
    reply: "Om te bestellen beantwoord je gewoon deze e-mail; we sturen je dan de betaallink.",
    cta: "Bekijk het als poster",
    unsubscribe: "Deze e-mails niet meer ontvangen",
    thanks: "Tot snel,",
    team: "Het Cartoonova-team",
  },
  pl: {
    subject: (t) => `Twój portret jako plakat ${t}`,
    title: "A może Twój portret zawiśnie na ścianie?",
    greeting: (n) => (n ? `Cześć ${n},` : "Cześć,"),
    body: (t) => `Podoba Ci się Twój cyfrowy portret? Możemy go też wydrukować jako plakat ${t} na matowym papierze i dostarczyć do domu.`,
    price: (v) => `Wydruk Twojego portretu kosztuje <strong>${v}</strong>: wykorzystujemy ilustrację, którą już masz, nic nie trzeba rysować od nowa.`,
    reply: "Aby go zamówić, po prostu odpowiedz na tego e-maila, a wyślemy Ci link do płatności.",
    cta: "Zobacz go jako plakat",
    unsubscribe: "Nie chcę otrzymywać takich e-maili",
    thanks: "Do zobaczenia,",
    team: "Zespół Cartoonova",
  },
  sv: {
    subject: (t) => `Ditt porträtt som affisch ${t}`,
    title: "Ska ditt porträtt upp på väggen?",
    greeting: (n) => (n ? `Hej ${n},` : "Hej,"),
    body: (t) => `Gillar du ditt digitala porträtt? Vi kan också trycka det som en affisch i ${t} på matt papper, levererad hem till dig.`,
    price: (v) => `Trycket av ditt porträtt kostar <strong>${v}</strong>: vi använder illustrationen du redan har, inget behöver ritas om.`,
    reply: "För att beställa svarar du bara på det här mejlet, så skickar vi betalningslänken.",
    cta: "Se den som affisch",
    unsubscribe: "Sluta ta emot den här typen av mejl",
    thanks: "Vi ses snart,",
    team: "Cartoonova-teamet",
  },
  da: {
    subject: (t) => `Dit portræt som plakat ${t}`,
    title: "Skal dit portræt op på væggen?",
    greeting: (n) => (n ? `Hej ${n},` : "Hej,"),
    body: (t) => `Glad for dit digitale portræt? Vi kan også trykke det som en plakat i ${t} på mat papir, leveret til din dør.`,
    price: (v) => `Trykket af dit portræt koster <strong>${v}</strong>: vi bruger den illustration, du allerede har, intet skal tegnes om.`,
    reply: "For at bestille skal du bare svare på denne e-mail, så sender vi dig betalingslinket.",
    cta: "Se den som plakat",
    unsubscribe: "Modtag ikke længere denne type e-mails",
    thanks: "Vi ses snart,",
    team: "Cartoonova-teamet",
  },
  pt: {
    subject: (t) => `O teu retrato em póster ${t}`,
    title: "E se o teu retrato fosse para a parede?",
    greeting: (n) => (n ? `Olá ${n},` : "Olá,"),
    body: (t) => `Gostas do teu retrato digital? Também o podemos imprimir num póster de ${t} em papel mate, entregue em tua casa.`,
    price: (v) => `A impressão do teu retrato custa <strong>${v}</strong>: usamos a ilustração que já tens, não há nada a redesenhar.`,
    reply: "Para encomendar, responde simplesmente a este e-mail e enviamos-te o link de pagamento.",
    cta: "Ver como fica em póster",
    unsubscribe: "Deixar de receber este tipo de e-mail",
    thanks: "Até breve,",
    team: "A equipa Cartoonova",
  },
};

/* ─── Parrainage ──────────────────────────────────────────────────────────
   L'ami recoit −20 %, le parrain un bon de `valeur` (5 € convertis dans sa
   devise) quand l'ami paie. Les memes textes servent l'e-mail de livraison et
   la page des cadeaux offerts, pour que l'offre se lise a l'identique. */

export const parrainageTextes: Record<Lang, {
  titre: string;
  /** Une phrase, le code est affiche a part dans son encadre. */
  offre: (valeur: string) => string;
  code: string;
  copier: string;
  copie: string;
  recompenseSujet: (valeur: string) => string;
  recompenseTitre: string;
  recompenseIntro: (valeur: string) => string;
}> = {
  fr: {
    titre: "Fais plaisir à un ami",
    offre: (v) => `Offre −20 % à un ami avec ton code, et reçois un bon de ${v} quand il commande.`,
    code: "Ton code ami",
    copier: "Copier le code",
    copie: "Code copié !",
    recompenseSujet: (v) => `Ton ami a commandé : voici ton bon de ${v}`,
    recompenseTitre: "Merci pour le parrainage !",
    recompenseIntro: (v) => `Un ami a commandé son portrait avec ton code. Comme promis, voici un bon cadeau de ${v}, à utiliser sur ta prochaine commande.`,
  },
  en: {
    titre: "Treat a friend",
    offre: (v) => `Give a friend 20% off with your code, and get a ${v} gift card when they order.`,
    code: "Your friend code",
    copier: "Copy the code",
    copie: "Code copied!",
    recompenseSujet: (v) => `Your friend ordered: here is your ${v} gift card`,
    recompenseTitre: "Thanks for the referral!",
    recompenseIntro: (v) => `A friend ordered their portrait with your code. As promised, here is a ${v} gift card to use on your next order.`,
  },
  es: {
    titre: "Haz feliz a un amigo",
    offre: (v) => `Regala un 20 % de descuento a un amigo con tu código y recibe un vale de ${v} cuando haga su pedido.`,
    code: "Tu código de amigo",
    copier: "Copiar el código",
    copie: "¡Código copiado!",
    recompenseSujet: (v) => `Tu amigo ha hecho su pedido: aquí tienes tu vale de ${v}`,
    recompenseTitre: "¡Gracias por recomendarnos!",
    recompenseIntro: (v) => `Un amigo ha pedido su retrato con tu código. Como prometimos, aquí tienes un vale regalo de ${v} para tu próximo pedido.`,
  },
  de: {
    titre: "Mach einem Freund eine Freude",
    offre: (v) => `Schenke einem Freund 20 % Rabatt mit deinem Code und erhalte einen Gutschein über ${v}, sobald er bestellt.`,
    code: "Dein Freundescode",
    copier: "Code kopieren",
    copie: "Code kopiert!",
    recompenseSujet: (v) => `Dein Freund hat bestellt: Hier ist dein Gutschein über ${v}`,
    recompenseTitre: "Danke für die Empfehlung!",
    recompenseIntro: (v) => `Ein Freund hat sein Porträt mit deinem Code bestellt. Wie versprochen bekommst du einen Gutschein über ${v} für deine nächste Bestellung.`,
  },
  it: {
    titre: "Fai un regalo a un amico",
    offre: (v) => `Regala il 20 % di sconto a un amico con il tuo codice e ricevi un buono da ${v} quando ordina.`,
    code: "Il tuo codice amico",
    copier: "Copia il codice",
    copie: "Codice copiato!",
    recompenseSujet: (v) => `Il tuo amico ha ordinato: ecco il tuo buono da ${v}`,
    recompenseTitre: "Grazie per il passaparola!",
    recompenseIntro: (v) => `Un amico ha ordinato il suo ritratto con il tuo codice. Come promesso, ecco un buono regalo da ${v} da usare sul tuo prossimo ordine.`,
  },
  nl: {
    titre: "Verras een vriend",
    offre: (v) => `Geef een vriend 20% korting met jouw code en ontvang een cadeaubon van ${v} zodra die bestelt.`,
    code: "Jouw vriendencode",
    copier: "Code kopiëren",
    copie: "Code gekopieerd!",
    recompenseSujet: (v) => `Je vriend heeft besteld: hier is je cadeaubon van ${v}`,
    recompenseTitre: "Bedankt voor het doorvertellen!",
    recompenseIntro: (v) => `Een vriend heeft zijn portret besteld met jouw code. Zoals beloofd krijg je een cadeaubon van ${v} voor je volgende bestelling.`,
  },
  pl: {
    titre: "Spraw radość przyjacielowi",
    offre: (v) => `Podaruj przyjacielowi 20% zniżki ze swoim kodem i otrzymaj bon o wartości ${v}, gdy złoży zamówienie.`,
    code: "Twój kod dla przyjaciela",
    copier: "Kopiuj kod",
    copie: "Kod skopiowany!",
    recompenseSujet: (v) => `Twój przyjaciel złożył zamówienie: oto Twój bon o wartości ${v}`,
    recompenseTitre: "Dziękujemy za polecenie!",
    recompenseIntro: (v) => `Przyjaciel zamówił swój portret z Twoim kodem. Zgodnie z obietnicą oto bon podarunkowy o wartości ${v} na Twoje następne zamówienie.`,
  },
  sv: {
    titre: "Glädj en vän",
    offre: (v) => `Ge en vän 20 % rabatt med din kod och få ett presentkort på ${v} när hen beställer.`,
    code: "Din vänkod",
    copier: "Kopiera koden",
    copie: "Koden kopierad!",
    recompenseSujet: (v) => `Din vän har beställt: här är ditt presentkort på ${v}`,
    recompenseTitre: "Tack för att du tipsade!",
    recompenseIntro: (v) => `En vän har beställt sitt porträtt med din kod. Som utlovat får du ett presentkort på ${v} att använda på din nästa beställning.`,
  },
  da: {
    titre: "Glæd en ven",
    offre: (v) => `Giv en ven 20 % rabat med din kode, og få et gavekort på ${v}, når vedkommende bestiller.`,
    code: "Din vennekode",
    copier: "Kopiér koden",
    copie: "Koden er kopieret!",
    recompenseSujet: (v) => `Din ven har bestilt: her er dit gavekort på ${v}`,
    recompenseTitre: "Tak for anbefalingen!",
    recompenseIntro: (v) => `En ven har bestilt sit portræt med din kode. Som lovet får du et gavekort på ${v} til din næste bestilling.`,
  },
  pt: {
    titre: "Faz um amigo feliz",
    offre: (v) => `Oferece 20% de desconto a um amigo com o teu código e recebe um vale de ${v} quando ele encomendar.`,
    code: "O teu código de amigo",
    copier: "Copiar o código",
    copie: "Código copiado!",
    recompenseSujet: (v) => `O teu amigo encomendou: aqui está o teu vale de ${v}`,
    recompenseTitre: "Obrigado pela recomendação!",
    recompenseIntro: (v) => `Um amigo encomendou o seu retrato com o teu código. Como prometido, aqui está um vale de oferta de ${v} para usares na tua próxima encomenda.`,
  },
};

/** Montant affiche dans un e-mail, sans decimales inutiles (« 29 € », « 29,90 € »). */
export function formatPrix(montant: number, devise: string, lang: Lang): string {
  const entier = Number.isInteger(montant);
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: devise,
    minimumFractionDigits: entier ? 0 : 2,
    maximumFractionDigits: entier ? 0 : 2,
  }).format(montant);
}
