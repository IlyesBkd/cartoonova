"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import { TEXTES_AVIS } from "./textes";

type Etat = "saisie" | "envoi" | "publie" | "modere" | "erreur";

export default function NouvelAvisClient({
  locale,
  jeton,
  verifie,
}: {
  locale: Locale;
  jeton: string;
  /** Le lien porte un jeton de commande valide : l'avis sera publie sans relecture. */
  verifie: boolean;
}) {
  const t = TEXTES_AVIS[locale];

  const [auteur, setAuteur] = useState("");
  const [note, setNote] = useState(5);
  const [texte, setTexte] = useState("");
  const [etat, setEtat] = useState<Etat>("saisie");

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (etat === "envoi") return;
    if (texte.trim().length < 20) {
      setEtat("erreur");
      return;
    }
    setEtat("envoi");

    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auteur, note, texte, locale, jeton }),
      });
      if (!r.ok) {
        setEtat("erreur");
        return;
      }
      const data = (await r.json()) as { statut?: string };
      /* La preuve sociale est un levier de conversion mesurable : savoir
         combien d'avis sont deposes, avec quelle note et depuis quel marche
         dit si la sollicitation par e-mail apres livraison vaut la peine.
         Le texte de l'avis ne part pas — il est deja en base. */
      mesure(MESURES.avisSoumis, {
        note,
        locale,
        verifie,
        statut: data.statut ?? "publie",
      });
      setEtat(data.statut === "en_attente" ? "modere" : "publie");
    } catch {
      setEtat("erreur");
    }
  };

  if (etat === "publie" || etat === "modere") {
    return (
      <section className="section">
        <div className="enveloppe" style={{ maxWidth: 640 }}>
          <h1>{t.merciTitre}</h1>
          <p>{etat === "publie" ? t.merciPublie : t.merciModere}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="enveloppe" style={{ maxWidth: 640 }}>
        <h1>{t.titre}</h1>
        <p>{verifie ? t.introVerifie : t.intro}</p>

        <form onSubmit={envoyer} style={{ display: "grid", gap: 20, marginTop: 28 }}>
          <div>
            <label htmlFor="avis-auteur" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              {t.nom}
            </label>
            <input
              id="avis-auteur"
              type="text"
              required
              maxLength={60}
              value={auteur}
              onChange={(e) => setAuteur(e.target.value)}
              className="champ-ligne"
              style={{ width: "100%" }}
            />
            <small>{t.nomAide}</small>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: 6 }}>{t.note}</legend>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNote(n)}
                  aria-pressed={note === n}
                  aria-label={`${n}/5`}
                  style={{
                    fontSize: 28,
                    lineHeight: 1,
                    background: "none",
                    border: 0,
                    cursor: "pointer",
                    padding: 2,
                    /* L'etoile pleine est la seule indication d'etat : elle doit
                       rester lisible sans couleur, d'ou l'opacite marquee. */
                    opacity: n <= note ? 1 : 0.3,
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="avis-texte" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              {t.message}
            </label>
            <textarea
              id="avis-texte"
              required
              rows={6}
              maxLength={2000}
              value={texte}
              onChange={(e) => {
                setTexte(e.target.value);
                if (etat === "erreur") setEtat("saisie");
              }}
              className="champ-ligne"
              style={{ width: "100%", resize: "vertical" }}
            />
            <small>{t.messageAide}</small>
          </div>

          {etat === "erreur" && (
            <p className="depot__erreur" role="alert">
              {texte.trim().length < 20 ? t.erreurTexte : t.erreur}
            </p>
          )}

          <button type="submit" className="bouton bouton--primaire" disabled={etat === "envoi"}>
            {etat === "envoi" ? t.envoi : t.envoyer}
          </button>
        </form>
      </div>
    </section>
  );
}
