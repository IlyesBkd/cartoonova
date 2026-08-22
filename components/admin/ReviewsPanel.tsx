"use client";

import { useCallback, useEffect, useState } from "react";
import type { Avis, StatutAvis } from "@/lib/reviewsDb";

const STATUTS: Record<StatutAvis, { label: string; classe: string }> = {
  publie: { label: "Publié", classe: "bg-green-100 text-green-800 border-green-300" },
  en_attente: { label: "En attente", classe: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  rejete: { label: "Rejeté", classe: "bg-gray-100 text-gray-600 border-gray-300" },
};

/**
 * Moderation des avis.
 *
 * Les avis deposes via le lien signe envoye apres livraison sont deja publies
 * quand ils arrivent ici : ce panneau sert aux avis sans preuve d'achat, et a
 * depublier le cas echeant. Il n'est donc pas une etape du parcours normal.
 */
export default function ReviewsPanel({ password }: { password: string }) {
  const [avis, setAvis] = useState<Avis[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch("/api/reviews", { headers: { "x-admin-password": password } });
      if (!res.ok) throw new Error("load_failed");
      setAvis(await res.json());
    } catch {
      setErreur("Impossible de charger les avis.");
    } finally {
      setChargement(false);
    }
  }, [password]);

  useEffect(() => {
    charger();
  }, [charger]);

  const changerStatut = async (id: number, statut: StatutAvis) => {
    // Mise a jour optimiste : l'aller-retour reseau ne doit pas donner
    // l'impression que le clic n'a pas ete pris en compte.
    setAvis((liste) => liste.map((a) => (a.id === id ? { ...a, statut } : a)));
    try {
      const res = await fetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ id, statut }),
      });
      if (!res.ok) throw new Error("patch_failed");
    } catch {
      setErreur("La modification n'a pas été enregistrée.");
      charger();
    }
  };

  const enAttente = avis.filter((a) => a.statut === "en_attente").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {avis.length} avis · {enAttente} en attente
        </p>
        <button
          onClick={charger}
          disabled={chargement}
          className="px-3 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-lg"
        >
          {chargement ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {erreur && <p className="mb-4 text-sm text-red-600">{erreur}</p>}

      {avis.length === 0 && !chargement && (
        <p className="text-sm text-gray-500">
          Aucun avis pour l&apos;instant. Ils arrivent par le lien envoyé dix jours après la livraison.
        </p>
      )}

      <div className="space-y-3">
        {avis.map((a) => (
          <article key={a.id} className="p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <strong className="text-sm">{a.auteur}</strong>
              <span className="text-sm" aria-label={`${a.note} sur 5`}>
                {"★".repeat(a.note)}
                <span className="text-gray-300">{"★".repeat(5 - a.note)}</span>
              </span>
              <span className={`px-2 py-0.5 text-xs font-semibold border rounded-full ${STATUTS[a.statut].classe}`}>
                {STATUTS[a.statut].label}
              </span>
              {a.verifie && (
                <span className="px-2 py-0.5 text-xs font-semibold text-blue-800 bg-blue-100 border border-blue-300 rounded-full">
                  Achat vérifié
                </span>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {a.locale} · {new Date(a.creeLe).toLocaleDateString("fr-FR")}
              </span>
            </div>

            <p className="mb-3 text-sm text-gray-700 whitespace-pre-wrap">{a.texte}</p>

            <div className="flex gap-2">
              {a.statut !== "publie" && (
                <button
                  onClick={() => changerStatut(a.id, "publie")}
                  className="px-3 py-1.5 text-xs font-semibold text-green-800 bg-green-100 border border-green-300 rounded-lg"
                >
                  Publier
                </button>
              )}
              {a.statut !== "rejete" && (
                <button
                  onClick={() => changerStatut(a.id, "rejete")}
                  className="px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-lg"
                >
                  Rejeter
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
