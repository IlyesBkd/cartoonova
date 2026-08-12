"use client";

import { useCallback, useEffect, useState } from "react";
import { currencies, type Currency } from "@/lib/currency";
import type { PromoCode, PromoKind } from "@/lib/promoCodes";

const inputClass =
  "w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400";
const labelClass = "text-xs font-semibold text-gray-500 uppercase mb-1 block";

export default function PromoCodesPanel({ password }: { password: string }) {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<PromoKind>("percent");
  const [value, setValue] = useState("10");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/promo", { headers: { "x-admin-password": password } });
      if (!res.ok) throw new Error("load_failed");
      setCodes(await res.json());
    } catch {
      setError("Impossible de charger les codes.");
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!code.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          code,
          kind,
          value: Number(value),
          currency: kind === "amount" ? currency : null,
          minSubtotal: minSubtotal ? Number(minSubtotal) : 0,
          maxUses: maxUses ? Number(maxUses) : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`Création refusée : ${data.error}`);
        return;
      }
      setCode("");
      setMaxUses("");
      setEndsAt("");
      await load();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (target: PromoCode) => {
    await fetch("/api/promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ code: target.code, active: !target.active }),
    });
    await load();
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🎟️ Codes promo</h2>
        <p className="text-sm text-gray-500">
          La remise est appliquée côté serveur au moment du paiement. Un code désactivé cesse de fonctionner immédiatement.
        </p>
      </div>

      <div className="max-w-3xl bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Nouveau code</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="promo-new-code">Code</label>
            <input
              id="promo-new-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BIENVENUE10"
              className={`${inputClass} uppercase`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="promo-kind">Type</label>
            <select id="promo-kind" value={kind} onChange={(e) => setKind(e.target.value as PromoKind)} className={inputClass}>
              <option value="percent">Pourcentage</option>
              <option value="amount">Montant fixe</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="promo-value">{kind === "percent" ? "Remise (%)" : "Remise"}</label>
            <div className="flex gap-2">
              <input id="promo-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
              {kind === "amount" && (
                <select
                  aria-label="Devise"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className={`${inputClass} w-28`}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="promo-min">Panier minimum</label>
            <input id="promo-min" type="number" min="0" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="promo-max">Utilisations max</label>
            <input id="promo-max" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="illimité" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="promo-ends">Expire le</label>
            <input id="promo-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-red-600 mb-3">{error}</p>}

        <button
          onClick={create}
          disabled={saving || !code.trim()}
          className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? "Création..." : "Créer le code"}
        </button>
      </div>

      <div className="max-w-3xl bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Remise</th>
                <th className="text-left px-4 py-3 font-semibold">Utilisations</th>
                <th className="text-left px-4 py-3 font-semibold">Expire</th>
                <th className="text-left px-4 py-3 font-semibold">État</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chargement…</td></tr>
              )}
              {!loading && codes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucun code pour l&apos;instant.</td></tr>
              )}
              {codes.map((c) => (
                <tr key={c.code} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{c.code}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.kind === "percent" ? `−${c.value} %` : `−${c.value} ${c.currency ?? ""}`}
                    {c.min_subtotal > 0 && <span className="text-gray-400"> · dès {c.min_subtotal}</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.ends_at ? new Date(c.ends_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "actif" : "désactivé"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(c)} className="text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">
                      {c.active ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
