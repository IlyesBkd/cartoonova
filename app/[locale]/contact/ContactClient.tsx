"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import Etoiles from "@/components/tj/Etoiles";

/* Le formulaire ecrit dans la boite support (route /api/contact), la meme que
   l'onglet Support de l'admin. Il n'affiche « envoye » qu'apres un 2xx : un
   faux accuse de reception laissait des clients attendre une reponse a un
   message que personne n'avait recu. */

type Etat = "saisie" | "envoi" | "envoye";
type CodeErreur = "email" | "message" | "trop" | "serveur";

const CHAMPS_VIDES = { nom: "", email: "", sujet: "", message: "", site: "" };

export default function ContactPage() {
  const [etat, setEtat] = useState<Etat>("saisie");
  const [erreur, setErreur] = useState<CodeErreur | null>(null);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tf = useTranslations("contactForm");

  const changer = (cle: keyof typeof CHAMPS_VIDES) => (valeur: string) => {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    if (erreur) setErreur(null);
  };

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etat === "envoi") return;
    setEtat("envoi");
    setErreur(null);
    try {
      const reponse = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(champs),
      });
      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => ({}))) as { error?: string };
        setErreur(
          reponse.status === 429
            ? "trop"
            : corps.error === "invalid_email"
              ? "email"
              : corps.error === "invalid_message"
                ? "message"
                : "serveur"
        );
        setEtat("saisie");
        return;
      }
      /* `livre: true` : la mesure compte desormais des messages reellement
         recus, et non plus des visiteurs persuades de nous avoir ecrit. */
      mesure(MESURES.formulaireContactEnvoye, { livre: true });
      setChamps(CHAMPS_VIDES);
      setEtat("envoye");
    } catch {
      setErreur("serveur");
      setEtat("saisie");
    }
  }

  const messageErreur =
    erreur === "email"
      ? tf("erreurEmail")
      : erreur === "message"
        ? tf("erreurMessage")
        : erreur === "trop"
          ? tf("erreurTrop")
          : erreur === "serveur"
            ? tf("erreurServeur")
            : null;

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
          {etat === "envoye" ? (
            <div className="etape" style={{ textAlign: "center" }} role="status">
              <h2 style={{ fontSize: 26, marginBottom: 10 }}>
                {tf.rich("envoyeTitre", { accent: (c) => <span className="accent">{c}</span> })}
              </h2>
              <p style={{ color: "var(--encre-doux)", margin: "0 0 22px" }}>{t("contactHoraires")}</p>
              <button type="button" className="bouton bouton--fantome" onClick={() => setEtat("saisie")}>
                {tf("autreMessage")}
              </button>
            </div>
          ) : (
            <form className="etape" onSubmit={envoyer} style={{ display: "grid", gap: 18 }}>
              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-nom" style={{ marginBottom: 8 }}>
                  <b />
                  {tf("nom")}
                </label>
                <input
                  id="c-nom"
                  className="champ-ligne"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={champs.nom}
                  onChange={(e) => changer("nom")(e.target.value)}
                />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-mail" style={{ marginBottom: 8 }}>
                  <b />
                  {tf("email")}
                </label>
                <input
                  id="c-mail"
                  className="champ-ligne"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={champs.email}
                  onChange={(e) => changer("email")(e.target.value)}
                />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-sujet" style={{ marginBottom: 8 }}>
                  <b />
                  {tf("sujet")}
                </label>
                <input
                  id="c-sujet"
                  className="champ-ligne"
                  type="text"
                  required
                  maxLength={200}
                  value={champs.sujet}
                  onChange={(e) => changer("sujet")(e.target.value)}
                />
              </div>

              <div className="etape-conf" style={{ padding: 0, borderBottom: 0 }}>
                <label className="etape-conf__titre" htmlFor="c-message" style={{ marginBottom: 8 }}>
                  <b />
                  {tf("message")}
                </label>
                <textarea
                  id="c-message"
                  className="champ"
                  required
                  rows={6}
                  minLength={5}
                  maxLength={5000}
                  value={champs.message}
                  onChange={(e) => changer("message")(e.target.value)}
                />
              </div>

              {/* Pot de miel : invisible et hors tabulation pour un humain, rempli
                  par les robots qui completent tous les champs. La route l'ignore
                  silencieusement. */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="c-site">Site</label>
                <input
                  id="c-site"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={champs.site}
                  onChange={(e) => changer("site")(e.target.value)}
                />
              </div>

              {messageErreur && (
                <p role="alert" style={{ color: "#b91c1c", margin: 0, textAlign: "center", fontWeight: 600 }}>
                  {messageErreur}
                </p>
              )}

              <button
                type="submit"
                className="bouton bouton--primaire"
                style={{ justifySelf: "center" }}
                disabled={etat === "envoi"}
              >
                {etat === "envoi" ? tf("envoi") : tf("envoyer")}
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
