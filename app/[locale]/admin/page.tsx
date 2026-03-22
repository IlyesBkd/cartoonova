"use client";

import { useState, useEffect, useCallback } from "react";
import type { Prices } from "@/lib/types";
import { DEFAULT_PRICES } from "@/lib/types";

/* ─── Prisma DB Order shape ──────────────────────────────────────────── */
interface DbOrder {
  id: string;
  customerEmail: string;
  customerName: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerPostal: string | null;
  customerCountry: string | null;
  customerPhone: string | null;
  totalPrice: number;
  currency: string;
  options: {
    format?: string;
    people?: number;
    animals?: number;
    background?: string;
    printOption?: string;
    description?: string;
  };
  status: string;
  photoUrls: string[];
  stripePaymentId: string | null;
  createdAt: string;
}

type OrderStatus = "new" | "in_progress" | "completed" | "shipped";

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: "Nouvelle", color: "bg-blue-100 text-blue-800 border-blue-300" },
  in_progress: { label: "En cours", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-800 border-green-300" },
  shipped: { label: "Expédiée", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"orders" | "prices">("orders");

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
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Produit</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">Aucune commande pour le moment.</td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-yellow-50 transition-colors ${selectedOrder?.id === o.id ? "bg-yellow-50" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3 font-medium">{o.customerEmail}</td>
                          <td className="px-4 py-3 text-gray-500">{o.options?.printOption || "—"}</td>
                          <td className="px-4 py-3 text-right font-bold">{o.totalPrice} {o.currency}</td>
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
                      <p className="font-medium">{selectedOrder.customerEmail}</p>
                      {selectedOrder.customerName && (
                        <p className="text-gray-600">{selectedOrder.customerName}</p>
                      )}
                      {selectedOrder.customerPhone && <p className="text-gray-600">📞 {selectedOrder.customerPhone}</p>}
                    </div>

                    {selectedOrder.customerAddress && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">📦 Adresse de livraison</p>
                        <p className="text-gray-700">{selectedOrder.customerAddress}</p>
                        <p className="text-gray-700">{selectedOrder.customerPostal} {selectedOrder.customerCity}</p>
                        <p className="text-gray-700">{selectedOrder.customerCountry}</p>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-semibold mb-2">Configuration</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Format:</span> <span className="font-semibold">{selectedOrder.options?.format === "fullbody" ? "Corps Entier" : "Portrait"}</span></div>
                        <div><span className="text-gray-500">Personnes:</span> <span className="font-semibold">{selectedOrder.options?.people ?? 1}</span></div>
                        <div><span className="text-gray-500">Animaux:</span> <span className="font-semibold">{selectedOrder.options?.animals ?? 0}</span></div>
                        <div><span className="text-gray-500">Fond:</span> <span className="font-semibold">{selectedOrder.options?.background || "—"}</span></div>
                        <div><span className="text-gray-500">Impression:</span> <span className="font-semibold">{selectedOrder.options?.printOption || "—"}</span></div>
                        <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-600">{selectedOrder.totalPrice} {selectedOrder.currency}</span></div>
                      </div>
                    </div>

                    {/* Photos — clickable thumbnails */}
                    {selectedOrder.photoUrls.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-2">📸 Photos ({selectedOrder.photoUrls.length})</p>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedOrder.photoUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-yellow-400 transition-all">
                              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {selectedOrder.stripePaymentId && (
                      <p className="text-xs text-gray-400 font-mono">Stripe: {selectedOrder.stripePaymentId}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

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
