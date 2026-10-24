import Image from "next/image";
import Link from "next/link";
import styles from "./PageIntrouvable.module.css";

type Textes = {
  surtitre: string;
  titre: string;
  accent: string;
  texte: string;
  boutonCollections: string;
  boutonAccueil: string;
};

export const textes404Francais: Textes = {
  surtitre: "Erreur 404",
  titre: "Oups, cette page",
  accent: "est introuvable",
  texte: "Le lien est peut-être incorrect ou la page a été supprimée. Retrouve nos portraits personnalisés ou retourne à l’accueil.",
  boutonCollections: "Voir les portraits",
  boutonAccueil: "Retour à l’accueil",
};

export default function PageIntrouvable({
  locale = "fr",
  textes = textes404Francais,
}: {
  locale?: string;
  textes?: Textes;
}) {
  return (
    <section className={styles.scene} data-cartoonova-404>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.badge}>{textes.surtitre}</span>
          <h1>{textes.titre}<br /><span>{textes.accent}</span></h1>
          <p className={styles.description}>{textes.texte}</p>
          <div className={styles.actions}>
            <Link href={`/${locale}/collections`} className="bouton bouton--primaire">
              {textes.boutonCollections}<span aria-hidden="true">↗</span>
            </Link>
            <Link href={`/${locale}`} className={styles.home}>
              <span aria-hidden="true">←</span> {textes.boutonAccueil}
            </Link>
          </div>
        </div>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.sun} />
          <span className={styles.code}>404</span>
          <div className={styles.manga}>
            <Image src="/toonjaune/card-manga.jpg" alt="" width={800} height={800} sizes="(max-width: 600px) 120px, 180px" />
          </div>
          <div className={styles.portrait}>
            <Image src="/toonjaune/card-cartoon.jpg" alt="" width={800} height={800} sizes="(max-width: 600px) 220px, 310px" priority />
          </div>
          <span className={styles.sparkOne}>✦</span>
          <span className={styles.sparkTwo}>✦</span>
          <span className={styles.orbit} />
        </div>
      </div>
    </section>
  );
}
