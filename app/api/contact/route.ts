import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { findOrderByCustomerEmail, insertSupportMessage } from "@/lib/db";
import { alerteDiscord, COULEUR_ATTENTION } from "@/lib/discord";
import { cleDepuisRequete } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Le formulaire de la page Contact.
 *
 * Il n'envoyait rien : il affichait « message envoye » et s'arretait la. Le
 * message atterrit desormais dans la boite support deja lue par l'admin
 * (onglet Support), la ou arrivent les e-mails synchronises par IMAP. Pas de
 * nouvelle boite : un second endroit a surveiller serait un second endroit a
 * oublier, ce qui reproduirait exactement le defaut corrige ici.
 */

// Meme regle que la newsletter : on refuse ce qui n'est manifestement pas un
// e-mail, la vraie verification se fait quand on repond.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NOM_MAX = 100;
const SUJET_MAX = 200;
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 5000;

/* Limitation par IP, sur le modele du depot d'avis. Compteur en memoire, donc
   par instance : il n'arrete pas un attaquant determine, mais empeche un
   formulaire relance en boucle de remplir la boite support et de saturer
   Discord. */
const ENVOIS_MAX = 5;
const FENETRE_MS = 60 * 60 * 1000;
const envois = new Map<string, number[]>();

function tropDEnvois(cle: string): boolean {
  const maintenant = Date.now();
  const recents = (envois.get(cle) ?? []).filter((t) => t > maintenant - FENETRE_MS);

  if (recents.length >= ENVOIS_MAX) {
    envois.set(cle, recents);
    return true;
  }

  recents.push(maintenant);
  envois.set(cle, recents);

  // Purge opportuniste : sans elle la table grossirait indefiniment.
  if (envois.size > 500) {
    for (const [autre, dates] of envois) {
      if (dates.every((t) => t <= maintenant - FENETRE_MS)) envois.delete(autre);
    }
  }
  return false;
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  /* Pot de miel : un champ cache que seul un robot remplit. On repond 200
     sans rien enregistrer, pour ne pas lui apprendre qu'il a ete reconnu. */
  if (texte(body.site)) {
    return NextResponse.json({ ok: true });
  }

  const nom = texte(body.nom);
  const email = texte(body.email);
  const sujet = texte(body.sujet);
  const message = texte(body.message);

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (nom.length > NOM_MAX || sujet.length > SUJET_MAX) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  // Compte apres validation : une faute de frappe corrigee ne doit pas
  // consommer le quota d'un client de bonne foi.
  if (tropDEnvois(cleDepuisRequete(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    /* Rattache le message a la derniere commande du client, comme la synchro
       IMAP le fait en dernier recours : la fiche commande s'ouvre alors en un
       clic depuis l'onglet Support. Un echec de lecture ne bloque pas l'envoi. */
    const commande = await findOrderByCustomerEmail(email).catch(() => null);

    /* Le nom n'a pas de colonne dans support_messages : il voyage en tete du
       corps, ce qui suffit a l'admin pour saluer le client correctement. */
    const corps = nom ? `${nom} <${email}>\n\n${message}` : message;

    await insertSupportMessage({
      messageId: `contact-${randomUUID()}`,
      fromEmail: email,
      subject: sujet ? `[Formulaire] ${sujet}` : "[Formulaire] (sans sujet)",
      bodyText: corps,
      receivedAt: new Date(),
      orderId: commande?.id ?? null,
      category: "customer",
    });

    await alerteDiscord({
      titre: "✉️ FORMULAIRE DE CONTACT",
      couleur: COULEUR_ATTENTION,
      champs: [
        { name: "📧 Email", value: email, inline: true },
        ...(nom ? [{ name: "👤 Nom", value: nom.slice(0, 100), inline: true }] : []),
        ...(commande ? [{ name: "📦 Commande", value: commande.id.slice(0, 8), inline: true }] : []),
        { name: "📝 Sujet", value: sujet.slice(0, 200) || "(sans sujet)", inline: false },
        { name: "💬 Message", value: message.slice(0, 1000), inline: false },
      ],
      piedDePage: "Cartoonova • Onglet Support",
    });

    return NextResponse.json({ ok: true });
  } catch (erreur) {
    /* Un 500 et non un faux succes : le formulaire affiche alors l'erreur et
       l'adresse directe, au lieu de laisser croire au client qu'il nous a
       ecrit. */
    console.error("[POST /api/contact]", erreur instanceof Error ? erreur.message : erreur);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
