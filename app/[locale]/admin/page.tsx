"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { estPhysique } from "@/lib/supportCommande";
import { upload } from "@vercel/blob/client";
import type { PriceSet, PricesByCurrency } from "@/lib/types";
import { DEFAULT_PRICES_BY_CURRENCY } from "@/lib/types";
import { currencies, currencySymbols, currencyFlags, type Currency } from "@/lib/currency";
import type { DbOrder, SupportMessage } from "@/lib/db";
import { lireConsigne } from "@/lib/consigneClient";
import PromoCodesPanel from "@/components/admin/PromoCodesPanel";
import ReviewsPanel from "@/components/admin/ReviewsPanel";

type OrderStatus = "new" | "in_progress" | "completed" | "shipped";

const STYLE_LABELS: Record<string, { label: string; emoji: string }> = {
  simpson: { label: "Simpson", emoji: "🟡" },
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
  const [tab, setTab] = useState<"orders" | "prices" | "promos" | "analytics" | "support" | "avis">("orders");

  // Orders
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);

  // Prices
  const [pricesByCurrency, setPricesByCurrency] = useState<PricesByCurrency>(DEFAULT_PRICES_BY_CURRENCY);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("EUR");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);

  // Final image
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [imageSent, setImageSent] = useState(false);

  // Poster confirmation
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [askingReview, setAskingReview] = useState(false);
  const [reviewAsked, setReviewAsked] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Support inbox
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [syncingSupport, setSyncingSupport] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<number | null>(null);
  const [showAllSupport, setShowAllSupport] = useState(false);
  const [classifyingBacklog, setClassifyingBacklog] = useState(false);
  const [backlogRemaining, setBacklogRemaining] = useState<number | null>(null);

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
      const r = await fetch("/api/prices/all", { headers: { "x-admin-password": password } });
      if (r.ok) setPricesByCurrency(await r.json());
    } catch {}
  }, [password]);

  const fetchSupportMessages = useCallback(async () => {
    setLoadingSupport(true);
    try {
      const r = await fetch("/api/support/messages", { headers: { "x-admin-password": password } });
      if (r.ok) setSupportMessages(await r.json());
    } catch {}
    setLoadingSupport(false);
  }, [password]);

  const handleSyncSupport = async () => {
    setSyncingSupport(true);
    setSyncError(null);
    try {
      const r = await fetch("/api/support/sync", { method: "POST", headers: headers() });
      if (r.ok) {
        await fetchSupportMessages();
      } else {
        const data = await r.json().catch(() => null);
        setSyncError(data?.error || "Erreur de synchronisation.");
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Erreur réseau.");
    }
    setSyncingSupport(false);
  };

  const handleMarkSupportRead = async (id: number) => {
    setSupportMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m)));
    await fetch("/api/support/messages", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id }),
    });
  };

  const handleClassifyBacklog = async () => {
    setClassifyingBacklog(true);
    try {
      let remaining = Infinity;
      while (remaining > 0) {
        const r = await fetch("/api/support/classify-backlog", { method: "POST", headers: headers() });
        if (!r.ok) break;
        const data = await r.json();
        remaining = data.remaining ?? 0;
        setBacklogRemaining(remaining);
        if (data.processed === 0) break;
      }
      await fetchSupportMessages();
    } catch {}
    setClassifyingBacklog(false);
  };

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
      fetchSupportMessages();
    }
  }, [authed, fetchOrders, fetchPrices, fetchSupportMessages]);

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
    await fetch("/api/prices/all", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(pricesByCurrency),
    });
    setSavingPrices(false);
    setPricesSaved(true);
    setTimeout(() => setPricesSaved(false), 2000);
  };

  const updatePriceField = (key: keyof PriceSet, value: number) => {
    setPricesByCurrency({
      ...pricesByCurrency,
      [selectedCurrency]: { ...pricesByCurrency[selectedCurrency], [key]: value },
    });
  };

  // Upload final image to Vercel Blob
  const handleUploadFinalImage = async (file: File) => {
    if (!selectedOrder) return;
    setUploadingImage(true);
    try {
      const blob = await upload(`final/${selectedOrder.id}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      // Save to DB
      await fetch("/api/orders/send-final-image", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerEmail: selectedOrder.customer_email,
          finalImageUrl: blob.url,
          saveOnly: true,
        }),
      });
      // Update local state with new URL
      const updated = { ...selectedOrder, final_image_url: blob.url };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(`Erreur upload: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setUploadingImage(false);
  };

  // Send final image email via Resend
  /* Sur une commande physique, « votre illustration est prete, telechargez-la »
     est le mauvais message : le client attend un objet, et rien ne lui a demande
     s'il voulait une retouche avant que la toile ne parte a l'impression. On ne
     bloque pas — il y a des cas legitimes, un renvoi par exemple — mais on ne
     laisse plus passer le geste par inadvertance. */
  const handleSendFinalImage = async () => {
    const opts = typeof selectedOrder?.options === "string"
      ? JSON.parse(selectedOrder.options)
      : selectedOrder?.options;
    if (
      selectedOrder &&
      estPhysique(opts) &&
      selectedOrder.poster_confirmation_status !== "confirmed" &&
      !confirm(
        "Cette commande est un tirage physique et le client n'a pas encore validé son portrait.\n\n" +
          "Cet e-mail lui dira que son illustration est prête à télécharger — pas qu'on attend son accord avant impression.\n\n" +
          "Envoyer quand même ?"
      )
    ) {
      return;
    }
    if (!selectedOrder?.final_image_url) return;
    setSendingImage(true);
    setImageSent(false);
    try {
      const r = await fetch("/api/orders/send-final-image", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerEmail: selectedOrder.customer_email,
          customerName: selectedOrder.customer_name,
          finalImageUrl: selectedOrder.final_image_url,
          orderRef: selectedOrder.id,
          detectedCountry: selectedOrder.detected_country,
        }),
      });
      if (r.ok) {
        setImageSent(true);
        const updated = { ...selectedOrder, final_image_sent_at: new Date().toISOString() };
        setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setTimeout(() => setImageSent(false), 4000);
      } else {
        const data = await r.json().catch(() => null);
        alert(`Erreur envoi: ${data?.error || "Erreur inconnue"}`);
      }
    } catch (err) {
      alert(`Erreur réseau: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setSendingImage(false);
  };

  // Send poster confirmation email via Resend (before printing/shipping)
  /* Demande d'avis a la demande.
     Le cron sait le faire, mais seulement dix jours apres l'envoi de l'image
     finale. Avec zero avis en base, aucune etoile n'apparait nulle part — ni
     sur les 36 fiches, ni dans les resultats de recherche — et la boucle ne
     peut pas s'amorcer toute seule. Ce bouton permet de solliciter au moment
     choisi, portrait par portrait. */
  const handleAskReview = async () => {
    if (!selectedOrder || askingReview) return;
    setAskingReview(true);
    setReviewAsked(null);
    try {
      const r = await fetch("/api/orders/review-request", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ orderId: selectedOrder.id }),
      });
      const data = await r.json().catch(() => ({}));
      setReviewAsked(r.ok ? "ok" : data.error || "Envoi impossible.");
    } catch {
      setReviewAsked("Envoi impossible.");
    } finally {
      setAskingReview(false);
    }
  };

  const handleSendPosterConfirmation = async () => {
    if (!selectedOrder?.final_image_url) return;
    setSendingConfirmation(true);
    setConfirmationSent(false);
    try {
      const r = await fetch("/api/orders/send-poster-confirmation", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerEmail: selectedOrder.customer_email,
          customerName: selectedOrder.customer_name,
          finalImageUrl: selectedOrder.final_image_url,
          orderRef: selectedOrder.id,
          detectedCountry: selectedOrder.detected_country,
        }),
      });
      if (r.ok) {
        setConfirmationSent(true);
        const updated = {
          ...selectedOrder,
          poster_confirmation_sent_at: new Date().toISOString(),
          poster_confirmation_status: null,
          poster_confirmation_note: null,
        };
        setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setTimeout(() => setConfirmationSent(false), 4000);
      } else {
        const data = await r.json().catch(() => null);
        alert(`Erreur envoi: ${data?.error || "Erreur inconnue"}`);
      }
    } catch (err) {
      alert(`Erreur réseau: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setSendingConfirmation(false);
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
            onClick={() => setTab("support")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "support" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>💬</span> Support
            {supportMessages.filter((m) => !m.read_at && m.category !== "spam" && m.category !== "notification").length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {supportMessages.filter((m) => !m.read_at && m.category !== "spam" && m.category !== "notification").length}
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
          <button
            onClick={() => setTab("avis")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "avis" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>⭐</span> Avis
          </button>
          <button
            onClick={() => setTab("promos")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${tab === "promos" ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-gray-800"}`}
          >
            <span>🎟️</span> Codes promo
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
                          {/* Ce qui attend une réaction, visible sans ouvrir la
                              commande : un client qui demande une modification
                              ou qui écrit sans réponse se voyait autrement
                              seulement en ouvrant chaque fiche une par une. */}
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {/* Photos manquantes : depuis qu'on peut payer
                                  sans les envoyer, c'est l'état qui bloque
                                  l'illustrateur et qui doit se voir en premier. */}
                              {(() => {
                                const u = typeof o.photo_urls === "string" ? JSON.parse(o.photo_urls) : o.photo_urls;
                                return !Array.isArray(u) || u.length === 0 ? (
                                  <span title="En attente des photos du client">📸</span>
                                ) : null;
                              })()}
                              {o.poster_confirmation_status === "changes_requested" && (
                                <span title="Modification demandée par le client">✏️</span>
                              )}
                              {o.poster_confirmation_status === "confirmed" && (
                                <span title="Portrait validé par le client">✅</span>
                              )}
                              {supportMessages.some(
                                (m) => m.order_id === o.id && !m.read_at && m.category !== "spam"
                              ) && (
                                <span
                                  title="Message client non lu"
                                  className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0"
                                />
                              )}
                              {o.customer_email}
                            </span>
                          </td>
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

                    {selectedOrder.detected_country && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">🌍 Pays détecté (IP)</p>
                        <p className="font-semibold">{selectedOrder.detected_country}</p>
                      </div>
                    )}

                    {/* L'origine du premier contact. Sans elle, la question
                        « cette vente vient d'où ? » restait sans réponse, et
                        l'information dormait dans un outil tiers. */}
                    {selectedOrder.origine && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-xs text-amber-700 font-semibold mb-1">🧭 Origine (première visite)</p>
                        <p className="font-semibold">
                          {selectedOrder.origine.utm_source
                            ? `${selectedOrder.origine.utm_source}${
                                selectedOrder.origine.utm_campaign
                                  ? ` · ${selectedOrder.origine.utm_campaign}`
                                  : ""
                              }`
                            : selectedOrder.origine.referent}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          arrivée sur {selectedOrder.origine.arrivee} le{" "}
                          {new Date(selectedOrder.origine.le).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    )}

                    {/* Les réponses du client, rattachées à CETTE commande.
                        Le lien existait déjà en base — la synchro IMAP lit
                        `In-Reply-To` et retombe sur l'adresse du client — mais
                        il ne vivait que dans l'onglet Support, où une demande
                        de retouche se perd entre deux sollicitations
                        commerciales. Elle se lit maintenant là où on la
                        traite. */}
                    {(() => {
                      const reponses = supportMessages
                        .filter((m) => m.order_id === selectedOrder.id && m.category !== "spam")
                        .sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at));
                      if (!reponses.length) return null;
                      const nonLus = reponses.filter((m) => !m.read_at).length;
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-700 font-semibold mb-2">
                            💬 Réponses du client ({reponses.length}
                            {nonLus > 0 ? ` · ${nonLus} non lue${nonLus > 1 ? "s" : ""}` : ""})
                          </p>
                          <div className="space-y-2">
                            {reponses.slice(0, 5).map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-md p-2 text-sm ${
                                  m.read_at ? "bg-white/60" : "bg-white border border-amber-300"
                                }`}
                              >
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-semibold text-gray-800 truncate">
                                    {m.subject || "(sans objet)"}
                                  </span>
                                  <span className="text-[11px] text-gray-500 shrink-0">
                                    {new Date(m.received_at).toLocaleString("fr-FR", {
                                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {m.body_text && (
                                  <p className="text-gray-700 mt-1 whitespace-pre-line">
                                    {m.body_text.slice(0, 400)}
                                    {m.body_text.length > 400 ? "…" : ""}
                                  </p>
                                )}
                                {!m.read_at && (
                                  <button
                                    onClick={() => handleMarkSupportRead(m.id)}
                                    className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                                  >
                                    Marquer comme lue
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <a
                            href={`mailto:${selectedOrder.customer_email}`}
                            className="inline-block mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900"
                          >
                            Répondre par e-mail →
                          </a>
                        </div>
                      );
                    })()}

                    {selectedOrder.customer_address && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">📦 Adresse de livraison</p>
                        <p className="text-gray-700">{selectedOrder.customer_address}</p>
                        {(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options)?.addressLine2 && (
                          <p className="text-gray-700">{(typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options).addressLine2}</p>
                        )}
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

                    {/* Consigne du client.
                        Elle était stockée depuis toujours et affichée nulle
                        part : l'illustrateur ouvrait la commande sans le seul
                        texte que le client ait écrit — et une question posée
                        au moment de commander ne remontait à personne.
                        Placée juste avant les photos, à l'endroit où l'on
                        prépare le dessin. */}
                    {(() => {
                      const o = typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options;
                      const consigne = lireConsigne(o?.description);
                      if (!consigne.texte) return null;
                      return (
                        <div className={`rounded-lg p-3 border ${consigne.question ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200"}`}>
                          <p className={`text-xs font-semibold mb-2 ${consigne.question ? "text-amber-700" : "text-blue-700"}`}>
                            {consigne.question ? "❓ Consigne — LE CLIENT POSE UNE QUESTION" : "✏️ Consigne du client"}
                          </p>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{consigne.texte}</p>
                          {consigne.question && (
                            <a
                              href={`mailto:${selectedOrder.customer_email}?subject=${encodeURIComponent(`Votre commande Cartoonova #${String(selectedOrder.id).slice(0, 8)}`)}`}
                              className="mt-2 inline-block text-xs font-semibold text-amber-800 underline"
                            >
                              Répondre à {selectedOrder.customer_email}
                            </a>
                          )}
                        </div>
                      );
                    })()}

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

                    {/* Final image upload & send */}
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <p className="text-xs text-emerald-700 font-semibold mb-2">🎨 Image finale</p>

                      {selectedOrder.final_image_url ? (
                        <div className="space-y-2">
                          <a href={selectedOrder.final_image_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-emerald-300 hover:ring-2 hover:ring-emerald-400 transition-all">
                            <img src={selectedOrder.final_image_url} alt="Image finale" className="w-full h-auto object-cover" />
                          </a>
                          <div className="flex gap-2">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImage}
                              className="flex-1 px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {uploadingImage ? "Upload..." : "Remplacer"}
                            </button>
                            <button
                              onClick={handleSendFinalImage}
                              disabled={sendingImage}
                              className="flex-[2] px-3 py-2 text-xs font-bold rounded-lg border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {sendingImage ? "Envoi en cours..." : selectedOrder.final_image_sent_at ? "Renvoyer par email" : "Envoyer au client"}
                            </button>
                          </div>
                          {selectedOrder.final_image_sent_at && (
                            <p className="text-[10px] text-emerald-600 font-semibold text-center">
                              Envoyé le {new Date(selectedOrder.final_image_sent_at).toLocaleString("fr-FR")}
                            </p>
                          )}
                          {imageSent && (
                            <p className="text-xs text-emerald-600 font-bold text-center bg-emerald-100 rounded-lg py-1">
                              Email envoyé avec succès !
                            </p>
                          )}

                          {/* Poster confirmation before printing/shipping */}
                          <div className="pt-2 mt-2 border-t border-emerald-200 space-y-2">
                            {/* Sur un tirage, la validation n'est pas une option :
                                une toile partie sans accord se refait a perte. */}
                            {(() => {
                              const opts = typeof selectedOrder.options === "string"
                                ? JSON.parse(selectedOrder.options)
                                : selectedOrder.options;
                              if (!estPhysique(opts)) return null;
                              if (selectedOrder.poster_confirmation_status === "confirmed") return null;
                              return (
                                <p className="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2 py-1.5">
                                  🖼️ Tirage physique — faites valider le portrait avant
                                  de lancer l&apos;impression.
                                </p>
                              );
                            })()}
                            <button
                              onClick={handleSendPosterConfirmation}
                              disabled={sendingConfirmation}
                              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-amber-500 bg-amber-500 text-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {sendingConfirmation
                                ? "Envoi en cours..."
                                : selectedOrder.poster_confirmation_sent_at
                                ? "📮 Renvoyer la demande de confirmation"
                                : "📮 Envoyer pour confirmation avant impression"}
                            </button>
                            {selectedOrder.poster_confirmation_status === "confirmed" ? (
                              <p className="text-[10px] text-emerald-600 font-semibold text-center">
                                ✅ Client a confirmé le{" "}
                                {selectedOrder.poster_confirmation_responded_at &&
                                  new Date(selectedOrder.poster_confirmation_responded_at).toLocaleString("fr-FR")}
                              </p>
                            ) : selectedOrder.poster_confirmation_status === "changes_requested" ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-amber-600 font-semibold text-center">
                                  ✏️ Modification demandée le{" "}
                                  {selectedOrder.poster_confirmation_responded_at &&
                                    new Date(selectedOrder.poster_confirmation_responded_at).toLocaleString("fr-FR")}
                                </p>
                                {selectedOrder.poster_confirmation_note && (
                                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 whitespace-pre-wrap">
                                    {selectedOrder.poster_confirmation_note}
                                  </p>
                                )}
                                {/* Les photos jointes a la demande. Sans elles,
                                    « il manque mes tatouages » est illisible. */}
                                {(() => {
                                  const jointes = typeof selectedOrder.poster_confirmation_photos === "string"
                                    ? JSON.parse(selectedOrder.poster_confirmation_photos)
                                    : selectedOrder.poster_confirmation_photos;
                                  if (!Array.isArray(jointes) || jointes.length === 0) return null;
                                  return (
                                    <div className="grid grid-cols-4 gap-2">
                                      {jointes.map((url: string, i: number) => (
                                        <a
                                          key={i}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block aspect-square rounded-lg overflow-hidden border border-amber-300 hover:ring-2 hover:ring-amber-400 transition-all"
                                        >
                                          <img src={url} alt={`Retouche ${i + 1}`} className="w-full h-full object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : selectedOrder.poster_confirmation_sent_at ? (
                              <p className="text-[10px] text-gray-500 font-semibold text-center">
                                ⏳ En attente de réponse du client (envoyé le{" "}
                                {new Date(selectedOrder.poster_confirmation_sent_at).toLocaleString("fr-FR")})
                              </p>
                            ) : null}
                            {confirmationSent && (
                              <p className="text-xs text-amber-600 font-bold text-center bg-amber-100 rounded-lg py-1">
                                Email de confirmation envoyé !
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="w-full px-3 py-4 text-xs font-bold rounded-lg border-2 border-dashed border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-all cursor-pointer disabled:opacity-50 flex flex-col items-center gap-1"
                          >
                            <span className="text-lg">{uploadingImage ? "⏳" : "📤"}</span>
                            {uploadingImage ? "Upload en cours..." : "Uploader l'image finale"}
                          </button>
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFinalImage(file);
                          e.target.value = "";
                        }}
                      />
                    </div>

                    {/* Réponses du client par e-mail.
                        La synchronisation IMAP rattache déjà chaque message à
                        sa commande — par l'en-tête In-Reply-To, sinon par
                        l'adresse du client. Cette liaison n'était visible nulle
                        part : il fallait ouvrir l'onglet Support et retrouver
                        le message à la main, sans savoir qu'il existait.
                        Les messages sont déjà chargés à l'authentification, il
                        n'y a donc rien à aller chercher ici. */}
                    {(() => {
                      const fil = supportMessages
                        .filter((m) => m.order_id === selectedOrder.id && m.category !== "spam")
                        .sort((a, b) => +new Date(a.received_at) - +new Date(b.received_at));
                      if (!fil.length) return null;
                      const nonLus = fil.filter((m) => !m.read_at).length;
                      return (
                        <div className={`rounded-lg p-3 border ${nonLus ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className={`text-xs font-semibold ${nonLus ? "text-amber-700" : "text-gray-500"}`}>
                              💬 Réponses du client ({fil.length})
                              {nonLus > 0 && ` — ${nonLus} non lu${nonLus > 1 ? "s" : ""}`}
                            </p>
                            {nonLus > 0 && (
                              <button
                                onClick={() => fil.filter((m) => !m.read_at).forEach((m) => handleMarkSupportRead(m.id))}
                                className="text-[10px] font-bold text-amber-700 underline cursor-pointer"
                              >
                                Tout marquer lu
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {fil.map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-lg p-2 border ${m.read_at ? "bg-white border-gray-200" : "bg-white border-amber-300"}`}
                              >
                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-gray-700 truncate">{m.from_email}</span>
                                  <span className="text-[10px] text-gray-400 shrink-0">
                                    {new Date(m.received_at).toLocaleString("fr-FR")}
                                  </span>
                                </div>
                                {m.subject && (
                                  <p className="text-[11px] font-semibold text-gray-800 mb-1">{m.subject}</p>
                                )}
                                {m.body_text && (
                                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {m.body_text.length > 700 ? m.body_text.slice(0, 700) + "…" : m.body_text}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                          <a
                            href={`mailto:${selectedOrder.customer_email}?subject=${encodeURIComponent(`Re: votre commande Cartoonova #${String(selectedOrder.id).slice(0, 8)}`)}`}
                            className="mt-2 inline-block text-xs font-semibold text-gray-700 underline"
                          >
                            Répondre à {selectedOrder.customer_email}
                          </a>
                        </div>
                      );
                    })()}

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

                    {/* Demande d'avis a la demande.
                        Zero avis en base, donc aucune etoile sur les 36 fiches
                        ni dans les resultats de recherche — et un assistant qui
                        arbitre entre marchands s'appuie massivement sur la
                        reputation. Le cron ne sollicite qu'a J+10 apres l'envoi
                        de l'image finale ; pour amorcer, il faut pouvoir le
                        faire portrait par portrait, au moment choisi. */}
                    <div className="rounded-lg p-3 border border-amber-200 bg-amber-50">
                      <p className="text-xs text-amber-700 font-semibold mb-2">⭐ Avis client</p>
                      <button
                        onClick={handleAskReview}
                        disabled={askingReview || !selectedOrder.customer_email}
                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-amber-500 bg-amber-500 text-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {askingReview
                          ? "Envoi en cours..."
                          : selectedOrder.review_request_sent_at
                          ? "⭐ Redemander un avis"
                          : "⭐ Demander un avis"}
                      </button>
                      {reviewAsked === "ok" && (
                        <p className="mt-2 text-[11px] font-bold text-emerald-700 text-center">
                          Invitation envoyée à {selectedOrder.customer_email}
                        </p>
                      )}
                      {reviewAsked && reviewAsked !== "ok" && (
                        <p className="mt-2 text-[11px] font-bold text-red-600 text-center">{reviewAsked}</p>
                      )}
                      {selectedOrder.review_request_sent_at && reviewAsked !== "ok" && (
                        <p className="mt-2 text-[10px] text-gray-500 text-center">
                          Déjà demandé le{" "}
                          {new Date(selectedOrder.review_request_sent_at).toLocaleString("fr-FR")}
                        </p>
                      )}
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

        {/* ═══ SUPPORT TAB ═══ */}
        {tab === "support" && (() => {
          const unclassifiedCount = supportMessages.filter((m) => !m.category).length;
          const hiddenCount = supportMessages.filter((m) => m.category === "spam" || m.category === "notification").length;
          const visibleMessages = showAllSupport
            ? supportMessages
            : supportMessages.filter((m) => m.category !== "spam" && m.category !== "notification");
          const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
            customer: { label: "🟢 Client", color: "bg-emerald-100 text-emerald-700" },
            notification: { label: "🔵 Notification", color: "bg-blue-100 text-blue-700" },
            spam: { label: "🔴 Spam", color: "bg-red-100 text-red-700" },
          };

          return (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">💬 Support</h2>
                  <p className="text-sm text-gray-500">
                    Emails reçus sur support@cartoonova.com — synchronisation automatique 1x/jour, ou manuelle ci-dessous.
                  </p>
                </div>
                <div className="flex gap-2">
                  {unclassifiedCount > 0 && (
                    <button
                      onClick={handleClassifyBacklog}
                      disabled={classifyingBacklog}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {classifyingBacklog
                        ? `🧹 Classement... (${backlogRemaining ?? unclassifiedCount} restants)`
                        : `🧹 Classer ${unclassifiedCount} ancien(s) message(s)`}
                    </button>
                  )}
                  <button
                    onClick={handleSyncSupport}
                    disabled={syncingSupport}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {syncingSupport ? "⏳ Vérification..." : "🔄 Vérifier maintenant"}
                  </button>
                </div>
              </div>

              {syncError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                  {syncError}
                </div>
              )}

              {hiddenCount > 0 && (
                <div className="mb-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
                  <span>{hiddenCount} message(s) spam/notification masqué(s)</span>
                  <button
                    onClick={() => setShowAllSupport((v) => !v)}
                    className="font-semibold text-gray-900 hover:underline cursor-pointer"
                  >
                    {showAllSupport ? "Masquer" : "Afficher tout"}
                  </button>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {loadingSupport ? (
                  <p className="px-4 py-12 text-center text-gray-400">Chargement...</p>
                ) : visibleMessages.length === 0 ? (
                  <p className="px-4 py-12 text-center text-gray-400">Aucun message pour le moment.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {visibleMessages.map((m) => {
                      const isExpanded = expandedMessageId === m.id;
                      const linkedOrder = m.order_id ? orders.find((o) => o.id === m.order_id) : null;
                      const badge = m.category ? CATEGORY_BADGE[m.category] : null;
                      return (
                        <div key={m.id} className={!m.read_at ? "bg-blue-50/40" : ""}>
                          <button
                            onClick={() => {
                              setExpandedMessageId(isExpanded ? null : m.id);
                              if (!m.read_at) handleMarkSupportRead(m.id);
                            }}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            {!m.read_at && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm truncate ${!m.read_at ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                  {m.from_email}
                                </span>
                                {linkedOrder && (
                                  <span className="flex-shrink-0 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                                    📦 {linkedOrder.id.slice(0, 8)}
                                  </span>
                                )}
                                {showAllSupport && badge && (
                                  <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{m.subject || "(sans objet)"}</p>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(m.received_at).toLocaleString("fr-FR")}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                {m.body_text || "(pas de contenu texte)"}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}

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
        {tab === "promos" && <PromoCodesPanel password={password} />}

        {/* ═══ AVIS TAB ═══ */}
        {tab === "avis" && <ReviewsPanel password={password} />}

        {tab === "prices" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">💰 Gestion des Prix</h2>
              <p className="text-sm text-gray-500">Modifiez les prix de chaque option, indépendamment pour chaque devise.</p>
            </div>

            <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex gap-2 mb-6 border-b border-gray-100 pb-4 flex-wrap">
                {currencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCurrency(c)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      selectedCurrency === c
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {currencyFlags[c]} {c}
                  </button>
                ))}
              </div>

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
                        value={pricesByCurrency[selectedCurrency][item.key]}
                        onChange={(e) => updatePriceField(item.key, Number(e.target.value))}
                        className="w-full px-4 py-2.5 pr-10 text-sm font-semibold border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">{currencySymbols[selectedCurrency]}</span>
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
                  {savingPrices ? "Enregistrement..." : "💾 Enregistrer tous les prix"}
                </button>
                {pricesSaved && (
                  <span className="text-sm text-green-600 font-semibold">✅ Tous les prix mis à jour !</span>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
