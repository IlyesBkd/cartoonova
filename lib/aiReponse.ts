import type { DbOrder, OrderOptions, SupportReply } from "./db";
import { decrireSupport, estPhysique } from "./supportCommande";
import { lireConsigne } from "./consigneClient";
import { getLangFromCountry, type Lang } from "./email-i18n";

/**
 * Rediger le brouillon d'une reponse au support.
 *
 * ── Pourquoi un brouillon et pas un envoi automatique ────────────────────
 *
 * Parce qu'un modele qui se trompe sur une date d'expedition ou sur un
 * remboursement ne se trompe pas dans un journal : il se trompe dans la boite
 * du client, en notre nom, et la phrase devient une promesse. Le classement
 * des messages entrants peut se permettre l'autonomie — au pire un spam
 * remonte dans la liste. Une reponse sortante, non. Le texte rendu ici
 * s'affiche dans un champ modifiable ; rien ne part sans un clic.
 *
 * ── Pourquoi la fiche de commande est jointe ─────────────────────────────
 *
 * La moitie des messages recus sont « ou en est ma commande ? ». Y repondre
 * demande le statut, le support, la date, le suivi — quatre informations que
 * la synchro IMAP rattache DEJA au message par `order_id`, et qu'il fallait
 * jusqu'ici aller rechercher a la main dans un autre onglet. Les donner au
 * modele, c'est lui eviter la seule faute qu'on ne peut pas rattraper :
 * inventer un fait verifiable.
 */

/* Les faits que le site affiche publiquement, rassembles ici pour que le
   modele ne les reconstitue pas de memoire.

   Ils sont recopies de `messages/*.json`, de la FAQ et des CGV — trois
   endroits qui font foi vis-a-vis du client. Une reponse qui annoncerait
   « 5 jours » a quelqu'un qui a lu « 2 jours » sur la fiche produit cree le
   litige qu'elle etait censee eviter. */
const FAITS = `Faits Cartoonova (ils font foi, n'en invente aucun autre) :
- Le dessin est realise en 2 jours ouvres a compter du paiement ET de la reception des photos.
- Fichier numerique : envoye par e-mail des validation, sans delai de transport.
- Produit imprime (poster, poster encadre, toile) : 3 jours ouvres supplementaires de fabrication et de livraison. Taille unique 30x40 cm (12x16 in pour les Etats-Unis et le Canada).
- Retouches gratuites et illimitees jusqu'a satisfaction. Elles portent sur des ajustements raisonnables (ressemblance, couleurs, details), pas sur un changement complet de style ou d'une composition deja validee.
- Satisfait ou rembourse. Produit imprime endommage ou non conforme : signalement sous 14 jours apres reception, echange ou remboursement integral sous 14 jours.
- Les oeuvres etant personnalisees, le droit de retractation ne s'applique pas une fois le travail commence (article L221-28 du Code de la consommation).
- Les photos du client sont supprimees 90 jours apres la livraison.
- Le support repond sous 24 h ouvrees, a support@cartoonova.com.`;

