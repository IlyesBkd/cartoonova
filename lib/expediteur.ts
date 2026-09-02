/**
 * L'adresse d'expedition de tous les e-mails du site.
 *
 * ── Pourquoi ce n'est plus `noreply@` ────────────────────────────────────
 *
 * Une commande de mai l'a demontre. Le client recoit son illustration, veut
 * une retouche — il a des tatouages qui manquent sur le dessin — et repond.
 * Son message part vers `noreply@cartoonova.com`, pas vers l'adresse de
 * reponse declaree : son logiciel de messagerie a repris l'expediteur. Les
 * deux messages ne sont arrives dans la boite support que par un transfert,
 * et l'un des deux n'a jamais ete marque lu.
 *
 * Une adresse `noreply@` est une convention qui dit « n'ecrivez pas ici ».
 * Les clients ecrivent quand meme, parce qu'ils repondent au message qu'ils
 * ont sous les yeux. Tout ce que la convention obtient, c'est que leur reponse
 * arrive quelque part que personne ne releve.
 *
 * ── Pourquoi une constante et pas une variable d'environnement ───────────
 *
 * `RESEND_FROM` existe dans la configuration et n'etait lu nulle part. La
 * lire maintenant aurait remis `noreply@` en production sans que rien ne le
 * signale : la valeur y est encore l'ancienne. Une constante ne peut pas
 * diverger de ce que le code annonce.
 *
 * Resend verifie le DOMAINE, pas l'adresse : changer la boite ne demande
 * aucune reconfiguration, et SPF comme DKIM restent valides.
 */

/** Boite reellement relevee — c'est elle qui alimente la synchro IMAP. */
export const SUPPORT_EMAIL = "support@cartoonova.com";

/** Expediteur de tous les envois, transactionnels comme cycle de vie. */
export const EXPEDITEUR = `Cartoonova <${SUPPORT_EMAIL}>`;
