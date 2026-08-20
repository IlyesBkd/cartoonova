import Link from "next/link";

const VARIANTS = [
  {
    slug: "turnedyellow",
    title: "0. Marchand (relevé sur turnedyellow.com)",
    pitch: "Structure et couleurs relevées sur le concurrent : blanc cassé, jaune doré, ancrage de prix.",
    swatch: "linear-gradient(135deg, #ffffff, #f8f6f3, #ecbf45, #121212)",
  },
  {
    slug: "editorial",
    title: "1. Éditorial minimaliste",
    pitch: "Grand blanc, typographie magazine, photo hero pleine largeur.",
    swatch: "linear-gradient(135deg, #fafaf8, #1a1a1a)",
  },
  {
    slug: "popart",
    title: "2. Pop-art comic book",
    pitch: "Halftone, bulles de BD, cases de comic — très \"Simpsons\".",
    swatch: "linear-gradient(135deg, #ffe600, #ff2d55, #1a1aff)",
  },
  {
    slug: "glass",
    title: "3. Glassmorphism doux",
    pitch: "Dégradés pastel, cartes flloutées, arrondis, SaaS moderne.",
    swatch: "linear-gradient(135deg, #a8e6ff, #d7b8ff, #ffd6ec)",
  },
  {
    slug: "cinema",
    title: "4. Premium sombre / cinématique",
    pitch: "Fond noir, accents dorés, photo en grand format.",
    swatch: "linear-gradient(135deg, #0b0b0c, #2a2210, #c9a24b)",
  },
  {
    slug: "bento",
    title: "5. Bento grid coloré",
    pitch: "Grille de cartes façon app mobile, ludique, multicolore.",
    swatch: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcBef, #7ee787)",
  },
];

const POPART_VARIANTS = [
  {
    slug: "popart-classic",
    title: "BD classique",
    pitch: "Cases de comic traditionnelles, grosses gouttières noires, quadrichromie franche.",
    swatch: "linear-gradient(135deg, #ed1c24, #0057b7, #ffd400)",
  },
  {
    slug: "popart-warhol",
    title: "Warhol",
    pitch: "Répétition sérigraphie, aplats de couleur façon Warhol, grille contact-sheet.",
    swatch: "linear-gradient(135deg, #ff2d78, #00c2ff, #ffea00, #101010)",
  },
  {
    slug: "popart-manga",
    title: "Manga action",
    pitch: "Noir/blanc/rouge, speed-lines, onomatopées géantes, trame de points.",
    swatch: "linear-gradient(135deg, #0a0a0a, #ffffff, #e10600)",
  },
  {
    slug: "popart-vintage",
    title: "Vintage journal",
    pitch: "Papier vieilli, CMJN décalé façon impression offset, bande dessinée du dimanche.",
    swatch: "linear-gradient(135deg, #f2e4c9, #c94f3d, #2f5f8a)",
  },
  {
    slug: "popart-neon",
    title: "Néon street",
    pitch: "Couleurs fluo, éclats graffiti, badges BOOM/POW, mise en page chaotique.",
    swatch: "linear-gradient(135deg, #ff00e5, #00fff0, #101010)",
  },
];

export default async function SimpsonMockupsIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f4f2",
        color: "#111",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          5 maquettes — page produit Simpson
        </h1>
        <p style={{ color: "#555", marginBottom: 32 }}>
          Comparaison de directions visuelles. Contenu et prix réels, configurateur interactif,
          panier non actif (aperçu uniquement).
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/${locale}/simpson-mockups/${v.slug}`}
              style={{
                display: "block",
                borderRadius: 16,
                overflow: "hidden",
                textDecoration: "none",
                color: "#111",
                background: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                transition: "transform 150ms ease",
              }}
            >
              <div style={{ height: 100, background: v.swatch }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{v.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{v.pitch}</div>
              </div>
            </Link>
          ))}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 56, marginBottom: 8 }}>
          5 variantes du style Pop-art
        </h2>
        <p style={{ color: "#555", marginBottom: 32 }}>
          Le style pop-art a été retenu — voici 5 exécutions différentes à l&apos;intérieur de cette direction.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {POPART_VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/${locale}/simpson-mockups/${v.slug}`}
              style={{
                display: "block",
                borderRadius: 16,
                overflow: "hidden",
                textDecoration: "none",
                color: "#111",
                background: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                transition: "transform 150ms ease",
              }}
            >
              <div style={{ height: 100, background: v.swatch }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{v.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{v.pitch}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
