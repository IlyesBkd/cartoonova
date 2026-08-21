import type { Locale } from "../i18n/config";
import { produitParSlug, slugProduit } from "./catalogue";
import { GIFT_PRODUCTS } from "./productFeed";

/**
 * Pages « un style pour une occasion ».
 *
 * Chaque page combine deux contenus ecrits a la main — l'angle de l'occasion et
 * l'angle du style — plus une FAQ propre a l'occasion. Ce n'est pas un gabarit
 * rempli avec deux mots changes : sans contenu specifique, ces pages seraient
 * des pages satellites, ce que Google sanctionne.
 */

export const OCCASION_KEYS = [
  "anniversaire",
  "noel",
  "saint-valentin",
  "fete-des-meres",
  "mariage",
  "depart",
] as const;

export type OccasionKey = (typeof OCCASION_KEYS)[number];

export interface OccasionContent {
  /** Fragment d'URL, propre a la langue. */
  slug: string;
  /** Nom de l'occasion tel qu'il apparait dans les titres. */
  label: string;
  /** Comment on formule « portrait X pour Y » dans cette langue. */
  headline: (styleName: string) => string;
  intro: string;
  bullets: [string, string, string];
  faq: { question: string; answer: string }[];
}

type OccasionTable = Record<OccasionKey, OccasionContent>;

