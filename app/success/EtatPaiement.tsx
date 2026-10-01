/** Adresse citee aux clients — la meme que sur la fiche produit. */
const SUPPORT_EMAIL_SUCCES = "support@cartoonova.com";

/* Les etats de la page de succes qui ne sont pas un succes : paiement en
   attente, refuse, lien incomplet, commande introuvable, panne.

   Ils etaient rendus en police machine, avec le statut Stripe brut et, en cas
   d'exception, le message d'erreur du serveur. C'est ce que lisait un client
   qui venait de payer par PayPal et tombait sur `processing`. Ils reprennent
   la carte de la page de suivi (`.suivi__carte`), deja habillee. */

export default function EtatPaiement({
  titre,
  texte,
  reference,
  libelleReference,
  action,
  children,
}: {
  titre: string;
  texte: string;
  /** Reference de paiement a citer au support, affichee en petit. */
  reference?: string;
  libelleReference?: string;
  action?: { href: string; libelle: string };
  children?: React.ReactNode;
}) {
  return (
    <main className="suivi">
      <div className="suivi__carte suivi__carte--vide">
        <h1>{titre}</h1>
        <p>{texte}</p>
        {children}
        {action && (
          <a href={action.href} className="bouton bouton--primaire" style={{ alignSelf: "center" }}>
            {action.libelle}
          </a>
        )}
        {reference && (
          <p style={{ fontSize: 13 }}>
            {libelleReference} : <code>{reference}</code> ·{" "}
            <a href={`mailto:${SUPPORT_EMAIL_SUCCES}`}>{SUPPORT_EMAIL_SUCCES}</a>
          </p>
        )}
      </div>
    </main>
  );
}
