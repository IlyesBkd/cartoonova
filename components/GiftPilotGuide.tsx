import type { GiftPilot } from "@/lib/giftPilots";

export default function GiftPilotGuide({ pilot, style }: { pilot: GiftPilot; style: string }) {
  return (
    <section data-gift-pilot={style} aria-labelledby="gift-pilot-title" className="mb-12">
      <h2 id="gift-pilot-title" className="text-2xl font-black text-black mb-5">Préparer ton cadeau d’anniversaire</h2>
      <div className="grid md:grid-cols-3 gap-5">
        {[
          ["Conseils photo", pilot.photo],
          ["Choisir le décor", pilot.decor],
          ["Suggestion de composition", pilot.composition],
        ].map(([title, text]) => (
          <div className="bloc" key={title}>
            <h3 className="text-lg font-black text-black mb-3">{title}</h3>
            <p className="text-black/75 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-black/70">Ces pistes sont des suggestions de composition, pas un témoignage ni un cas client d’anniversaire vérifié. Décris tes souhaits et fais confirmer les demandes particulières avant l’achat.</p>
    </section>
  );
}