const fr: OccasionTable = {
  anniversaire: {
    slug: "anniversaire",
    label: "un anniversaire",
    headline: (style) => `${style} pour un anniversaire`,
    intro:
      "Un anniversaire revient chaque année, et c'est justement le problème : au bout d'un moment, on a fait le tour des idées. Un portrait dessiné à la main sort du lot parce qu'il ne peut pas être offert deux fois — il est fait à partir d'une photo précise, de cette personne-là.",
    bullets: [
      "Personne d'autre ne peut offrir le même : le dessin part de votre photo.",
      "Ça se garde et ça s'accroche, contrairement à la plupart des cadeaux d'anniversaire.",
      "Le dessin est prêt en 2 jours, ce qui laisse une marge même quand on s'y prend tard.",
    ],
    faq: [
      {
        question: "Combien de temps avant l'anniversaire faut-il commander ?",
        answer:
          "Pour une version numérique, comptez 2 jours. Pour un poster ou une toile, comptez environ 5 jours ouvrés entre la commande et la réception : 2 jours de dessin, puis 3 jours ouvrés d'impression et de livraison.",
      },
      {
        question: "Peut-on mettre plusieurs personnes sur le portrait d'anniversaire ?",
        answer:
          "Oui. Vous pouvez ajouter d'autres personnes et des animaux de compagnie. Pour un bon résultat, mieux vaut fournir une photo nette de chaque personne plutôt qu'une seule photo de groupe prise de loin.",
      },
    ],
  },
  noel: {
    slug: "cadeau-de-noel",
    label: "Noël",
    headline: (style) => `${style} comme cadeau de Noël`,
    intro:
      "À Noël, le problème n'est pas de trouver un cadeau, c'est d'en trouver un qui ne finisse pas dans un placard en janvier. Un portrait de famille dessiné à la main est un objet qu'on accroche, et qui rappelle une année précise.",
    bullets: [
      "Un cadeau qui se déballe devant tout le monde et qui se commente.",
      "Idéal pour offrir à des parents ou grands-parents qui « n'ont besoin de rien ».",
      "La version numérique reste possible jusqu'à la dernière minute.",
    ],
    faq: [
      {
        question: "Jusqu'à quand peut-on commander pour recevoir avant Noël ?",
        answer:
          "La date limite est affichée directement sur le site pendant la période de Noël. En pratique, il faut compter environ 5 jours ouvrés pour une impression livrée, et 2 jours pour la version numérique.",
      },
      {
        question: "Peut-on offrir un portrait sans l'avoir reçu à temps ?",
        answer:
          "Oui : vous pouvez offrir la version numérique le jour J et faire livrer l'impression ensuite. Beaucoup de commandes de dernière minute se passent comme ça.",
      },
    ],
  },
  "saint-valentin": {
    slug: "saint-valentin",
    label: "la Saint-Valentin",
    headline: (style) => `${style} pour la Saint-Valentin`,
    intro:
      "Un cadeau de Saint-Valentin réussi parle du couple, pas du calendrier. Un portrait à deux, dessiné à partir d'une photo qui compte, dit quelque chose qu'un bouquet ne dit pas.",
    bullets: [
      "Le portrait part d'une vraie photo de vous deux : un souvenir précis, pas un symbole générique.",
      "Un objet qui reste, là où les fleurs durent une semaine.",
      "Le ton du style choisi permet d'être romantique sans être mièvre.",
    ],
    faq: [
      {
        question: "Quel style choisir pour un portrait de couple ?",
        answer:
          "Ghibli et Disney donnent le rendu le plus doux et le plus décoratif. Simpson et Rick & Morty conviennent aux couples qui préfèrent l'humour à la carte postale.",
      },
      {
        question: "Faut-il une photo où l'on est déjà tous les deux ?",
        answer:
          "Ce n'est pas obligatoire. Deux photos individuelles nettes fonctionnent très bien : l'illustrateur compose ensuite la scène.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "fete-des-meres",
    label: "la fête des mères",
    headline: (style) => `${style} pour la fête des mères`,
    intro:
      "La fête des mères est l'occasion où le fait main compte le plus. Un portrait dessiné à partir d'une photo de famille est un cadeau que l'on ne peut pas acheter en rayon la veille.",
    bullets: [
      "Un cadeau personnel, qui montre le temps qu'on y a mis plutôt que le prix.",
      "Les portraits de famille et les portraits avec les enfants sont les plus demandés pour cette occasion.",
      "Les animaux de compagnie peuvent être ajoutés au dessin.",
    ],
    faq: [
      {
        question: "Peut-on inclure toute la famille sur le portrait ?",
        answer:
          "Oui, plusieurs personnes et animaux peuvent figurer sur le même dessin. Chaque personne supplémentaire est facturée en option au moment de la commande.",
      },
      {
        question: "Et si le résultat ne correspond pas à ce qu'on imaginait ?",
        answer:
          "Un aperçu vous est envoyé avant l'impression : vous pouvez demander des modifications à ce moment-là, avant que quoi que ce soit ne parte à la fabrication.",
      },
    ],
  },
  mariage: {
    slug: "cadeau-de-mariage",
    label: "un mariage",
    headline: (style) => `${style} comme cadeau de mariage`,
    intro:
      "Un cadeau de mariage est comparé aux autres, souvent le jour même. Un portrait dessiné à la main du couple échappe à la liste et se remarque, précisément parce qu'il ne vient pas d'une liste.",
    bullets: [
      "Un cadeau que personne d'autre n'aura pensé à offrir.",
      "Peut être réalisé à partir d'une photo des fiançailles ou d'une photo ancienne du couple.",
      "Se prête bien à un cadeau collectif entre plusieurs invités.",
    ],
    faq: [
      {
        question: "Peut-on faire le portrait à partir d'une photo du mariage lui-même ?",
        answer:
          "Oui, mais il faut alors attendre les photos. Beaucoup préfèrent une photo antérieure du couple pour pouvoir offrir le portrait le jour du mariage.",
      },
      {
        question: "Quel format choisir pour un cadeau de mariage ?",
        answer:
          "La toile est le format le plus offert pour cette occasion : elle s'accroche directement, sans encadrement à prévoir.",
      },
    ],
  },
  depart: {
    slug: "depart-a-la-retraite",
    label: "un départ",
    headline: (style) => `${style} pour un départ ou une retraite`,
    intro:
      "Un pot de départ finit souvent par une carte signée par tout le monde. Un portrait dessiné à la main de la personne qui part est un cadeau collectif qui coûte peu par personne et qui reste des années.",
    bullets: [
      "Un cadeau collectif facile à organiser entre collègues.",
      "Le style choisi permet un clin d'œil à la personne plutôt qu'un cadeau protocolaire.",
      "Se commande à partir d'une simple photo prise au bureau.",
    ],
    faq: [
      {
        question: "Peut-on ajouter un texte ou une dédicace au portrait ?",
        answer:
          "Vous pouvez préciser vos souhaits dans le champ de description au moment de la commande. L'illustrateur en tient compte lorsque c'est réalisable dans le style choisi.",
      },
      {
        question: "Quel délai prévoir pour un pot de départ ?",
        answer:
          "Environ 5 jours ouvrés pour une impression livrée. Si la date est proche, la version numérique reste imprimable localement.",
      },
    ],
  },
};

const en: OccasionTable = {
  anniversaire: {
    slug: "birthday",
    label: "a birthday",
    headline: (style) => `${style} for a birthday`,
    intro:
      "Birthdays come round every year, and that's the problem: eventually you run out of ideas. A hand-drawn portrait stands out because it can't be given twice — it's made from one specific photo, of that one person.",
    bullets: [
      "Nobody else can give the same thing: the drawing starts from your photo.",
      "It gets kept and hung up, unlike most birthday presents.",
      "The artwork is ready within 2 days, which leaves room even when you're late.",
    ],
    faq: [
      {
        question: "How far in advance should I order for a birthday?",
        answer:
          "For a digital version, allow 2 days. For a poster or canvas, allow about 5 business days between order and delivery: 2 days of drawing, then 3 business days of printing and shipping.",
      },
      {
        question: "Can several people appear on a birthday portrait?",
        answer:
          "Yes. You can add more people and pets. For the best result, send one sharp photo of each person rather than a single distant group shot.",
      },
    ],
  },
  noel: {
    slug: "christmas-gift",
    label: "Christmas",
    headline: (style) => `${style} as a Christmas gift`,
    intro:
      "At Christmas the hard part isn't finding a gift, it's finding one that doesn't end up in a cupboard by January. A hand-drawn family portrait is something people hang up, tied to one particular year.",
    bullets: [
      "A gift that gets unwrapped in front of everyone and gets talked about.",
      "Ideal for parents or grandparents who 'don't need anything'.",
      "The digital version stays possible right up to the last minute.",
    ],
    faq: [
      {
        question: "What's the cut-off for ordering in time for Christmas?",
        answer:
          "The order-by date is shown on the site during the Christmas period. In practice, allow about 5 business days for a delivered print, and 2 days for the digital version.",
      },
      {
        question: "Can I give the portrait if the print hasn't arrived yet?",
        answer:
          "Yes: you can give the digital version on the day and have the print delivered afterwards. Plenty of last-minute orders work exactly like that.",
      },
    ],
  },
  "saint-valentin": {
    slug: "valentines-day",
    label: "Valentine's Day",
    headline: (style) => `${style} for Valentine's Day`,
    intro:
      "A good Valentine's gift is about the couple, not the calendar. A portrait of the two of you, drawn from a photo that matters, says something flowers can't.",
    bullets: [
      "The portrait starts from a real photo of you both: a specific memory, not a generic symbol.",
      "Something that lasts, where flowers last a week.",
      "The style you pick lets you be romantic without being sugary.",
    ],
    faq: [
      {
        question: "Which style works best for a couple's portrait?",
        answer:
          "Ghibli and Disney give the softest, most decorative result. Simpsons and Rick & Morty suit couples who'd rather have humour than a greeting card.",
      },
      {
        question: "Do we need a photo where we're already together?",
        answer:
          "Not necessarily. Two sharp individual photos work well: the illustrator composes the scene afterwards.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "mothers-day",
    label: "Mother's Day",
    headline: (style) => `${style} for Mother's Day`,
    intro:
      "Mother's Day is the occasion where handmade counts most. A portrait drawn from a family photo is a gift you can't grab off a shelf the night before.",
    bullets: [
      "A personal gift that shows the thought rather than the price.",
      "Family portraits and portraits with the children are the most requested for this occasion.",
      "Pets can be added to the drawing.",
    ],
    faq: [
      {
        question: "Can the whole family be on the portrait?",
        answer:
          "Yes, several people and pets can share the same drawing. Each additional person is priced as an option at checkout.",
      },
      {
        question: "What if the result isn't what we pictured?",
        answer:
          "You get a preview before printing: that's the moment to ask for changes, before anything goes into production.",
      },
    ],
  },
  mariage: {
    slug: "wedding-gift",
    label: "a wedding",
    headline: (style) => `${style} as a wedding gift`,
    intro:
      "Wedding gifts get compared to each other, often on the day. A hand-drawn portrait of the couple escapes the registry and gets noticed, precisely because it didn't come from one.",
    bullets: [
      "A gift nobody else will have thought of.",
      "Can be made from an engagement photo or an older photo of the couple.",
      "Works well as a joint gift from several guests.",
    ],
    faq: [
      {
        question: "Can the portrait be made from a photo of the wedding itself?",
        answer:
          "Yes, but then you have to wait for the photos. Many people prefer an earlier photo of the couple so the portrait can be given on the day.",
      },
      {
        question: "Which format suits a wedding gift?",
        answer:
          "Canvas is the most requested format for this occasion: it hangs straight away, with no framing to arrange.",
      },
    ],
  },
  depart: {
    slug: "retirement-gift",
    label: "a farewell",
    headline: (style) => `${style} for a farewell or retirement`,
    intro:
      "Leaving parties usually end with a card everyone signed. A hand-drawn portrait of the person leaving is a group gift that costs little per head and lasts for years.",
    bullets: [
      "A group gift that's easy to organise between colleagues.",
      "The style lets you nod to the person rather than give something formal.",
      "Can be ordered from a single photo taken at the office.",
    ],
    faq: [
      {
        question: "Can we add a message or dedication to the portrait?",
        answer:
          "You can describe what you'd like in the description field at checkout. The illustrator takes it into account where the chosen style allows.",
      },
      {
        question: "How long should we allow for a leaving party?",
        answer:
          "About 5 business days for a delivered print. If the date is close, the digital version can still be printed locally.",
      },
    ],
  },
};

const es: OccasionTable = {
  anniversaire: {
    slug: "cumpleanos",
    label: "un cumpleaños",
    headline: (style) => `${style} para un cumpleaños`,
    intro:
      "Un cumpleaños vuelve cada año, y ahí está el problema: al final se acaban las ideas. Un retrato dibujado a mano destaca porque no se puede regalar dos veces — parte de una foto concreta, de esa persona.",
    bullets: [
      "Nadie más puede regalar lo mismo: el dibujo parte de tu foto.",
      "Se guarda y se cuelga, al contrario que la mayoría de regalos de cumpleaños.",
      "El dibujo está listo en 2 días, lo que deja margen incluso a última hora.",
    ],
    faq: [
      {
        question: "¿Con cuánta antelación hay que pedirlo?",
        answer:
          "Para la versión digital, calcula 2 días. Para un póster o un lienzo, calcula unos 5 días hábiles entre el pedido y la recepción: 2 días de dibujo y 3 días hábiles de impresión y envío.",
      },
      {
        question: "¿Pueden aparecer varias personas en el retrato?",
        answer:
          "Sí. Puedes añadir más personas y mascotas. Para un buen resultado, envía una foto nítida de cada persona en lugar de una sola foto de grupo lejana.",
      },
    ],
  },
  noel: {
    slug: "regalo-de-navidad",
    label: "la Navidad",
    headline: (style) => `${style} como regalo de Navidad`,
    intro:
      "En Navidad lo difícil no es encontrar un regalo, sino uno que no acabe en un armario en enero. Un retrato familiar dibujado a mano se cuelga y queda asociado a un año concreto.",
    bullets: [
      "Un regalo que se abre delante de todos y del que se habla.",
      "Ideal para padres o abuelos que « no necesitan nada ».",
      "La versión digital sigue siendo posible hasta el último momento.",
    ],
    faq: [
      {
        question: "¿Hasta cuándo se puede pedir para recibirlo antes de Navidad?",
        answer:
          "La fecha límite aparece en la web durante la campaña de Navidad. En la práctica, calcula unos 5 días hábiles para una impresión entregada y 2 días para la versión digital.",
      },
      {
        question: "¿Se puede regalar aunque la impresión no haya llegado?",
        answer:
          "Sí: puedes regalar la versión digital el mismo día y recibir la impresión después. Muchos pedidos de última hora funcionan así.",
      },
    ],
  },
  "saint-valentin": {
    slug: "san-valentin",
    label: "San Valentín",
    headline: (style) => `${style} para San Valentín`,
    intro:
      "Un buen regalo de San Valentín habla de la pareja, no del calendario. Un retrato de los dos, hecho a partir de una foto que importa, dice algo que un ramo no dice.",
    bullets: [
      "El retrato parte de una foto real de los dos: un recuerdo concreto, no un símbolo genérico.",
      "Algo que permanece, mientras que las flores duran una semana.",
      "El estilo elegido permite ser romántico sin caer en lo cursi.",
    ],
    faq: [
      {
        question: "¿Qué estilo va mejor para un retrato de pareja?",
        answer:
          "Ghibli y Disney dan el resultado más suave y decorativo. Simpson y Rick & Morty encajan con parejas que prefieren el humor a la postal.",
      },
      {
        question: "¿Hace falta una foto en la que ya salgamos juntos?",
        answer:
          "No es obligatorio. Dos fotos individuales nítidas funcionan muy bien: el ilustrador compone la escena después.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "dia-de-la-madre",
    label: "el Día de la Madre",
    headline: (style) => `${style} para el Día de la Madre`,
    intro:
      "El Día de la Madre es la ocasión en la que más cuenta lo hecho a mano. Un retrato dibujado a partir de una foto de familia no se compra en una estantería la víspera.",
    bullets: [
      "Un regalo personal, que demuestra el tiempo dedicado más que el precio.",
      "Los retratos de familia y con los hijos son los más pedidos para esta ocasión.",
      "Las mascotas pueden incluirse en el dibujo.",
    ],
    faq: [
      {
        question: "¿Puede salir toda la familia en el retrato?",
        answer:
          "Sí, varias personas y mascotas pueden compartir el mismo dibujo. Cada persona adicional se cobra como opción al hacer el pedido.",
      },
      {
        question: "¿Y si el resultado no es lo que imaginábamos?",
        answer:
          "Recibes una vista previa antes de imprimir: ese es el momento de pedir cambios, antes de que nada entre en producción.",
      },
    ],
  },
  mariage: {
    slug: "regalo-de-boda",
    label: "una boda",
    headline: (style) => `${style} como regalo de boda`,
    intro:
      "Los regalos de boda se comparan entre sí, a menudo el mismo día. Un retrato dibujado a mano de la pareja se sale de la lista y se nota, precisamente porque no viene de una lista.",
    bullets: [
      "Un regalo que nadie más habrá pensado en hacer.",
      "Puede hacerse a partir de una foto de la pedida o de una foto antigua de la pareja.",
      "Funciona muy bien como regalo conjunto entre varios invitados.",
    ],
    faq: [
      {
        question: "¿Se puede hacer con una foto de la propia boda?",
        answer:
          "Sí, pero entonces hay que esperar a las fotos. Muchos prefieren una foto anterior de la pareja para poder regalarlo el mismo día.",
      },
      {
        question: "¿Qué formato encaja mejor para una boda?",
        answer:
          "El lienzo es el formato más pedido para esta ocasión: se cuelga directamente, sin tener que enmarcarlo.",
      },
    ],
  },
  depart: {
    slug: "regalo-de-jubilacion",
    label: "una despedida",
    headline: (style) => `${style} para una despedida o jubilación`,
    intro:
      "Las despedidas suelen acabar con una tarjeta firmada por todos. Un retrato dibujado a mano de quien se va es un regalo colectivo que sale barato por persona y dura años.",
    bullets: [
      "Un regalo colectivo fácil de organizar entre compañeros.",
      "El estilo permite un guiño a la persona en lugar de un regalo protocolario.",
      "Se pide a partir de una simple foto hecha en la oficina.",
    ],
    faq: [
      {
        question: "¿Se puede añadir un texto o una dedicatoria?",
        answer:
          "Puedes indicar lo que quieras en el campo de descripción del pedido. El ilustrador lo tiene en cuenta cuando el estilo elegido lo permite.",
      },
      {
        question: "¿Qué plazo hay que prever para una despedida?",
        answer:
          "Unos 5 días hábiles para una impresión entregada. Si la fecha está cerca, la versión digital se puede imprimir en local.",
      },
    ],
  },
};

const de: OccasionTable = {
  anniversaire: {
    slug: "geburtstag",
    label: "einen Geburtstag",
    headline: (style) => `${style} zum Geburtstag`,
    intro:
      "Ein Geburtstag kommt jedes Jahr wieder — und genau das ist das Problem: irgendwann sind die Ideen aufgebraucht. Ein handgezeichnetes Portrait fällt auf, weil es sich kein zweites Mal verschenken lässt: es entsteht aus einem bestimmten Foto dieser einen Person.",
    bullets: [
      "Niemand sonst kann dasselbe schenken: die Zeichnung entsteht aus Ihrem Foto.",
      "Es wird aufgehoben und aufgehängt — anders als die meisten Geburtstagsgeschenke.",
      "Die Zeichnung ist in 2 Tagen fertig, das lässt auch spät noch Luft.",
    ],
    faq: [
      {
        question: "Wie lange vorher sollte man bestellen?",
        answer:
          "Für die digitale Fassung rechnen Sie mit 2 Tagen. Für Poster oder Leinwand rechnen Sie mit rund 5 Werktagen zwischen Bestellung und Erhalt: 2 Tage Zeichnung, dann 3 Werktage Druck und Versand.",
      },
      {
        question: "Können mehrere Personen auf dem Portrait sein?",
        answer:
          "Ja. Sie können weitere Personen und Haustiere hinzufügen. Am besten schicken Sie ein scharfes Einzelfoto pro Person statt einer entfernten Gruppenaufnahme.",
      },
    ],
  },
  noel: {
    slug: "weihnachtsgeschenk",
    label: "Weihnachten",
    headline: (style) => `${style} als Weihnachtsgeschenk`,
    intro:
      "An Weihnachten ist nicht das Finden eines Geschenks schwer, sondern eines, das im Januar nicht im Schrank landet. Ein handgezeichnetes Familienportrait wird aufgehängt und bleibt mit einem bestimmten Jahr verbunden.",
    bullets: [
      "Ein Geschenk, das vor allen ausgepackt wird und für Gesprächsstoff sorgt.",
      "Ideal für Eltern oder Großeltern, die „nichts brauchen“.",
      "Die digitale Fassung ist bis zur letzten Minute möglich.",
    ],
    faq: [
      {
        question: "Bis wann muss man für Weihnachten bestellen?",
        answer:
          "Das Bestelldatum wird während der Weihnachtszeit direkt auf der Seite angezeigt. Praktisch sind es rund 5 Werktage für einen gelieferten Druck und 2 Tage für die digitale Fassung.",
      },
      {
        question: "Kann man schenken, bevor der Druck da ist?",
        answer:
          "Ja: Sie verschenken am Tag selbst die digitale Fassung und lassen den Druck später liefern. Viele Last-Minute-Bestellungen laufen genau so.",
      },
    ],
  },
  "saint-valentin": {
    slug: "valentinstag",
    label: "den Valentinstag",
    headline: (style) => `${style} zum Valentinstag`,
    intro:
      "Ein gutes Valentinsgeschenk handelt vom Paar, nicht vom Kalender. Ein Portrait von Ihnen beiden, gezeichnet nach einem Foto, das zählt, sagt etwas, das ein Blumenstrauß nicht sagt.",
    bullets: [
      "Das Portrait entsteht aus einem echten Foto von Ihnen beiden: eine konkrete Erinnerung, kein allgemeines Symbol.",
      "Etwas, das bleibt — Blumen halten eine Woche.",
      "Der gewählte Stil erlaubt Romantik ohne Kitsch.",
    ],
    faq: [
      {
        question: "Welcher Stil passt zu einem Paarportrait?",
        answer:
          "Ghibli und Disney ergeben das weichste, dekorativste Ergebnis. Simpsons und Rick & Morty passen zu Paaren, die Humor einer Grußkarte vorziehen.",
      },
      {
        question: "Brauchen wir ein Foto, auf dem wir schon zusammen sind?",
        answer:
          "Nicht unbedingt. Zwei scharfe Einzelfotos funktionieren gut: der Illustrator setzt die Szene anschließend zusammen.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "muttertag",
    label: "den Muttertag",
    headline: (style) => `${style} zum Muttertag`,
    intro:
      "Am Muttertag zählt Handgemachtes am meisten. Ein Portrait, gezeichnet nach einem Familienfoto, lässt sich am Vorabend nicht einfach aus dem Regal nehmen.",
    bullets: [
      "Ein persönliches Geschenk, bei dem der Gedanke zählt, nicht der Preis.",
      "Familienportraits und Portraits mit den Kindern sind zu diesem Anlass am gefragtesten.",
      "Haustiere können in die Zeichnung aufgenommen werden.",
    ],
    faq: [
      {
        question: "Kann die ganze Familie aufs Portrait?",
        answer:
          "Ja, mehrere Personen und Haustiere passen auf dieselbe Zeichnung. Jede zusätzliche Person wird bei der Bestellung als Option berechnet.",
      },
      {
        question: "Und wenn das Ergebnis nicht unseren Vorstellungen entspricht?",
        answer:
          "Sie erhalten vor dem Druck eine Vorschau: das ist der Moment für Änderungswünsche, bevor irgendetwas in Produktion geht.",
      },
    ],
  },
  mariage: {
    slug: "hochzeitsgeschenk",
    label: "eine Hochzeit",
    headline: (style) => `${style} als Hochzeitsgeschenk`,
    intro:
      "Hochzeitsgeschenke werden miteinander verglichen, oft noch am selben Tag. Ein handgezeichnetes Portrait des Paares steht neben der Wunschliste und fällt genau deshalb auf.",
    bullets: [
      "Ein Geschenk, an das sonst niemand gedacht hat.",
      "Möglich nach einem Verlobungsfoto oder einem älteren Foto des Paares.",
      "Eignet sich gut als gemeinsames Geschenk mehrerer Gäste.",
    ],
    faq: [
      {
        question: "Kann das Portrait nach einem Foto der Hochzeit entstehen?",
        answer:
          "Ja, dann muss man aber auf die Fotos warten. Viele wählen ein früheres Foto des Paares, um das Portrait am Hochzeitstag überreichen zu können.",
      },
      {
        question: "Welches Format passt zu einem Hochzeitsgeschenk?",
        answer:
          "Die Leinwand ist zu diesem Anlass am gefragtesten: sie hängt sofort, ohne dass ein Rahmen organisiert werden muss.",
      },
    ],
  },
  depart: {
    slug: "abschiedsgeschenk",
    label: "einen Abschied",
    headline: (style) => `${style} zum Abschied oder Ruhestand`,
    intro:
      "Abschiedsfeiern enden meist mit einer Karte, die alle unterschrieben haben. Ein handgezeichnetes Portrait der Person, die geht, ist ein Gemeinschaftsgeschenk, das pro Kopf wenig kostet und Jahre bleibt.",
    bullets: [
      "Ein Gemeinschaftsgeschenk, das sich im Team leicht organisieren lässt.",
      "Der Stil erlaubt ein Augenzwinkern statt eines förmlichen Geschenks.",
      "Ein einfaches Foto aus dem Büro genügt für die Bestellung.",
    ],
    faq: [
      {
        question: "Kann man einen Text oder eine Widmung ergänzen?",
        answer:
          "Sie können Ihre Wünsche im Beschreibungsfeld der Bestellung angeben. Der Illustrator berücksichtigt sie, soweit der gewählte Stil es zulässt.",
      },
      {
        question: "Wie viel Zeit sollte man für eine Abschiedsfeier einplanen?",
        answer:
          "Rund 5 Werktage für einen gelieferten Druck. Ist der Termin nah, lässt sich die digitale Fassung vor Ort ausdrucken.",
      },
    ],
  },
};

const it: OccasionTable = {
  anniversaire: {
    slug: "compleanno",
    label: "un compleanno",
    headline: (style) => `${style} per un compleanno`,
    intro:
      "Un compleanno torna ogni anno, ed è proprio questo il problema: a un certo punto le idee finiscono. Un ritratto disegnato a mano si distingue perché non si può regalare due volte — nasce da una foto precisa, di quella persona.",
    bullets: [
      "Nessun altro può regalare la stessa cosa: il disegno parte dalla tua foto.",
      "Si conserva e si appende, al contrario della maggior parte dei regali di compleanno.",
      "Il disegno è pronto in 2 giorni, il che lascia margine anche all'ultimo momento.",
    ],
    faq: [
      {
        question: "Con quanto anticipo bisogna ordinare?",
        answer:
          "Per la versione digitale, calcola 2 giorni. Per un poster o una tela, calcola circa 5 giorni lavorativi tra ordine e consegna: 2 giorni di disegno e 3 giorni lavorativi di stampa e spedizione.",
      },
      {
        question: "Possono comparire più persone nel ritratto?",
        answer:
          "Sì. Puoi aggiungere altre persone e animali domestici. Per un buon risultato, manda una foto nitida di ogni persona invece di una sola foto di gruppo da lontano.",
      },
    ],
  },
  noel: {
    slug: "regalo-di-natale",
    label: "il Natale",
    headline: (style) => `${style} come regalo di Natale`,
    intro:
      "A Natale il difficile non è trovare un regalo, ma trovarne uno che a gennaio non finisca in un armadio. Un ritratto di famiglia disegnato a mano si appende e resta legato a un anno preciso.",
    bullets: [
      "Un regalo che si apre davanti a tutti e di cui si parla.",
      "Ideale per genitori o nonni che « non hanno bisogno di niente ».",
      "La versione digitale resta possibile fino all'ultimo momento.",
    ],
    faq: [
      {
        question: "Entro quando ordinare per riceverlo prima di Natale?",
        answer:
          "La data limite è indicata sul sito durante il periodo natalizio. In pratica, calcola circa 5 giorni lavorativi per una stampa consegnata e 2 giorni per la versione digitale.",
      },
      {
        question: "Si può regalare prima che arrivi la stampa?",
        answer:
          "Sì: puoi regalare la versione digitale il giorno stesso e far consegnare la stampa dopo. Molti ordini dell'ultimo minuto funzionano così.",
      },
    ],
  },
  "saint-valentin": {
    slug: "san-valentino",
    label: "San Valentino",
    headline: (style) => `${style} per San Valentino`,
    intro:
      "Un buon regalo di San Valentino parla della coppia, non del calendario. Un ritratto di voi due, fatto da una foto che conta, dice qualcosa che un mazzo di fiori non dice.",
    bullets: [
      "Il ritratto parte da una foto vera di voi due: un ricordo preciso, non un simbolo generico.",
      "Qualcosa che resta, mentre i fiori durano una settimana.",
      "Lo stile scelto permette di essere romantici senza essere sdolcinati.",
    ],
    faq: [
      {
        question: "Quale stile scegliere per un ritratto di coppia?",
        answer:
          "Ghibli e Disney danno il risultato più delicato e decorativo. Simpson e Rick & Morty si adattano alle coppie che preferiscono l'ironia alla cartolina.",
      },
      {
        question: "Serve una foto in cui siamo già insieme?",
        answer:
          "Non è obbligatorio. Due foto individuali nitide funzionano benissimo: l'illustratore compone poi la scena.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "festa-della-mamma",
    label: "la festa della mamma",
    headline: (style) => `${style} per la festa della mamma`,
    intro:
      "La festa della mamma è l'occasione in cui il fatto a mano conta di più. Un ritratto disegnato da una foto di famiglia non si compra su uno scaffale la sera prima.",
    bullets: [
      "Un regalo personale, che mostra il pensiero più del prezzo.",
      "I ritratti di famiglia e con i figli sono i più richiesti per questa occasione.",
      "Gli animali domestici possono essere inseriti nel disegno.",
    ],
    faq: [
      {
        question: "Può esserci tutta la famiglia nel ritratto?",
        answer:
          "Sì, più persone e animali possono stare nello stesso disegno. Ogni persona in più è conteggiata come opzione al momento dell'ordine.",
      },
      {
        question: "E se il risultato non fosse quello immaginato?",
        answer:
          "Ricevi un'anteprima prima della stampa: è il momento per chiedere modifiche, prima che qualcosa vada in produzione.",
      },
    ],
  },
  mariage: {
    slug: "regalo-di-matrimonio",
    label: "un matrimonio",
    headline: (style) => `${style} come regalo di matrimonio`,
    intro:
      "I regali di matrimonio vengono confrontati tra loro, spesso lo stesso giorno. Un ritratto disegnato a mano della coppia esce dalla lista nozze e si nota, proprio perché non viene da lì.",
    bullets: [
      "Un regalo a cui nessun altro avrà pensato.",
      "Può nascere da una foto del fidanzamento o da una foto più vecchia della coppia.",
      "Funziona bene come regalo collettivo tra più invitati.",
    ],
    faq: [
      {
        question: "Si può fare da una foto del matrimonio stesso?",
        answer:
          "Sì, ma allora bisogna aspettare le foto. Molti preferiscono una foto precedente della coppia per poterlo regalare il giorno stesso.",
      },
      {
        question: "Quale formato scegliere per un matrimonio?",
        answer:
          "La tela è il formato più richiesto per questa occasione: si appende subito, senza dover pensare alla cornice.",
      },
    ],
  },
  depart: {
    slug: "regalo-di-pensionamento",
    label: "un saluto",
    headline: (style) => `${style} per un saluto o una pensione`,
    intro:
      "Le feste di saluto finiscono quasi sempre con un biglietto firmato da tutti. Un ritratto disegnato a mano di chi se ne va è un regalo collettivo che costa poco a testa e resta per anni.",
    bullets: [
      "Un regalo collettivo facile da organizzare tra colleghi.",
      "Lo stile permette una strizzata d'occhio invece di un regalo formale.",
      "Si ordina da una semplice foto scattata in ufficio.",
    ],
    faq: [
      {
        question: "Si può aggiungere un testo o una dedica?",
        answer:
          "Puoi indicare le tue richieste nel campo descrizione dell'ordine. L'illustratore ne tiene conto quando lo stile scelto lo consente.",
      },
      {
        question: "Che tempi prevedere per una festa di saluto?",
        answer:
          "Circa 5 giorni lavorativi per una stampa consegnata. Se la data è vicina, la versione digitale resta stampabile in loco.",
      },
    ],
  },
};

/* Neerlandais. Ecrit pour un acheteur neerlandais, pas traduit du francais :
   le ton y est direct, tutoie, et se passe des formules de politesse que le
   francais tient pour obligatoires. Les dates aussi different — la fete des
   meres tombe le deuxieme dimanche de mai aux Pays-Bas. */
const nl: OccasionTable = {
  anniversaire: {
    slug: "verjaardag",
    label: "een verjaardag",
    headline: (style) => `${style} voor een verjaardag`,
    intro:
      "Een verjaardag komt elk jaar terug, en dat is precies het probleem: op een gegeven moment heb je alle cadeaus wel gehad. Een met de hand getekend portret valt op omdat het geen tweede keer gegeven kan worden — het begint bij één specifieke foto, van díé persoon.",
    bullets: [
      "Niemand anders kan hetzelfde geven: de tekening begint bij jouw foto.",
      "Het hangt straks aan de muur, in tegenstelling tot de meeste verjaardagscadeaus.",
      "De tekening is in 2 dagen klaar, dus ook laat bestellen komt nog goed.",
    ],
    faq: [
      {
        question: "Hoe lang van tevoren moet ik bestellen voor een verjaardag?",
        answer:
          "Voor de digitale versie: reken op 2 dagen. Voor een poster of canvas ongeveer 5 werkdagen tussen bestelling en ontvangst — 2 dagen tekenen, daarna 3 werkdagen drukken en verzenden.",
      },
      {
        question: "Kunnen er meerdere personen op het portret staan?",
        answer:
          "Ja. Je kunt extra personen en huisdieren toevoegen. Lever bij voorkeur een scherpe foto van elke persoon aan, in plaats van één groepsfoto van veraf.",
      },
    ],
  },
  noel: {
    slug: "kerstcadeau",
    label: "Kerst",
    headline: (style) => `${style} als kerstcadeau`,
    intro:
      "Met Kerst is het probleem niet een cadeau vinden, maar er een vinden dat in januari niet in een kast verdwijnt. Een met de hand getekend familieportret hang je op, en het blijft herinneren aan een bepaald jaar.",
    bullets: [
      "Een cadeau dat je voor iedereen uitpakt en waar over gepraat wordt.",
      "Ideaal voor ouders of grootouders die ‘niets nodig hebben’.",
      "De digitale versie blijft tot het laatste moment mogelijk.",
    ],
    faq: [
      {
        question: "Tot wanneer kan ik bestellen om het voor Kerst te ontvangen?",
        answer:
          "De uiterste besteldatum staat tijdens de kerstperiode op de site. Reken in de praktijk op ongeveer 5 werkdagen voor een geleverde print, en 2 dagen voor de digitale versie.",
      },
      {
        question: "Kan ik iets geven dat nog niet binnen is?",
        answer:
          "Ja: geef de digitale versie op de dag zelf en laat de print daarna bezorgen. Veel last-minute bestellingen gaan precies zo.",
      },
    ],
  },
  "saint-valentin": {
    slug: "valentijnsdag",
    label: "Valentijnsdag",
    headline: (style) => `${style} voor Valentijnsdag`,
    intro:
      "Bloemen zijn na een week weg. Een portret van jullie samen, getekend vanaf een foto die iets betekent, blijft aan de muur hangen.",
    bullets: [
      "Begint bij jullie eigen foto — geen standaardillustratie.",
      "Werkt ook als jullie zelden samen op de foto staan: lever twee losse foto's aan.",
      "De digitale versie komt per e-mail, dus de verrassing blijft heel.",
    ],
    faq: [
      {
        question: "Kunnen we met z'n tweeën op het portret?",
        answer:
          "Ja, dat is de meest gevraagde variant. Twee losse foto's volstaan; de tekenaar zet jullie samen in beeld.",
      },
      {
        question: "Wanneer moet ik uiterlijk bestellen voor 14 februari?",
        answer:
          "Voor een print ongeveer 5 werkdagen van tevoren. Voor de digitale versie volstaan 2 dagen.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "moederdag",
    label: "Moederdag",
    headline: (style) => `${style} voor Moederdag`,
    intro:
      "Moederdag valt niet overal op dezelfde dag — in Nederland en België op de tweede zondag van mei. Een getekend portret van de kinderen, of van het hele gezin, is een cadeau dat ze echt ophangt.",
    bullets: [
      "Met de kinderen erop, of het hele gezin samen.",
      "Huisdieren mogen mee — vaak is dat precies wat het portret maakt.",
      "Klaar in 2 dagen, dus ook haalbaar als je het bijna vergeten was.",
    ],
    faq: [
      {
        question: "Kunnen alleen de kinderen erop staan?",
        answer:
          "Ja. Veel bestellingen zijn precies dat: alleen de kinderen, getekend in de stijl die zij zelf leuk vinden.",
      },
      {
        question: "Wanneer is Moederdag?",
        answer:
          "In Nederland en België op de tweede zondag van mei. De uiterste besteldatum staat rond die periode op de site.",
      },
    ],
  },
  mariage: {
    slug: "huwelijkscadeau",
    label: "een bruiloft",
    headline: (style) => `${style} als huwelijkscadeau`,
    intro:
      "Op een verlanglijst staat zelden iets persoonlijks. Een portret van het paar, getekend vanaf hun eigen foto, valt op tussen het servies en de enveloppen.",
    bullets: [
      "Persoonlijker dan wat er op de lijst staat.",
      "Werkt met een verlovingsfoto of met een foto van de dag zelf.",
      "Ook achteraf te geven, zodra de trouwfoto's binnen zijn.",
    ],
    faq: [
      {
        question: "Kan ik het portret na de bruiloft bestellen?",
        answer:
          "Ja, en dat werkt vaak beter: je gebruikt dan een echte trouwfoto in plaats van een oudere.",
      },
      {
        question: "Kunnen getuigen of familie erbij?",
        answer:
          "Ja, je kunt extra personen toevoegen. Lever van iedereen een aparte, duidelijke foto aan voor een scherp resultaat.",
      },
    ],
  },
  depart: {
    slug: "afscheidscadeau",
    label: "een afscheid",
    headline: (style) => `${style} als afscheidscadeau`,
    intro:
      "Een collega die weggaat krijgt meestal een kaart en een bos bloemen. Een getekend portret — van die persoon of van het hele team — is wat er straks op het nieuwe bureau blijft staan.",
    bullets: [
      "Van één collega of van het hele team.",
      "Iedereen kan meebetalen: één bestelling, één cadeau.",
      "In 2 dagen klaar, ook als het afscheid snel geregeld moet worden.",
    ],
    faq: [
      {
        question: "Kan het hele team op het portret?",
        answer:
          "Ja. Reken op een duidelijke foto per persoon; een groepsfoto van veraf geeft een minder scherp resultaat.",
      },
      {
        question: "Kunnen we er een boodschap bij doen?",
        answer:
          "Je kunt bij de bestelling een notitie achterlaten met wat je graag wilt. De tekenaar houdt daar rekening mee.",
      },
    ],
  },
};

/* Polonais. Le marche polonais achete en ligne massivement et compare
   beaucoup : le texte y est plus concret et moins lyrique qu'en francais.
   « Na zamowienie » — sur commande — est la formule qui signale le sur-mesure,
   comme « laten tekenen » en neerlandais. */
const pl: OccasionTable = {
  anniversaire: {
    slug: "urodziny",
    label: "urodziny",
    headline: (style) => `${style} na urodziny`,
    intro:
      "Urodziny wracają co roku i na tym polega problem: w pewnym momencie pomysły się kończą. Ręcznie rysowany portret wyróżnia się dlatego, że nie da się go podarować dwa razy — powstaje z jednego konkretnego zdjęcia, tej jednej osoby.",
    bullets: [
      "Nikt inny nie podaruje tego samego: rysunek powstaje z Twojego zdjęcia.",
      "Zawiśnie na ścianie, w przeciwieństwie do większości prezentów urodzinowych.",
      "Rysunek jest gotowy w 2 dni, więc spóźnialscy też zdążą.",
    ],
    faq: [
      {
        question: "Z jakim wyprzedzeniem zamówić portret na urodziny?",
        answer:
          "Wersja cyfrowa: 2 dni. Plakat lub obraz na płótnie: około 5 dni roboczych od zamówienia do odbioru — 2 dni rysowania, potem 3 dni robocze na druk i wysyłkę.",
      },
      {
        question: "Czy na portrecie może być kilka osób?",
        answer:
          "Tak. Możesz dodać kolejne osoby i zwierzęta. Najlepiej przesłać ostre zdjęcie każdej osoby osobno, zamiast jednego zdjęcia grupowego z daleka.",
      },
    ],
  },
  noel: {
    slug: "prezent-na-swieta",
    label: "Święta",
    headline: (style) => `${style} na prezent świąteczny`,
    intro:
      "W Święta problemem nie jest znalezienie prezentu, tylko znalezienie takiego, który w styczniu nie wyląduje w szafie. Ręcznie rysowany portret rodzinny się wiesza — i przypomina o konkretnym roku.",
    bullets: [
      "Prezent, który rozpakowuje się przy wszystkich i o którym się rozmawia.",
      "Idealny dla rodziców i dziadków, którzy „niczego nie potrzebują”.",
      "Wersja cyfrowa jest możliwa do ostatniej chwili.",
    ],
    faq: [
      {
        question: "Do kiedy zamówić, żeby zdążyć przed Świętami?",
        answer:
          "Ostateczny termin pojawia się na stronie w okresie świątecznym. W praktyce: około 5 dni roboczych na wydruk z dostawą, 2 dni na wersję cyfrową.",
      },
      {
        question: "Czy mogę podarować portret, którego jeszcze nie mam?",
        answer:
          "Tak: wręcz wersję cyfrową w dniu Świąt, a wydruk zamów z dostawą później. Wiele zamówień na ostatnią chwilę wygląda właśnie tak.",
      },
    ],
  },
  "saint-valentin": {
    slug: "walentynki",
    label: "Walentynki",
    headline: (style) => `${style} na Walentynki`,
    intro:
      "Kwiaty znikają po tygodniu. Portret we dwoje, narysowany z Waszego zdjęcia, zostaje na ścianie.",
    bullets: [
      "Powstaje z Waszego własnego zdjęcia — żadnej gotowej ilustracji.",
      "Działa nawet, jeśli rzadko jesteście razem na zdjęciach: wystarczą dwa osobne.",
      "Wersja cyfrowa przychodzi mailem, więc niespodzianka zostaje niespodzianką.",
    ],
    faq: [
      {
        question: "Czy na portrecie możemy być we dwoje?",
        answer:
          "Tak, to najczęściej zamawiany wariant. Wystarczą dwa osobne zdjęcia — rysownik połączy Was w jednym kadrze.",
      },
      {
        question: "Do kiedy zamówić na 14 lutego?",
        answer: "Na wydruk: około 5 dni roboczych wcześniej. Na wersję cyfrową wystarczą 2 dni.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "dzien-matki",
    label: "Dzień Matki",
    headline: (style) => `${style} na Dzień Matki`,
    intro:
      "Dzień Matki w Polsce wypada 26 maja — nie wszędzie tego samego dnia. Narysowany portret dzieci albo całej rodziny to prezent, który naprawdę zawiśnie na ścianie.",
    bullets: [
      "Z dziećmi albo z całą rodziną.",
      "Zwierzęta też mogą się znaleźć — często to one robią cały portret.",
      "Gotowy w 2 dni, więc zdążysz nawet jeśli prawie zapomniałeś.",
    ],
    faq: [
      {
        question: "Czy na portrecie mogą być same dzieci?",
        answer:
          "Tak. Wiele zamówień wygląda dokładnie tak: same dzieci, w stylu, który same lubią.",
      },
      {
        question: "Kiedy wypada Dzień Matki?",
        answer:
          "W Polsce 26 maja. Ostateczny termin zamówienia pojawia się na stronie w tym okresie.",
      },
    ],
  },
  mariage: {
    slug: "prezent-slubny",
    label: "ślub",
    headline: (style) => `${style} na prezent ślubny`,
    intro:
      "Na liście prezentów rzadko trafia się coś osobistego. Portret pary, narysowany z jej własnego zdjęcia, wyróżnia się wśród zastawy i kopert.",
    bullets: [
      "Bardziej osobisty niż to, co jest na liście.",
      "Działa ze zdjęciem zaręczynowym albo ze zdjęciem z samego ślubu.",
      "Można podarować też później, gdy zdjęcia ślubne będą gotowe.",
    ],
    faq: [
      {
        question: "Czy mogę zamówić portret po ślubie?",
        answer:
          "Tak, i często wychodzi lepiej: używasz wtedy prawdziwego zdjęcia ślubnego zamiast starszego.",
      },
      {
        question: "Czy świadkowie albo rodzina mogą się znaleźć na portrecie?",
        answer:
          "Tak, można dodać kolejne osoby. Dla ostrego efektu prześlij osobne, wyraźne zdjęcie każdej z nich.",
      },
    ],
  },
  depart: {
    slug: "prezent-pozegnalny",
    label: "pożegnanie",
    headline: (style) => `${style} na prezent pożegnalny`,
    intro:
      "Odchodzący współpracownik dostaje zwykle kartkę i kwiaty. Narysowany portret — jego samego albo całego zespołu — to coś, co zostaje potem na nowym biurku.",
    bullets: [
      "Jednej osoby albo całego zespołu.",
      "Każdy może się dorzucić: jedno zamówienie, jeden prezent.",
      "Gotowy w 2 dni, także gdy pożegnanie trzeba zorganizować szybko.",
    ],
    faq: [
      {
        question: "Czy na portrecie może być cały zespół?",
        answer:
          "Tak. Przygotuj wyraźne zdjęcie każdej osoby; zdjęcie grupowe z daleka daje słabszy efekt.",
      },
      {
        question: "Czy możemy dołączyć wiadomość?",
        answer:
          "Przy zamówieniu możesz zostawić notatkę z tym, czego oczekujesz. Rysownik weźmie ją pod uwagę.",
      },
    ],
  },
};

/* Suedois. Ton sobre et direct, tutoiement systematique, aucune emphase — le
   superlatif francais y sonne comme de la vente forcee. Les dates aussi
   different : la fete des meres suedoise tombe le dernier dimanche de mai,
   pas le deuxieme. */
const sv: OccasionTable = {
  anniversaire: {
    slug: "fodelsedag",
    label: "en födelsedag",
    headline: (style) => `${style} till en födelsedag`,
    intro:
      "En födelsedag kommer tillbaka varje år, och det är just problemet: till slut har man gett allt. Ett handritat porträtt sticker ut för att det inte går att ge två gånger — det utgår från ett bestämt foto, av just den personen.",
    bullets: [
      "Ingen annan kan ge samma sak: teckningen utgår från ditt foto.",
      "Det hamnar på väggen, till skillnad från de flesta födelsedagspresenter.",
      "Teckningen är klar på 2 dagar, så även sena beställningar hinner fram.",
    ],
    faq: [
      {
        question: "Hur långt i förväg behöver jag beställa till en födelsedag?",
        answer:
          "Digital version: räkna med 2 dagar. Affisch eller canvas: ungefär 5 arbetsdagar från beställning till leverans — 2 dagar för teckningen, sedan 3 arbetsdagar för tryck och frakt.",
      },
      {
        question: "Kan flera personer vara med på porträttet?",
        answer:
          "Ja. Du kan lägga till fler personer och husdjur. Skicka hellre ett skarpt foto på varje person än ett gruppfoto taget på avstånd.",
      },
    ],
  },
  noel: {
    slug: "julklapp",
    label: "julen",
    headline: (style) => `${style} som julklapp`,
    intro:
      "Till jul är problemet inte att hitta en present, utan att hitta en som inte ligger i en låda i januari. Ett handritat familjeporträtt hänger man upp, och det påminner om ett bestämt år.",
    bullets: [
      "En present som packas upp inför alla och som det pratas om.",
      "Perfekt för föräldrar eller mor- och farföräldrar som ”inte behöver något”.",
      "Den digitala versionen går att beställa in i det sista.",
    ],
    faq: [
      {
        question: "Hur sent kan jag beställa och ändå få det till jul?",
        answer:
          "Sista beställningsdag visas på sidan under julperioden. I praktiken: ungefär 5 arbetsdagar för ett tryck med leverans, 2 dagar för den digitala versionen.",
      },
      {
        question: "Kan jag ge bort ett porträtt som inte hunnit fram?",
        answer:
          "Ja: ge den digitala versionen på julafton och låt trycket komma efteråt. Många sena beställningar går till precis så.",
      },
    ],
  },
  "saint-valentin": {
    slug: "alla-hjartans-dag",
    label: "alla hjärtans dag",
    headline: (style) => `${style} till alla hjärtans dag`,
    intro:
      "Blommor är borta efter en vecka. Ett porträtt på er två, ritat efter ett foto som betyder något, blir kvar på väggen.",
    bullets: [
      "Utgår från ert eget foto — ingen färdig illustration.",
      "Fungerar även om ni sällan är med på samma bild: skicka två separata foton.",
      "Den digitala versionen kommer via mejl, så överraskningen håller.",
    ],
    faq: [
      {
        question: "Kan vi vara två på porträttet?",
        answer:
          "Ja, det är den vanligaste varianten. Två separata foton räcker — tecknaren sätter ihop er i samma bild.",
      },
      {
        question: "När senast behöver jag beställa till den 14 februari?",
        answer: "Till ett tryck: ungefär 5 arbetsdagar innan. Till den digitala versionen räcker 2 dagar.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "mors-dag",
    label: "mors dag",
    headline: (style) => `${style} till mors dag`,
    intro:
      "Mors dag infaller inte samtidigt överallt — i Sverige den sista söndagen i maj. Ett ritat porträtt på barnen, eller på hela familjen, är en present som faktiskt hängs upp.",
    bullets: [
      "Med barnen, eller med hela familjen.",
      "Husdjur får vara med — ofta är det de som gör porträttet.",
      "Klart på 2 dagar, så det hinns med även om du nästan glömde bort det.",
    ],
    faq: [
      {
        question: "Kan bara barnen vara med?",
        answer:
          "Ja. Många beställningar ser ut precis så: bara barnen, i den stil de själva gillar.",
      },
      {
        question: "När är mors dag?",
        answer:
          "I Sverige den sista söndagen i maj. Sista beställningsdag visas på sidan under den perioden.",
      },
    ],
  },
  mariage: {
    slug: "brollopspresent",
    label: "ett bröllop",
    headline: (style) => `${style} som bröllopspresent`,
    intro:
      "På en önskelista står sällan något personligt. Ett porträtt på paret, ritat efter deras eget foto, sticker ut bland porslinet och kuverten.",
    bullets: [
      "Mer personligt än det som står på listan.",
      "Fungerar med ett förlovningsfoto eller med ett foto från dagen.",
      "Går även att ge i efterhand, när bröllopsbilderna är klara.",
    ],
    faq: [
      {
        question: "Kan jag beställa porträttet efter bröllopet?",
        answer:
          "Ja, och det blir ofta bättre: då använder du ett riktigt bröllopsfoto i stället för ett äldre.",
      },
      {
        question: "Kan vittnen eller familj vara med?",
        answer:
          "Ja, du kan lägga till fler personer. Skicka ett separat, tydligt foto på var och en för ett skarpt resultat.",
      },
    ],
  },
  depart: {
    slug: "avskedspresent",
    label: "ett avsked",
    headline: (style) => `${style} som avskedspresent`,
    intro:
      "En kollega som slutar får oftast ett kort och en bukett. Ett ritat porträtt — på personen eller på hela teamet — är det som blir kvar på det nya skrivbordet.",
    bullets: [
      "På en kollega eller på hela teamet.",
      "Alla kan vara med och dela: en beställning, en present.",
      "Klart på 2 dagar, även när avskedet ordnas snabbt.",
    ],
    faq: [
      {
        question: "Kan hela teamet vara med på porträttet?",
        answer:
          "Ja. Räkna med ett tydligt foto per person; ett gruppfoto på avstånd ger ett sämre resultat.",
      },
      {
        question: "Kan vi lägga till en hälsning?",
        answer:
          "Du kan lämna en notering i beställningen med vad du önskar. Tecknaren tar hänsyn till den.",
      },
    ],
  },
};

/* Danois. Meme registre sobre que le suedois, avec un danois plus familier
   encore — le superlatif y sonne faux. La fete des meres danoise tombe le
   deuxieme dimanche de mai, contrairement a la suedoise. */
const da: OccasionTable = {
  anniversaire: {
    slug: "fodselsdag",
    label: "en fødselsdag",
    headline: (style) => `${style} til en fødselsdag`,
    intro:
      "En fødselsdag kommer igen hvert år, og det er lige præcis problemet: på et tidspunkt har man givet det hele. Et håndtegnet portræt skiller sig ud, fordi det ikke kan gives to gange — det tager udgangspunkt i ét bestemt foto, af netop den person.",
    bullets: [
      "Ingen andre kan give det samme: tegningen tager udgangspunkt i dit foto.",
      "Det ender på væggen, i modsætning til de fleste fødselsdagsgaver.",
      "Tegningen er klar på 2 dage, så sene bestillinger når det også.",
    ],
    faq: [
      {
        question: "Hvor lang tid før skal jeg bestille til en fødselsdag?",
        answer:
          "Digital version: regn med 2 dage. Plakat eller lærred: cirka 5 hverdage fra bestilling til levering — 2 dage til tegningen og derefter 3 hverdage til tryk og forsendelse.",
      },
      {
        question: "Kan der være flere personer på portrættet?",
        answer:
          "Ja. Du kan tilføje flere personer og kæledyr. Send hellere et skarpt foto af hver person end ét gruppefoto taget på afstand.",
      },
    ],
  },
  noel: {
    slug: "julegave",
    label: "julen",
    headline: (style) => `${style} som julegave`,
    intro:
      "Til jul er problemet ikke at finde en gave, men at finde en der ikke ligger i et skab i januar. Et håndtegnet familieportræt hænger man op, og det minder om et bestemt år.",
    bullets: [
      "En gave, der pakkes op foran alle, og som der bliver snakket om.",
      "Perfekt til forældre eller bedsteforældre, der ”ikke mangler noget”.",
      "Den digitale version kan bestilles helt til sidst.",
    ],
    faq: [
      {
        question: "Hvor sent kan jeg bestille og stadig nå det til jul?",
        answer:
          "Sidste bestillingsdag står på siden i juleperioden. I praksis: cirka 5 hverdage til et tryk med levering, 2 dage til den digitale version.",
      },
      {
        question: "Kan jeg give et portræt, der ikke er nået frem?",
        answer:
          "Ja: giv den digitale version juleaften og lad trykket komme bagefter. Mange sene bestillinger foregår præcis sådan.",
      },
    ],
  },
  "saint-valentin": {
    slug: "valentinsdag",
    label: "valentinsdag",
    headline: (style) => `${style} til valentinsdag`,
    intro:
      "Blomster er væk efter en uge. Et portræt af jer to, tegnet efter et foto der betyder noget, bliver hængende på væggen.",
    bullets: [
      "Tager udgangspunkt i jeres eget foto — ingen færdig illustration.",
      "Virker også, hvis I sjældent er på billede sammen: send to separate fotos.",
      "Den digitale version kommer på mail, så overraskelsen holder.",
    ],
    faq: [
      {
        question: "Kan vi være to på portrættet?",
        answer:
          "Ja, det er den mest bestilte variant. To separate fotos er nok — tegneren sætter jer sammen i ét billede.",
      },
      {
        question: "Hvornår skal jeg senest bestille til 14. februar?",
        answer: "Til et tryk: cirka 5 hverdage før. Til den digitale version er 2 dage nok.",
      },
    ],
  },
  "fete-des-meres": {
    slug: "mors-dag",
    label: "mors dag",
    headline: (style) => `${style} til mors dag`,
    intro:
      "Mors dag falder ikke samme dag alle steder — i Danmark den anden søndag i maj. Et tegnet portræt af børnene, eller af hele familien, er en gave der rent faktisk bliver hængt op.",
    bullets: [
      "Med børnene, eller med hele familien.",
      "Kæledyr må gerne være med — ofte er det dem, der gør portrættet.",
      "Klar på 2 dage, så det kan nås, selv hvis du næsten havde glemt det.",
    ],
    faq: [
      {
        question: "Kan det være børnene alene?",
        answer:
          "Ja. Mange bestillinger ser præcis sådan ud: kun børnene, i den stil de selv kan lide.",
      },
      {
        question: "Hvornår er mors dag?",
        answer:
          "I Danmark den anden søndag i maj. Sidste bestillingsdag står på siden omkring den periode.",
      },
    ],
  },
  mariage: {
    slug: "bryllupsgave",
    label: "et bryllup",
    headline: (style) => `${style} som bryllupsgave`,
    intro:
      "På en ønskeliste står der sjældent noget personligt. Et portræt af parret, tegnet efter deres eget foto, skiller sig ud mellem stellet og kuverterne.",
    bullets: [
      "Mere personligt end det, der står på listen.",
      "Virker med et forlovelsesfoto eller med et foto fra dagen.",
      "Kan også gives bagefter, når bryllupsbillederne er klar.",
    ],
    faq: [
      {
        question: "Kan jeg bestille portrættet efter brylluppet?",
        answer:
          "Ja, og det bliver ofte bedre: så bruger du et rigtigt bryllupsfoto i stedet for et ældre.",
      },
      {
        question: "Kan forlovere eller familie være med?",
        answer:
          "Ja, du kan tilføje flere personer. Send et separat, tydeligt foto af hver enkelt for et skarpt resultat.",
      },
    ],
  },
  depart: {
    slug: "afskedsgave",
    label: "en afsked",
    headline: (style) => `${style} som afskedsgave`,
    intro:
      "En kollega der stopper får som regel et kort og en buket. Et tegnet portræt — af personen eller af hele teamet — er det, der bliver stående på det nye skrivebord.",
    bullets: [
      "Af én kollega eller af hele teamet.",
      "Alle kan være med til at betale: én bestilling, én gave.",
      "Klar på 2 dage, også når afskeden skal arrangeres hurtigt.",
    ],
    faq: [
      {
        question: "Kan hele teamet være med på portrættet?",
        answer:
          "Ja. Regn med ét tydeligt foto per person; et gruppefoto på afstand giver et dårligere resultat.",
      },
      {
        question: "Kan vi lægge en hilsen ved?",
        answer:
          "Du kan skrive en note i bestillingen med det, du gerne vil. Tegneren tager højde for den.",
      },
    ],
  },
};

export const OCCASIONS: Record<Locale, OccasionTable> = { fr, en, es, de, it, nl, pl, sv, da };

export interface GiftPageParams {
  styleSlug: string;
  occasion: OccasionKey;
}

/**
 * Slug complet d'une page, propre a la langue : « simpson-anniversaire ».
 *
 * La base est le slug du style dans cette langue, pas son slug canonique.
 * Sans effet sur les six styles servis aujourd'hui — ce sont des noms de
 * marque, identiques partout. Ca compte le jour ou les pages cadeau
 * s'etendront aux fiches au nom francais : « custom-naruto-portrait-birthday »
 * plutot que « portrait-naruto-personnalise-birthday ».
 */
export function buildGiftSlug(locale: Locale, styleSlug: string, occasion: OccasionKey): string {
  const produit = produitParSlug(styleSlug);
  const base = produit ? slugProduit(produit, locale) : styleSlug;
  return `${base}-${OCCASIONS[locale][occasion].slug}`;
}

/** Retrouve le couple style/occasion a partir d'un slug d'URL. */
export function parseGiftSlug(locale: Locale, slug: string): GiftPageParams | null {
  for (const product of GIFT_PRODUCTS) {
    for (const occasion of OCCASION_KEYS) {
      if (buildGiftSlug(locale, product.slug, occasion) === slug) {
        return { styleSlug: product.slug, occasion };
      }
    }
  }
  return null;
}

export function allGiftSlugs(locale: Locale): string[] {
  return GIFT_PRODUCTS.flatMap((product) =>
    OCCASION_KEYS.map((occasion) => buildGiftSlug(locale, product.slug, occasion))
  );
}
