import Link from "next/link";
import type { ReactNode } from "react";
import { ENTREPRISE, type CleEntreprise } from "@/lib/legal/entreprise";
import type { Bloc, DocumentLegal } from "@/lib/legal/types";

/* Affichage d'une page legale a partir de ses donnees (lib/legal/*). Rendu
   serveur, sans JavaScript client. La mise en forme reconnue est decrite dans
   lib/legal/types.ts. */

const EMAIL = "support@cartoonova.com";

/** Remplace {raison}, {siege}… par l'identite de la societe. */
function avecEntreprise(texte: string): string {
  return texte.replace(/\{(\w+)\}/g, (m, cle: string) =>
    cle in ENTREPRISE ? ENTREPRISE[cle as CleEntreprise] : m
  );
}

/** Gras, liens et adresse e-mail dans une chaine. */
export function enLigne(brut: string, locale: string): ReactNode[] {
  const texte = avecEntreprise(brut);
  const morceaux: ReactNode[] = [];
  const motif = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|support@cartoonova\.com/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = motif.exec(texte))) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    if (m[1] !== undefined) {
      morceaux.push(<strong key={i++}>{enLigne(m[1], locale)}</strong>);
    } else if (m[2] !== undefined) {
      const url = m[3];
      morceaux.push(
        url.startsWith("/") ? (
          <Link key={i++} href={`/${locale}${url}`}>
            {m[2]}
          </Link>
        ) : (
          <a key={i++} href={url} target="_blank" rel="noopener noreferrer">
            {m[2]}
          </a>
        )
      );
    } else {
      morceaux.push(
        <a key={i++} href={`mailto:${EMAIL}`}>
          {EMAIL}
        </a>
      );
    }
    dernier = m.index + m[0].length;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return morceaux;
}

function RenduBloc({ bloc, locale }: { bloc: Bloc; locale: string }) {
  if (typeof bloc === "string") return <p>{enLigne(bloc, locale)}</p>;
  if ("liste" in bloc)
    return (
      <ul>
        {bloc.liste.map((l, i) => (
          <li key={i}>{enLigne(l, locale)}</li>
        ))}
      </ul>
    );
  if ("sousTitre" in bloc) return <h3>{enLigne(bloc.sousTitre, locale)}</h3>;
  return (
    <div>
      {bloc.lignes.map((l, i) => (
        <p key={i}>{enLigne(l, locale)}</p>
      ))}
    </div>
  );
}

export default function PageLegale({
  document,
  avertissement,
  locale,
}: {
  document: DocumentLegal;
  avertissement: string;
  locale: string;
}) {
  return (
    <div className="section">
      <div className="enveloppe prose">
        <h1>{document.titre}</h1>
        <p>{document.miseAJour}</p>
        {avertissement && (
          <p className="legal-avertissement">
            <em>{avertissement}</em>
          </p>
        )}
        <div>
          {document.sections.map((s, i) => (
            <section key={i}>
              <h2>{s.titre}</h2>
              {s.blocs.map((b, j) => (
                <RenduBloc key={j} bloc={b} locale={locale} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