const CONSIGNES = `Tu rediges la reponse du support de Cartoonova, une boutique qui cree des portraits cartoon personnalises a partir des photos du client.

REGLES ABSOLUES
1. Reponds DANS LA LANGUE DU MESSAGE RECU. Un message en anglais recoit une reponse en anglais, en allemand une reponse en allemand. Ne traduis jamais vers le francais. Quand aucun message n'a ete recu, ou qu'il est trop court pour trancher, ecris dans la langue indiquee plus bas.
2. N'affirme AUCUN fait qui ne figure pas dans la fiche de commande ou dans les faits ci-dessous. Pas de date d'expedition, de numero de suivi, de montant ni de delai inventes.
3. Quand il te manque une information pour repondre, ecris-la entre crochets et en majuscules a l'endroit exact ou elle manque : [A VERIFIER : date d'envoi du colis]. La personne qui relit la completera. Ne devine pas.
4. Si le client demande une retouche, accepte-la : elles sont gratuites et illimitees. Demande-lui precisement ce qu'il veut changer s'il ne l'a pas dit.
5. N'invente aucun geste commercial (remise, remboursement, cadeau, envoi offert). Si la situation semble en appeler un, ecris [DECISION : proposer un geste ?] et laisse la personne trancher.
6. Ne decris jamais la facon dont les portraits sont realises : pas de « dessine a la main », pas d'« artiste » ni d'« illustrateur », pas de nom d'outil ou de logiciel. Parle du portrait et de ce que le client recoit, et dis « nous » pour l'equipe.
7. Si le client demande explicitement comment son portrait est realise, ne reponds pas a sa place : ecris [DECISION : question sur la methode de realisation] et laisse la personne repondre.

TON
- Chaleureux et direct, comme une petite equipe qui repond elle-meme. Tutoiement ou vouvoiement : reprends celui du client (en francais, vouvoie par defaut).
- Court. Trois a huit lignes. Pas de formule d'attente (« nous avons bien recu votre message et vous en remercions »), pas de jargon.
- Reponds a la question posee des la premiere phrase.

FORME
- Texte brut uniquement. Pas de Markdown, pas de gras, pas de titre.
- N'ecris PAS de ligne « Objet : » — l'objet est ajoute automatiquement.
- Termine par une signature courte au nom de l'equipe Cartoonova, dans la langue de la reponse.
- Ne rends que le corps de l'e-mail, rien d'autre.`;

/* Le modele qui redige n'est pas celui qui trie.

   `classifySupportMessage` choisit entre trois mots et se contente d'un petit
   modele. Ici il faut ecrire a un client, dans sa langue, sans rien inventer :
   c'est l'ecart entre cocher une case et tenir la plume. Le nom reste une
   constante, donc une seule ligne a changer le jour ou un modele plus juste
   sort. */
const MODELE = "gpt-4o";

/* Le code ISO ne suffit pas a une consigne : « reponds en pl » se lit moins
   surement que « reponds en polonais ». */
const NOM_DE_LANGUE: Record<Lang, string> = {
  fr: "francais",
  en: "anglais",
  es: "espagnol",
  de: "allemand",
  it: "italien",
  nl: "neerlandais",
  pl: "polonais",
  sv: "suedois",
  da: "danois",
  pt: "portugais",
};

function formaterDate(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
}

/**
 * La commande telle qu'elle doit etre lue par quelqu'un qui redige.
 *
 * Volontairement en francais et en clair, pas en JSON : le libelle du support
 * est deja traduit dans la langue du client en base (« Portret na płótnie »),
 * et `decrireSupport` est le seul endroit qui sait le ramener a quelque chose
 * de lisible. Passer `options` brut au modele, c'est lui demander de deviner
 * ce qu'on a mis cinquante lignes a rendre certain.
 */
