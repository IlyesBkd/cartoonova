"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import Etoiles from "@/components/tj/Etoiles";

/* NOTE : ce formulaire n'envoie rien — il bascule un etat local, exactement
   comme avant la refonte. Le comportement est conserve tel quel : le brancher
   releve d'une decision produit (quelle boite, quel accuse de reception), pas
   du changement de design. En attendant, l'adresse e-mail directe est mise en
   avant sous le formulaire. */

export default function ContactPage() {
  const [envoye, setEnvoye] = useState(false);
  const t = useTranslations("tj");
  const tn = useTranslations("nav");

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> {t("heroOeil")}
          </div>
          <h1>
            {tn("contact")} <span className="accent">Cartoonova</span>
          </h1>
          <p>{t("contactTitre")}</p>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe" style={{ maxWidth: 680 }}>
          {envoye ? (
            <div className="etape" style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 26, marginBottom: 10 }}>
                Message <span className="accent">envoyé</span>
              </h2>
              <p style={{ color: "var(--encre-doux)", margin: "0 0 22px" }}>{t("contactHoraires")}</p>
              <button type="button" className="bouton bouton--fantome" onClick={() => setEnvoye(false)}>
                Écrire un autre message
              </button>
            </div>
          ) : (
            <form
              className="etape"
              onSubmit={(e) => {
                e.preventDefault();
                /* ATTENTION : ce formulaire n'envoie rien. Il affiche un
                   accuse de reception et s'arrete la — aucun appel reseau,
                   aucun e-mail, aucune trace en base. La mesure est posee ici
                   pour chiffrer ce que cela coute : chaque evenement compte un
                   visiteur convaincu qu'il vient de nous ecrire. Voir le
                   rapport d'audit. */
                mesure(MESURES.formulaireContactEnvoye, { livre: false });
                setEnvoye(true);
              }}
              style={{ display: "grid", gap: 18 }}
            >
              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-nom" style={{ marginBottom: 8 }}>
                  <b />
                  Votre nom
                </label>
                <input id="c-nom" className="champ-ligne" type="text" required autoComplete="name" />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-mail" style={{ marginBottom: 8 }}>
                  <b />
                  Votre e-mail
                </label>
                <input id="c-mail" className="champ-ligne" type="email" required autoComplete="email" />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-sujet" style={{ marginBottom: 8 }}>
                  <b />
                  Sujet
                </label>
                <input id="c-sujet" className="champ-ligne" type="text" required />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-message" style={{ marginBottom: 8 }}>
                  <b />
                  Message
                </label>
                <textarea id="c-message" className="champ" required rows={6} />
              </div>

              <button type="submit" className="bouton bouton--primaire" style={{ justifySelf: "center" }}>
                Envoyer
              </button>
            </form>
          )}

          <div className="contact" style={{ marginTop: 30, textAlign: "center" }}>
            <p>{t("contactTitre")}</p>
            <p>
              <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
            </p>
            <p style={{ fontSize: 13 }}>{t("contactHoraires")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
