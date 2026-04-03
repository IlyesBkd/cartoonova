"use client";

import { useState, useEffect, useCallback } from "react";
import type { Prices } from "@/lib/types";
import { DEFAULT_PRICES } from "@/lib/types";
import type { DbOrder } from "@/lib/db";

type OrderStatus = "new" | "in_progress" | "completed" | "shipped";

const STYLE_LABELS: Record<string, { label: string; emoji: string }> = {
  simpson: { label: "Simpson", emoji: "🟡" },
  simpsons2: { label: "Simpson V2", emoji: "🟡" },
  dbz: { label: "Dragon Ball Z", emoji: "⚡" },
  disney: { label: "Disney", emoji: "✨" },
  ghibli: { label: "Ghibli", emoji: "🌸" },
  onepiece: { label: "One Piece", emoji: "🏴‍☠️" },
  rickandmorty: { label: "Rick & Morty", emoji: "🌀" },
};

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: "Nouvelle", color: "bg-blue-100 text-blue-800 border-blue-300" },
  in_progress: { label: "En cours", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-800 border-green-300" },
  shipped: { label: "Expédiée", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"orders" | "prices" | "analytics">("orders");

  // Orders
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);

  // Prices
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-password": password }),
    [password]
  );

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const r = await fetch("/api/orders", { headers: { "x-admin-password": password } });
      if (r.ok) setOrders(await r.json());
    } catch {}
    setLoadingOrders(false);
  }, [password]);

  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch("/api/prices");
      if (r.ok) setPrices(await r.json());
    } catch {}
  }, []);

  // Login
  const handleLogin = async () => {
    try {
      const r = await fetch("/api/orders", { headers: { "x-admin-password": password } });
      if (r.ok) {
        setAuthed(true);
        setOrders(await r.json());
        fetchPrices();
      } else {
        const data = await r.json().catch(() => null);
        const msg = data?.error || `Erreur ${r.status}`;
        alert(r.status === 401 ? "Mot de passe incorrect." : `Erreur serveur : ${msg}`);
      }
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : "Connexion impossible"}`);
    }
  };

  useEffect(() => {
    if (authed) {
      fetchOrders();
      fetchPrices();
    }
  }, [authed, fetchOrders, fetchPrices]);

  // Update order status
  const updateStatus = async (id: string, status: OrderStatus) => {
    await fetch("/api/orders", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id, status }),
    });
    fetchOrders();
    if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, status });
  };

  // Save prices
  const savePrices = async () => {
    setSavingPrices(true);
    await fetch("/api/prices", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(prices),
    });
    setSavingPrices(false);
    setPricesSaved(true);
    setTimeout(() => setPricesSaved(false), 2000);
  };

  // ─── Login screen ────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">🔒</span>
            <h1 className="text-xl font-bold text-gray-900">Admin Cartoonova</h1>
            <p className="text-sm text-gray-500 mt-1">Entrez le mot de passe administrateur</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Mot de passe"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-gray-900 text-white font-semibold text-sm py-3 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Connexion
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-lg font-bold">🎨 Cartoonova</h1>
          <p className="text-xs text-gray-400 mt-1">Back-office Admin</p>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "orders" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>📦</span> Commandes
            {orders.filter((o) => o.status === "new").length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {orders.filter((o) => o.status === "new").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("analytics")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "analytics" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>📊</span> Analytics
          </button>
          <button
            onClick={() => setTab("prices")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "prices" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>💰</span> Gestion des Prix
          </button>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button onClick={() => { setAuthed(false); setPassword(""); }} className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer">
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8">
        {/* ═══ COMMANDES TAB ═══ */}
        {tab === "orders" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📦 Commandes</h2>
                <p className="text-sm text-gray-500">{orders.length} commande{orders.length !== 1 ? "s" : ""} au total</p>
              </div>
              <button onClick={fetchOrders} disabled={loadingOrders} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
                {loadingOrders ? "⏳" : "🔄"} Actualiser
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(["new", "in_progress", "completed", "shipped"] as const).map((s) => (
                <div key={s} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900">{orders.filter((o) => o.status === s).length}</p>
                  <p className="text-xs text-gray-500 font-semibold mt-1">{STATUS_LABELS[s].label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-6">
              {/* Orders table */}
              <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Style</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Produit</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Aucune commande pour le moment.</td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-yellow-50 transition-colors ${selectedOrder?.id === o.id ? "bg-yellow-50" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3 font-medium">{o.customer_email}</td>
                          <td className="px-4 py-3">{(() => { const opts = typeof o.options === 'string' ? JSON.parse(o.options) : o.options; const s = STYLE_LABELS[opts?.style]; return s ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-lg text-xs font-bold">{s.emoji} {s.label}</span> : <span className="text-gray-400">—</span>; })()}</td>
                          <td className="px-4 py-3 text-gray-500">{(typeof o.options === 'string' ? JSON.parse(o.options) : o.options)?.printOption || "—"}</td>
                          <td className="px-4 py-3 text-right font-bold">{o.total_price} {o.currency}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded-lg border ${STATUS_LABELS[o.status as OrderStatus]?.color || ""}`}>
                              {STATUS_LABELS[o.status as OrderStatus]?.label || o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Order detail panel */}
              {selectedOrder && (
                <div className="w-96 bg-white border border-gray-200 rounded-xl p-6 self-start sticky top-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Détail commande</h3>
                    <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-semibold mb-1">ID</p>
                      <p className="font-mono text-xs">{selectedOrder.id}</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-semibold mb-1">Client</p>
                      <p className="font-medium">{selectedOrder.customer_email}</p>
                      {selectedOrder.customer_name && (
                        <p className="text-gray-600">{selectedOrder.customer_name}</p>
                      )}
                      {(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.phone && <p className="text-gray-600">📞 {(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options).phone}</p>}
                    </div>

                    {selectedOrder.customer_address && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">📦 Adresse de livraison</p>
                        <p className="text-gray-700">{selectedOrder.customer_address}</p>
                        <p className="text-gray-700">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.postalCode} {(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.city}</p>
                        <p className="text-gray-700">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.country}</p>
                      </div>
                    )}

                    {(() => { const opts = typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options; const s = STYLE_LABELS[opts?.style]; return s ? (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 font-semibold mb-1">🎨 Style</p>
                        <p className="font-bold text-gray-900">{s.emoji} {s.label}</p>
                      </div>
                    ) : null; })()}

                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-semibold mb-2">Configuration</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Format:</span> <span className="font-semibold">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.format === "fullbody" ? "Corps Entier" : "Portrait"}</span></div>
                        <div><span className="text-gray-500">Personnes:</span> <span className="font-semibold">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.people}</span></div>
                        <div><span className="text-gray-500">Animaux:</span> <span className="font-semibold">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.animals}</span></div>
                        <div><span className="text-gray-500">Fond:</span> <span className="font-semibold">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.background}</span></div>
                        <div><span className="text-gray-500">Impression:</span> <span className="font-semibold">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.printOption}</span></div>
                        <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-600">{selectedOrder.total_price} {selectedOrder.currency}</span></div>
                      </div>
                    </div>

                    {/* Photos — clickable thumbnails */}
                    {(() => { const urls = typeof selectedOrder.photo_urls === 'string' ? JSON.parse(selectedOrder.photo_urls) : selectedOrder.photo_urls; return urls && urls.length > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-2">📸 Photos ({urls.length})</p>
                        <div className="grid grid-cols-3 gap-2">
                          {urls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-yellow-400 transition-all">
                              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null; })()}

                    {/* Status update */}
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-2">Changer le statut</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["new", "in_progress", "completed", "shipped"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(selectedOrder.id, s)}
                            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              selectedOrder.status === s
                                ? STATUS_LABELS[s].color + " ring-2 ring-offset-1 ring-gray-400"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {STATUS_LABELS[s].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedOrder.payment_intent_id && (
                      <p className="text-xs text-gray-400 font-mono">Stripe: {selectedOrder.payment_intent_id}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {tab === "analytics" && (() => {
          const paidOrders = orders.filter((o) => o.status !== "PENDING");
          const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
          const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

          // Revenue by currency
          const revenueByCurrency: Record<string, number> = {};
          paidOrders.forEach((o) => {
            const c = o.currency || "EUR";
            revenueByCurrency[c] = (revenueByCurrency[c] || 0) + Number(o.total_price);
          });

          // Orders by style
          const ordersByStyle: Record<string, number> = {};
          paidOrders.forEach((o) => {
            const opts = typeof o.options === "string" ? JSON.parse(o.options) : o.options;
            const style = opts?.style || "unknown";
            ordersByStyle[style] = (ordersByStyle[style] || 0) + 1;
          });
          const styleEntries = Object.entries(ordersByStyle).sort((a, b) => b[1] - a[1]);
          const maxStyleCount = styleEntries.length > 0 ? styleEntries[0][1] : 1;

          // Orders by day (last 30 days)
          const now = new Date();
          const last30: Record<string, number> = {};
          for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            last30[d.toISOString().slice(0, 10)] = 0;
          }
          paidOrders.forEach((o) => {
            const day = new Date(o.created_at).toISOString().slice(0, 10);
            if (last30[day] !== undefined) last30[day]++;
          });
          const dayEntries = Object.entries(last30);
          const maxDayCount = Math.max(...Object.values(last30), 1);

          // Orders by format
          const formatCounts: Record<string, number> = { portrait: 0, fullbody: 0 };
          paidOrders.forEach((o) => {
            const opts = typeof o.options === "string" ? JSON.parse(o.options) : o.options;
            const f = opts?.format || "portrait";
            formatCounts[f] = (formatCounts[f] || 0) + 1;
          });

          // Orders by print option
          const printCounts: Record<string, number> = {};
          paidOrders.forEach((o) => {
            const opts = typeof o.options === "string" ? JSON.parse(o.options) : o.options;
            const p = opts?.printOption || "Digital";
            printCounts[p] = (printCounts[p] || 0) + 1;
          });
          const printEntries = Object.entries(printCounts).sort((a, b) => b[1] - a[1]);

          return (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">📊 Analytics</h2>
                <p className="text-sm text-gray-500">Vue d&apos;ensemble des performances</p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Chiffre d&apos;affaires</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {Object.entries(revenueByCurrency).map(([c, v]) => (
                      <span key={c} className="block">{v.toFixed(2)} {c}</span>
                    ))}
                    {Object.keys(revenueByCurrency).length === 0 && "0.00 EUR"}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Commandes payées</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{paidOrders.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Panier moyen</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{avgOrderValue.toFixed(2)} €</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Total commandes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</p>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Orders by style */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">🎨 Commandes par style</h3>
                  <div className="space-y-3">
                    {styleEntries.map(([style, count]) => {
                      const s = STYLE_LABELS[style];
                      return (
                        <div key={style} className="flex items-center gap-3">
                          <span className="text-sm font-semibold w-32 truncate">{s ? `${s.emoji} ${s.label}` : style}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.max((count / maxStyleCount) * 100, 8)}%` }}
                            >
                              <span className="text-xs font-bold text-black">{count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {styleEntries.length === 0 && <p className="text-gray-400 text-sm">Aucune donnée</p>}
                  </div>
                </div>

                {/* Orders by print option */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">🖼️ Options d&apos;impression</h3>
                  <div className="space-y-3">
                    {printEntries.map(([opt, count]) => (
                      <div key={opt} className="flex items-center gap-3">
                        <span className="text-sm font-semibold w-32 truncate">{opt}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((count / (printEntries[0]?.[1] || 1)) * 100, 8)}%` }}
                          >
                            <span className="text-xs font-bold text-white">{count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {printEntries.length === 0 && <p className="text-gray-400 text-sm">Aucune donnée</p>}
                  </div>
                </div>
              </div>

              {/* Orders over time (last 30 days) */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
                <h3 className="font-bold text-gray-900 mb-4">📈 Commandes (30 derniers jours)</h3>
                <div className="flex items-end gap-[3px] h-40">
                  {dayEntries.map(([day, count]) => (
                    <div key={day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className="w-full bg-yellow-400 rounded-t transition-all hover:bg-yellow-500"
                        style={{ height: `${Math.max((count / maxDayCount) * 100, 2)}%` }}
                      />
                      <div className="absolute -top-8 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {day.slice(5)} : {count}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                  <span>{dayEntries[0]?.[0]?.slice(5)}</span>
                  <span>{dayEntries[dayEntries.length - 1]?.[0]?.slice(5)}</span>
                </div>
              </div>

              {/* Format split */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">📐 Format</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex rounded-full overflow-hidden h-8 bg-gray-100">
                        {paidOrders.length > 0 && (
                          <>
                            <div className="bg-blue-400 h-full flex items-center justify-center" style={{ width: `${(formatCounts.portrait / paidOrders.length) * 100}%` }}>
                              {formatCounts.portrait > 0 && <span className="text-xs font-bold text-white">{formatCounts.portrait}</span>}
                            </div>
                            <div className="bg-emerald-400 h-full flex items-center justify-center" style={{ width: `${(formatCounts.fullbody / paidOrders.length) * 100}%` }}>
                              {formatCounts.fullbody > 0 && <span className="text-xs font-bold text-white">{formatCounts.fullbody}</span>}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-400 rounded-full"></span> Portrait ({formatCounts.portrait})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-400 rounded-full"></span> Corps Entier ({formatCounts.fullbody})</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">💱 Devises utilisées</h3>
                  <div className="space-y-2">
                    {Object.entries(revenueByCurrency).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                      <div key={c} className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{c}</span>
                        <span className="font-bold text-gray-900">{v.toFixed(2)} {c}</span>
                      </div>
                    ))}
                    {Object.keys(revenueByCurrency).length === 0 && <p className="text-gray-400 text-sm">Aucune donnée</p>}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* ═══ PRICES TAB ═══ */}
        {tab === "prices" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">💰 Gestion des Prix</h2>
              <p className="text-sm text-gray-500">Modifiez les prix de chaque option de personnalisation.</p>
            </div>

            <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { key: "base" as const, label: "Prix de base (Portrait)", icon: "🎨" },
                  { key: "fullbodyExtra" as const, label: "Supplément Corps Entier", icon: "🧍" },
                  { key: "extraPerson" as const, label: "Personne supplémentaire", icon: "👥" },
                  { key: "extraAnimal" as const, label: "Animal supplémentaire", icon: "🐾" },
                  { key: "digital" as const, label: "Option Digital", icon: "💻" },
                  { key: "canvas" as const, label: "Option Portrait sur Toile", icon: "🖼️" },
                  { key: "poster" as const, label: "Option Poster Encadré", icon: "🖼️" },
                  { key: "posterSimple" as const, label: "Option Poster Simple", icon: "📄" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      {item.icon} {item.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={prices[item.key]}
                        onChange={(e) => setPrices({ ...prices, [item.key]: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 pr-8 text-sm font-semibold border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">€</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={savePrices}
                  disabled={savingPrices}
                  className="bg-gray-900 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingPrices ? "Enregistrement..." : "💾 Enregistrer les prix"}
                </button>
                {pricesSaved && (
                  <span className="text-sm text-green-600 font-semibold">✅ Prix mis à jour !</span>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