export function ficheCommande(order: DbOrder): string {
  const options: OrderOptions | null =
    typeof order.options === "string" ? JSON.parse(order.options) : order.options;
  const support = decrireSupport(options);
  const consigne = lireConsigne(options?.description);

  const lignes: string[] = [
    `Reference : ${order.id.slice(0, 8)}`,
    `Passee le : ${formaterDate(order.created_at) ?? "date inconnue"}`,
    `Client : ${order.customer_name || "nom non renseigne"} (${order.customer_email})`,
    `Montant paye : ${order.total_price} ${order.currency || "EUR"}`,
    `Statut interne : ${order.status}`,
    `Support : ${support.libelle}${support.taille ? ` — ${support.taille}` : ""}${support.detail ? ` (${support.detail})` : ""}`,
  ];

  if (options?.style) lignes.push(`Style demande : ${options.style}`);
  if (options?.format) lignes.push(`Format : ${options.format}`);
  if (options?.people) lignes.push(`Personnes a dessiner : ${options.people}`);
  if (options?.animals) lignes.push(`Animaux a dessiner : ${options.animals}`);
  if (consigne.texte) lignes.push(`Consigne ecrite par le client a la commande : « ${consigne.texte} »`);

  const nbPhotos = Array.isArray(order.photo_urls) ? order.photo_urls.length : 0;
  lignes.push(
    nbPhotos > 0
      ? `Photos recues : ${nbPhotos}`
      : "Photos recues : AUCUNE — la commande attend encore les photos du client."
  );

  const visuelEnvoye = formaterDate(order.final_image_sent_at);
  lignes.push(
    visuelEnvoye
      ? `Illustration finale envoyee au client le ${visuelEnvoye}.`
      : order.final_image_url
        ? "Illustration prete mais PAS encore envoyee au client."
        : "Illustration pas encore terminee."
  );

  if (order.poster_confirmation_sent_at) {
    const statut =
      order.poster_confirmation_status === "confirmed"
        ? "le client a valide le visuel avant impression"
        : order.poster_confirmation_status === "changes_requested"
          ? `le client a demande une retouche${order.poster_confirmation_note ? ` : « ${order.poster_confirmation_note} »` : ""}`
          : "en attente de sa reponse";
    lignes.push(
      `Validation avant impression envoyee le ${formaterDate(order.poster_confirmation_sent_at)} — ${statut}.`
    );
  }

  /* Le bloc expedition ne s'ecrit que pour les commandes physiques. Un fichier
     numerique n'a pas de colis : lui joindre une ligne « pas encore expedie »
     inviterait le modele a parler d'un envoi qui n'existera jamais — le meme
     piege qui faisait proposer un suivi de colis a des clients venus chercher
     un fichier. */
  if (estPhysique(options)) {
    const expedieLe = formaterDate(order.expedie_le);
    if (expedieLe) {
      lignes.push(
        `Colis remis au transporteur le ${expedieLe}${order.suivi_transporteur ? ` (${order.suivi_transporteur})` : ""}.` +
          (order.suivi_url
            ? ` Lien de suivi communicable au client : ${order.suivi_url}`
            : " Aucun lien de suivi disponible.")
      );
    } else {
      lignes.push("Colis PAS encore expedie. Aucun numero de suivi n'existe.");
    }
  }

  return lignes.join("\n");
}

/**
 * Le resultat porte la RAISON de l'echec, pas seulement son existence.
 *
 * Un `null` devant un bouton « Brouillon IA » qui ne fait rien ne laisse rien
 * a corriger : cle expiree, modele retire du catalogue, quota depasse se
 * ressemblent tous. La meme lecon que le classement des messages entrants,
 * ou un echec silencieux s'etait deguise en boite propre pendant cinq
 * semaines — sauf qu'ici la personne est devant l'ecran et peut agir tout de
 * suite, a condition qu'on lui dise quoi.
 */
export type ResultatRedaction = { texte: string } | { erreur: string };

