import type { OccasionKey } from "./giftOccasions";

export interface GiftPilot {
  intro: string;
  reasons: [string, string];
  imageAlt: string;
  imageCaption: string;
  photo: string;
  decor: string;
  composition: string;
  faq: { question: string; answer: string }[];
}

// Six pages existantes, une seule occasion, FR uniquement. Aucun cas client
// anniversaire documenté : les compositions ci-dessous sont des suggestions.
const BIRTHDAY_PILOTS: Record<string, GiftPilot> = {
  simpson: {
    intro: "Pour l’anniversaire d’un amateur des Simpson, pars d’une scène de sa vie quotidienne : le canapé où vous regardez la série, une sortie à deux ou une réunion de famille. Les silhouettes jaunes et les contours francs donnent le ton ; la coiffure, la barbe et les accessoires aident à reconnaître la personne.",
    reasons: ["Un décor de salon pour une scène familière, ou la plage pour rappeler des vacances.", "Un chapeau ou une paire de lunettes habituelle rend le personnage plus personnel."],
    imageAlt: "Montage du catalogue : couple dessiné en jaune dans un cadre noir et photo en bas à gauche",
    imageCaption: "Le montage montre deux personnages jaunes dans un intérieur rose, avec une photo de couple en bas à gauche.",
    photo: "Choisis un visage net, de face ou de trois quarts, avec la ligne des cheveux et la barbe visibles. Si le chapeau fait partie de son allure, joins une photo où il ne masque pas les yeux. Une photo séparée par personne sera plus lisible qu’un groupe pris de loin.",
    decor: "Compare le canapé, la maison et la plage dans le configurateur Simpson. Le canapé convient à une scène centrée sur les personnages ; la maison donne plus de place au lieu. Évite de multiplier les accessoires si tu veux que le visage reste le point d’attention.",
    composition: "Pour un anniversaire en famille, suggère la personne fêtée au centre du canapé et ses proches de chaque côté. Précise qui doit être au premier plan et quels accessoires conserver. Cette idée est un brief possible, pas une scène représentée sur le visuel.",
    faq: [
      { question: "Quelle photo choisir pour garder une barbe ou un chapeau en style Simpson ?", answer: "Envoie une photo nette montrant le contour de la barbe et la forme du chapeau. Ajoute une vue sans chapeau si les yeux sont dans l’ombre ; indique les détails à conserver dans tes instructions." },
      { question: "Canapé ou plage pour un anniversaire Simpson ?", answer: "Le canapé évoque un moment à la maison ; la plage peut rappeler un voyage commun. Regarde les décors disponibles sur la fiche Simpson avant de choisir, puis limite les accessoires pour garder les personnages lisibles." },
    ],
  },
  onepiece: {
    intro: "Pour un anniversaire One Piece, l’affiche Wanted met le destinataire dans le rôle du pirate recherché. Prépare d’abord le portrait et les éléments de texte souhaités : un surnom facile à lire sera plus utile qu’une longue dédicace noyée dans l’affiche.",
    reasons: ["Le format Wanted donne une direction claire à un portrait de fan de pirates.", "Un surnom et une référence partagée peuvent guider le brief de l’affiche."],
    imageAlt: "Affiche encadrée Wanted avec deux personnages sur un bateau et une photo ronde de couple",
    imageCaption: "L’affiche du catalogue porte les mots Wanted et Him & Her ; deux personnages se tiennent sur un bateau. Une photo ronde apparaît à gauche.",
    photo: "Privilégie une photo où les yeux, le nez et la bouche sont bien visibles. Si tu souhaites une pose en pied, ajoute une vue montrant la tenue, sans remplacer le gros plan du visage. Pour un duo de pirates, fournis une référence nette de chacun.",
    decor: "L’affiche existante associe papier ancien et pont de bateau. Sur la fiche One Piece, vérifie la présentation proposée ; ne pars pas du principe qu’un lieu personnalisé est inclus. Si tu souhaites une île ou un autre bateau, demande confirmation avant de commander.",
    composition: "Imagine une affiche solo avec le surnom du destinataire comme élément central. Note séparément le nom souhaité et toute indication de prime fictive, puis fais confirmer les possibilités de texte. Garde ton message d’anniversaire sur une carte si le texte surcharge le portrait.",
    faq: [
      { question: "Quel surnom préparer pour une affiche Wanted d’anniversaire ?", answer: "Choisis un surnom court que le destinataire reconnaîtra. Recopie son orthographe exacte et fais confirmer les possibilités de personnalisation du texte ; le visuel du catalogue ne garantit pas toutes les modifications souhaitées." },
      { question: "Faut-il porter un costume de pirate sur la photo One Piece ?", answer: "Pour préparer le visage, une photo quotidienne nette est plus utile qu’un costume qui cache les traits. Si une tenue particulière compte pour toi, joins sa référence et décris-la dans le brief, sous réserve de confirmation." },
    ],
  },
  dbz: {
    intro: "Pour l’anniversaire d’un fan de Dragon Ball Z, choisis entre un portrait de combattant énergique et une pose plus calme. Une aura très présente change l’équilibre de l’image : décide si tu veux surtout montrer le visage, la tenue ou la posture.",
    reasons: ["Une pose de combattant pour un cadeau centré sur l’énergie du personnage.", "Le choix du cadrage permet de privilégier l’expression ou la tenue."],
    imageAlt: "Montage DBZ : personnage debout dans une aura rouge et photo de visage tenue devant le cadre",
    imageCaption: "Le visuel du catalogue montre un personnage en pantalon blanc au milieu d’une aura rouge et de rochers en suspension ; une photo est présentée devant le cadre.",
    photo: "Pour une pose debout, joins une photo du corps entier et un portrait rapproché. Les mains et les pieds doivent rester dans le cadre si tu veux reprendre leur position. Une lumière uniforme sur le visage évite de perdre les traits dans les ombres.",
    decor: "Consulte les huit décors proposés sur la fiche DBZ. Compare leur contraste avec la couleur de tenue souhaitée : un fond chargé et une aura intense peuvent se concurrencer. Le montage rouge montré ici sert de repère visuel, pas de liste des options incluses.",
    composition: "Suggère un combattant seul, en pied, avec un cadrage assez large autour des mains. Indique si l’aura doit attirer l’œil ou rester secondaire. Pour un clin d’œil à l’âge, préfère une carte jointe plutôt que de supposer qu’un nombre sera ajouté au dessin.",
    faq: [
      { question: "Quelle référence envoyer pour une posture de combattant DBZ ?", answer: "Associe une vue en pied où les membres sont visibles et une photo rapprochée du visage. Distingue la pose à reprendre de la tenue souhaitée ; une seule photo sombre ou recadrée ne renseigne pas les deux." },
      { question: "Comment éviter qu’une aura DBZ masque le portrait d’anniversaire ?", answer: "Dans tes instructions, précise que le visage doit rester lisible et que l’aura doit entourer la silhouette. Vérifie les décors sur la fiche et fais confirmer tout effet particulier au lieu de le déduire du montage présenté." },
    ],
  },
  ghibli: {
    intro: "Pour un anniversaire dans une ambiance Ghibli, pars d’un souvenir de promenade ou d’un moment en famille. La lumière du lieu et la relation entre les personnes comptent autant que leurs visages : prépare une référence qui explique ce que tu veux retrouver dans la scène.",
    reasons: ["Une ambiance de promenade pour évoquer un souvenir plutôt qu’une pose de studio.", "Un cadrage familial où les gestes entre proches restent visibles."],
    imageAlt: "Montage du catalogue : deux adultes et un enfant dessinés dans une lumière dorée et photo ronde",
    imageCaption: "Le montage montre deux adultes et un enfant dans une lumière de coucher de soleil ; une photo ronde de trois personnes est placée en bas à droite.",
    photo: "Pour un enfant porté sur les épaules ou dans les bras, choisis une photo où son visage et celui de l’adulte sont nets. Ajoute des portraits séparés si l’un est tourné. Garde aussi une vue large pour expliquer le geste entre les personnes.",
    decor: "Le visuel existant privilégie une lumière dorée et un horizon dégagé. Pour ton brief, distingue l’ambiance souhaitée du lieu exact : jardin, chemin ou souvenir de voyage. La fiche Ghibli ne propose pas de galerie de décors prédéfinis ; fais confirmer une demande de lieu spécifique.",
    composition: "Pour fêter un parent, suggère une scène de promenade avec l’enfant à ses côtés et une lumière de fin de journée. Précise les personnes à réunir et le geste important. Il s’agit d’une piste de composition, pas d’une commande familiale dont nous racontons l’histoire.",
    faq: [
      { question: "Comment préparer une scène familiale Ghibli avec un enfant porté ?", answer: "Fournis une vue montrant la position de l’enfant et des portraits nets de chaque visage. Indique qui porte qui : le geste est difficile à comprendre à partir de photos de visages seules." },
      { question: "Peut-on choisir un paysage précis pour un anniversaire Ghibli ?", answer: "La fiche ne présente pas de décors prédéfinis à sélectionner. Décris le lieu et joins une référence si nécessaire, puis fais confirmer sa faisabilité et les conditions avant de commander." },
    ],
  },
  disney: {
    intro: "Pour un anniversaire en style Disney, un portrait à deux peut mettre l’accent sur les expressions et la complicité. Choisis une photo qui ressemble au destinataire au quotidien ; une tenue de conte n’est pas nécessaire pour préparer un visage reconnaissable.",
    reasons: ["Des expressions souriantes pour un portrait de couple ou de proches.", "Une tenue quotidienne peut servir de point de départ au brief."],
    imageAlt: "Illustration du catalogue : deux personnages souriants devant un paysage urbain et petite photo en bas à gauche",
    imageCaption: "Le visuel présente un couple souriant, un homme barbu en haut gris et une femme aux cheveux longs, devant un paysage urbain ; une petite photo apparaît en bas à gauche.",
    photo: "Préfère des yeux visibles et un sourire naturel à un filtre qui lisse le visage. Pour deux personnes, évite qu’une joue ou une chevelure cache le visage de l’autre. Si vous n’avez pas de bonne photo ensemble, prépare deux portraits pris à hauteur des yeux.",
    decor: "Sur le visuel, le paysage urbain reste derrière les visages. Tu peux t’en inspirer pour demander une ambiance douce, sans supposer qu’un château ou un décor de film est inclus. La fiche Disney n’a pas de sélection de décors prédéfinis ; fais préciser les possibilités d’un fond particulier.",
    composition: "Pour l’anniversaire de ton partenaire, suggère un portrait rapproché à deux avec vos vêtements habituels. Note le sourire et les détails de coiffure à conserver. Un fond discret laissera plus de place aux expressions qu’une accumulation de références de contes.",
    faq: [
      { question: "Faut-il une tenue de princesse pour un portrait d’anniversaire Disney ?", answer: "Une tenue quotidienne suffit pour fournir une référence du visage et de l’allure. Si tu souhaites un costume différent, décris-le séparément et fais confirmer cette demande avant l’achat." },
      { question: "Comment choisir les expressions pour un duo en style Disney ?", answer: "Choisis une photo où chacun a les yeux visibles et une expression qui lui ressemble. Tu peux fournir deux photos distinctes et préciser le sourire à retenir, plutôt qu’une photo commune où un visage est caché." },
    ],
  },
  rickandmorty: {
    intro: "Pour l’anniversaire d’un fan de Rick et Morty, le portail et les couleurs acides donnent une piste de scène décalée. Garde une priorité : la personne doit rester reconnaissable au milieu du décor. Prépare les visages avant de détailler les accessoires de science-fiction.",
    reasons: ["Un portail lumineux pour situer une aventure de science-fiction.", "Un duo et une posture expressive pour un clin d’œil partagé entre fans."],
    imageAlt: "Montage Rick et Morty : deux personnages devant un portail vert et deux photos rondes de visages",
    imageCaption: "Le montage du catalogue montre un personnage portant l’autre devant un portail vert, avec deux photos rondes de part et d’autre du cadre.",
    photo: "Si tu souhaites une grimace ou une expression étonnée, joins aussi une photo du visage au repos pour montrer ses traits. Pour une pose où une personne porte l’autre, ajoute une référence de la position entière : deux selfies seuls ne décrivent pas cette posture.",
    decor: "Le portail vert du montage attire fortement le regard. Pour le brief, garde une zone dégagée autour des têtes et limite les objets près des visages. La fiche Rick et Morty ne contient pas de sélection de décors prédéfinis ; demande confirmation pour un portail ou un environnement particulier.",
    composition: "Pour un anniversaire entre amis, suggère deux personnages surpris par un portail, avec un seul accessoire lié à votre plaisanterie commune. Décris la pose de chacun et ce qui doit rester lisible. Cette proposition ne correspond pas à un anniversaire client documenté.",
    faq: [
      { question: "Une grimace suffit-elle pour préparer un portrait Rick et Morty ?", answer: "Ajoute un portrait au repos, net et bien éclairé, à la photo de grimace. Les deux références permettent d’expliquer à la fois les traits de la personne et l’expression souhaitée." },
      { question: "Le portail vert est-il automatiquement inclus dans le cadeau Rick et Morty ?", answer: "Le portail figure sur l’illustration du catalogue, mais la fiche ne propose pas de galerie de décors à sélectionner. Fais confirmer le fond souhaité et ses conditions avant de commander ; le montage seul ne prouve pas son inclusion." },
    ],
  },
};

export function giftPilot(locale: string, style: string, occasion: OccasionKey): GiftPilot | null {
  return locale === "fr" && occasion === "anniversaire" ? BIRTHDAY_PILOTS[style] ?? null : null;
}