export async function redigerReponseSupport(input: {
  /**
   * Le message auquel on repond. Null quand c'est nous qui ouvrons le fil —
   * pour repondre a une question posee dans le formulaire de commande, ou
   * pour donner un point d'etape que personne n'a demande.
   */
  message: { fromEmail: string; subject: string | null; bodyText: string | null } | null;
  commande: DbOrder | null;
  /** Ce qu'on a deja envoye sur ce fil, du plus ancien au plus recent. */
  historique: SupportReply[];
}): Promise<ResultatRedaction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[AI-REPONSE] OPENAI_API_KEY absente");
    return { erreur: "OPENAI_API_KEY n'est pas configurée : la rédaction assistée est indisponible." };
  }

  /* La langue de repli vient du pays detecte a la visite, pas de la langue du
     site : c'est le signal le plus proche du client dont dispose la commande,
     et le meme qui choisit deja la langue de tous les e-mails transactionnels.
     Sans commande, le francais — la boite est francaise. */
  const langue: Lang = input.commande ? getLangFromCountry(input.commande.detected_country) : "fr";

  const blocs = [
    FAITS,
    input.commande
      ? `Fiche de la commande concernee :\n${ficheCommande(input.commande)}`
      : "Aucune commande n'est rattachee a ce message. Si le client parle d'une commande, demande-lui son numero ou l'adresse e-mail utilisee au paiement plutot que de supposer quoi que ce soit.",
  ];

  /* L'historique evite la faute la plus visible d'un brouillon : redire mot
     pour mot ce qu'on a deja ecrit il y a trois jours, a quelqu'un qui
     justement relance parce que cette reponse-la ne lui a pas suffi. */
  if (input.historique.length > 0) {
    const fil = input.historique
      .map((r) => `— Le ${formaterDate(r.sent_at) ?? "?"}, nous avons ecrit :\n${r.body_text}`)
      .join("\n\n");
    blocs.push(`Ce qu'on a DEJA envoye sur ce fil (ne le repete pas) :\n${fil}`);
  }

  if (input.message) {
    blocs.push(
      `Message du client, auquel tu reponds :\nDe : ${input.message.fromEmail}\nObjet : ${input.message.subject || "(sans objet)"}\n\n${(input.message.bodyText || "(message vide)").slice(0, 4000)}`
    );
  } else {
    /* Rien n'est arrive par e-mail : c'est nous qui ecrivons. Deux situations
       tres differentes se cachent derriere, et les confondre donne soit une
       reponse a cote, soit un courrier sans objet.

       La question posee dans la case « instructions » au moment de commander
       en est une. Elle n'a jamais ete envoyee nulle part — c'est precisement
       pourquoi elle restait sans reponse — mais elle attend la meme chose
       qu'un e-mail. */
    const consigne = input.commande
      ? lireConsigne(
          (typeof input.commande.options === "string"
            ? JSON.parse(input.commande.options)
            : input.commande.options
          )?.description
        )
      : { texte: null, question: false };

    if (consigne.texte) {
      blocs.push(
        `Le client n'a envoye aucun e-mail. Il a ecrit ceci dans le formulaire de commande, et personne ne lui a encore repondu :\n« ${consigne.texte} »\n\nEcris-lui pour y repondre. Ouvre par la reponse a ce qu'il demande, sans lui rappeler ou il l'a ecrit.`
      );
    } else {
      blocs.push(
        "Le client n'a rien demande. Ecris-lui un point d'etape court et concret sur l'etat de sa commande, tel que la fiche ci-dessus le decrit — et rien de plus. Si la fiche ne montre aucune avancee digne d'etre annoncee, dis-le franchement plutot que de meubler."
      );
    }

    blocs.push(
      `Ce courrier ouvre le fil : personne n'a ecrit avant toi. Redige-le en ${NOM_DE_LANGUE[langue]}.`
    );
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELE,
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: "system", content: CONSIGNES },
          { role: "user", content: blocs.join("\n\n") },
        ],
      }),
    });

    if (!r.ok) {
      /* Le message du fournisseur est la seule chose qui distingue une cle
         expiree d'un modele retire du catalogue ou d'un quota atteint. */
      const detail = await r.text().catch(() => "");
      console.error(`[AI-REPONSE] reponse ${r.status} : ${detail.slice(0, 500)}`);
      return { erreur: `Le modèle a répondu ${r.status} : ${detail.slice(0, 300) || "aucun détail."}` };
    }

    const data = await r.json();
    const texte = (data?.choices?.[0]?.message?.content || "").trim();
    if (!texte) {
      console.error("[AI-REPONSE] reponse vide");
      return { erreur: "Le modèle a renvoyé un texte vide." };
    }

    return { texte };
  } catch (error) {
    console.error("[AI-REPONSE] Erreur:", error);
    return { erreur: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}
