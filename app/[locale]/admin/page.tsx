"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { estPhysique, decrireSupport } from "@/lib/supportCommande";
import { toEUR } from "@/lib/currency";
import { upload } from "@vercel/blob/client";
import type { PriceSet, PricesByCurrency } from "@/lib/types";
import { DEFAULT_PRICES_BY_CURRENCY } from "@/lib/types";
import { currencies, currencySymbols, currencyFlags, type Currency } from "@/lib/currency";
import type { DbOrder, SupportMessage, SupportReply } from "@/lib/db";
import { lireConsigne } from "@/lib/consigneClient";
import { CATALOGUE } from "@/lib/catalogue";
import PromoCodesPanel from "@/components/admin/PromoCodesPanel";
import ReviewsPanel from "@/components/admin/ReviewsPanel";
import TraductionFr from "@/components/admin/TraductionFr";

type OrderStatus = "new" | "in_progress" | "completed" | "shipped";

/**
 * A quoi se rattache un courrier qu'on envoie.
 *
 * Deux cas, et ils ne se ramenent pas l'un a l'autre. Repondre a un e-mail
 * recu, c'est se raccrocher a un message existant : son adresse, son objet,
 * son identifiant de fil. Ecrire a un client depuis sa commande, c'est ouvrir
 * quelque chose — il n'y a ni objet ni fil, et l'adresse est celle du
 * paiement.
 *
 * Les confondre coute cher dans les deux sens : repondre a l'adresse de
 * paiement rate le client qui ecrit depuis une autre boite, ce qui arrive des
 * qu'un cadeau change de mains ; et poser un `In-Reply-To` sur un fil qui
 * n'existe pas desoriente les logiciels de messagerie au lieu de les aider.
 */
type CibleCourrier =
  | { type: "message"; message: SupportMessage }
  | { type: "commande"; commande: DbOrder };

/* La cle sous laquelle vit le brouillon. Prefixee parce qu'un identifiant de
   message est un entier et celui d'une commande un UUID : sans prefixe, rien
   ne garantirait qu'ils ne se croisent jamais. */
const cleCible = (c: CibleCourrier) =>
  c.type === "message" ? `msg-${c.message.id}` : `cmd-${c.commande.id}`;

const destinataireCible = (c: CibleCourrier) =>
  c.type === "message" ? c.message.from_email : c.commande.customer_email;

const rattachement = (c: CibleCourrier) =>
  c.type === "message" ? { messageId: c.message.id } : { orderId: c.commande.id };

/* Une date ISO vers ce qu'attend `<input type="datetime-local">` : l'heure
   LOCALE, sans fuseau. Tronquer un `toISOString` afficherait de l'UTC — 9 h
   dans le champ pour un envoi qui arrivera a 10 h heure de Paris, 11 h l'ete.
   Le decalage est donc retire avant la troncature. */
const pourChampDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const objetParDefaut = (c: CibleCourrier) =>
  c.type === "commande" ? `Votre commande Cartoonova #${String(c.commande.id).slice(0, 8)}` : "";


/* Les six univers historiques ont leur emoji. Les trente autres du catalogue
   n'en ont pas et n'en demandent pas : leur nom suffit a reconnaitre la
   commande. Ce bloc ne sert plus qu'a ca — le NOM, lui, vient du catalogue. */
const STYLE_EMOJIS: Record<string, string> = {
  simpson: "🟡",
  dbz: "⚡",
  disney: "✨",
  ghibli: "🌸",
  onepiece: "🏴‍☠️",
  rickandmorty: "🌀",
};

const UNIVERS_PAR_SLUG = new Map(CATALOGUE.map((p) => [p.slug, p.univers]));

/**
 * Le style d'une commande, tel qu'il s'affiche.
 *
 * La commande enregistre le slug canonique de la fiche (`options.style`), et
 * le catalogue en compte trente-six. Une liste ecrite a la main n'en couvrait
 * que six : toute commande Naruto, Batman ou Pokemon s'affichait « — », comme
 * si le style n'avait pas ete transmis. C'est le catalogue qui fait foi, y
 * compris pour une fiche depubliee depuis — une commande passee garde le droit
 * d'etre lue. Un slug vraiment inconnu s'affiche brut plutot que de
 * disparaitre : mieux vaut un slug moche qu'un tiret muet.
 */
function libelleStyle(slug: unknown): { label: string; emoji: string } | null {
  if (typeof slug !== "string" || !slug) return null;
  return { label: UNIVERS_PAR_SLUG.get(slug) ?? slug, emoji: STYLE_EMOJIS[slug] ?? "🎨" };
}

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
  /* Envoi differe. Le champ de date n'est pas controle : il est remonte par sa
     `key` des que la commande ou la date changent, ce qui evite un etat de plus
     a resynchroniser a chaque selection dans la liste. */
  const dateEnvoiRef = useRef<HTMLInputElement>(null);
  const [programmationEnCours, setProgrammationEnCours] = useState(false);

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

  /* Reponses aux clients. Le brouillon est garde PAR MESSAGE : un champ
     unique perdait le texte en cours des qu'on depliait un autre message pour
     y verifier quelque chose — ce qu'on fait justement en repondant. */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [objets, setObjets] = useState<Record<string, string>>({});
  const [assistees, setAssistees] = useState<Record<string, boolean>>({});
  const [redactionEnCours, setRedactionEnCours] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null);
  const [erreurReponse, setErreurReponse] = useState<Record<string, string>>({});
  /* Ce qui est parti du support. Les reponses accrochees a un message recu
     voyagent deja avec lui ; cette liste sert la fiche commande, ou un
     courrier qu'on a ouvert soi-meme n'a aucun message auquel s'accrocher. */
  const [sortants, setSortants] = useState<SupportReply[]>([]);

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

  const fetchSupportOutbox = useCallback(async () => {
    try {
      const r = await fetch("/api/support/outbox", { headers: { "x-admin-password": password } });
      if (r.ok) setSortants(await r.json());
    } catch {}
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

  /* Un brouillon ne s'enregistre nulle part : deux clics donnent deux
     propositions, et celle qu'on jette ne laisse pas de trace. Seul le
     courrier envoye entre au fil. */
  const handleRedigerReponse = async (cible: CibleCourrier) => {
    const cle = cleCible(cible);
    setRedactionEnCours(cle);
    setErreurReponse((prev) => ({ ...prev, [cle]: "" }));
    try {
      const r = await fetch("/api/support/draft", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(rattachement(cible)),
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data?.brouillon) {
        setBrouillons((prev) => ({ ...prev, [cle]: data.brouillon }));
        setAssistees((prev) => ({ ...prev, [cle]: true }));
      } else {
        setErreurReponse((prev) => ({ ...prev, [cle]: data?.error || "La rédaction a échoué." }));
      }
    } catch (e) {
      setErreurReponse((prev) => ({
        ...prev,
        [cle]: e instanceof Error ? e.message : "Erreur réseau.",
      }));
    }
    setRedactionEnCours(null);
  };

  const handleEnvoyerReponse = async (cible: CibleCourrier) => {
    const cle = cleCible(cible);
    const corps = (brouillons[cle] || "").trim();
    if (!corps) return;
    setEnvoiEnCours(cle);
    setErreurReponse((prev) => ({ ...prev, [cle]: "" }));
    try {
      const r = await fetch("/api/support/reply", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          ...rattachement(cible),
          corps,
          objet: objets[cle] ?? objetParDefaut(cible),
          assisteeIa: Boolean(assistees[cle]),
        }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok) {
        /* Le champ ne se vide qu'une fois l'envoi confirme. Sur une erreur le
           texte reste entier : personne ne doit reecrire une reponse parce que
           Resend a renvoye un 429. */
        setBrouillons((prev) => ({ ...prev, [cle]: "" }));
        setAssistees((prev) => ({ ...prev, [cle]: false }));
        await Promise.all([fetchSupportMessages(), fetchSupportOutbox()]);
      } else {
        setErreurReponse((prev) => ({ ...prev, [cle]: data?.error || "L'envoi a échoué." }));
      }
    } catch (e) {
      setErreurReponse((prev) => ({
        ...prev,
        [cle]: e instanceof Error ? e.message : "Erreur réseau.",
      }));
    }
    setEnvoiEnCours(null);
  };

  /* Les deux morceaux de l'echange sortant — ce qui est parti, et de quoi
     ecrire la suite — sont des fonctions et non des composants.

     Un composant declare dans le corps d'`AdminPage` serait recree a chaque
     rendu : React y verrait un type different, demonterait l'ancien et
     remonterait le nouveau, et le champ de saisie perdrait le curseur a
     chaque frappe. Une fonction qui rend du JSX est simplement remplacee par
     son contenu, sans cette identite instable. */

  /** Un courrier parti, tel qu'il se relit. */
  const courrierEnvoye = (r: SupportReply) => (
    <div key={`env-${r.id}`} className="border-l-2 border-emerald-300 bg-emerald-50/60 rounded-r-xl px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] font-bold text-emerald-800 truncate">
          ↩ Envoyé à {r.to_email}
          {r.assistee_ia && " · brouillon IA"}
        </span>
        <span className="text-[10px] text-gray-400 shrink-0">
          {new Date(r.sent_at).toLocaleString("fr-FR")}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body_text}</p>
    </div>
  );

  /** Ce qu'on a deja repondu a ce message, du plus ancien au plus recent. */
  const reponsesEnvoyees = (m: SupportMessage) => {
    const reponses = m.replies ?? [];
    if (!reponses.length) return null;
    return <div className="space-y-2">{reponses.map(courrierEnvoye)}</div>;
  };

  /**
   * La zone de redaction, la meme dans l'onglet Support et dans la fiche
   * commande.
   *
   * `contexte` dit ce que le modele a sous les yeux. Dans la fiche il est
   * inutile — on est deja dans la commande ; dans l'onglet Support il repond a
   * la question qu'on se pose avant de cliquer : « est-ce qu'il sait de quelle
   * commande on parle ? »
   */
  const zoneRedaction = (cible: CibleCourrier, contexte: string | null) => {
    const cle = cleCible(cible);
    const brouillon = brouillons[cle] || "";
    /* Les marqueurs que le modele laisse quand un fait lui manque. Tant qu'il
       en reste un, l'envoi est ferme : « [A VERIFIER : date d'envoi du
       colis] » dans la boite d'un client est pire que pas de reponse du tout,
       et c'est exactement ce qu'un clic distrait sur « Envoyer » produirait. */
    const aCompleter = /\[(A VERIFIER|DECISION)/i.test(brouillon);
    /* L'objet ne se saisit que lorsqu'on OUVRE le fil. En reponse il se deduit
       du message recu — le proposer a la saisie inviterait a le reecrire, et un
       objet reecrit rompt le regroupement chez le client. */
    const objet = cible.type === "commande" ? (objets[cle] ?? objetParDefaut(cible)) : null;

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="text-xs font-semibold text-gray-500 truncate">
            {cible.type === "message" ? "Répondre à" : "Écrire à"} {destinataireCible(cible)}
          </p>
          <button
            onClick={() => handleRedigerReponse(cible)}
            disabled={redactionEnCours === cle}
            className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {redactionEnCours === cle ? "✨ Rédaction..." : "✨ Brouillon IA"}
          </button>
        </div>

        {objet !== null && (
          <input
            value={objet}
            onChange={(e) => setObjets((prev) => ({ ...prev, [cle]: e.target.value }))}
            placeholder="Objet de l'e-mail"
            className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-yellow-400"
          />
        )}

        <textarea
          value={brouillon}
          onChange={(e) => setBrouillons((prev) => ({ ...prev, [cle]: e.target.value }))}
          rows={7}
          placeholder="Écrivez le message, ou partez d'un brouillon IA."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-yellow-400 resize-y"
        />

        {erreurReponse[cle] && (
          <p className="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">
            {erreurReponse[cle]}
          </p>
        )}

        {aCompleter && (
          <p className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2">
            Le brouillon laisse des marqueurs à compléter ou à trancher. Remplacez-les : l&apos;envoi
            reste fermé tant qu&apos;il en reste un.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
          <p className="text-[11px] text-gray-400 truncate">{contexte}</p>
          <button
            onClick={() => handleEnvoyerReponse(cible)}
            disabled={
              !brouillon.trim() ||
              aCompleter ||
              (objet !== null && !objet.trim()) ||
              envoiEnCours === cle
            }
            className="flex-shrink-0 px-4 py-2 bg-yellow-400 text-black rounded-lg text-sm font-bold hover:bg-yellow-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {envoiEnCours === cle ? "⏳ Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    );
  };

  /* Cout de revient. Saisi en euros : le chiffre d'affaires arrive en neuf
     devises, la depense se fait dans une seule. */
  const [coutSaisi, setCoutSaisi] = useState("");
  const [coutNoteSaisie, setCoutNoteSaisie] = useState("");
  const [coutEnregistre, setCoutEnregistre] = useState(false);

  const enregistrerCout = async () => {
    if (!selectedOrder) return;
    const valeur = coutSaisi.trim() === "" ? null : coutSaisi.trim();
    await fetch("/api/orders", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id: selectedOrder.id, cout: valeur, coutNote: coutNoteSaisie }),
    });
    setCoutEnregistre(true);
    setTimeout(() => setCoutEnregistre(false), 2500);
    fetchOrders();
  };

  /* Expedition d'une commande physique.

     Le portrait part chez l'imprimeur, a l'adresse du client. Deux choses
     naissent la : le numero de commande chez l'imprimeur — pour nous seuls,
     c'est ce qui permet de retrouver le dossier quand un colis se perd — et,
     quelques jours plus tard, le lien de suivi.

     Deux boutons parce que ce sont deux moments : on note la reference le jour
     de la commande, on previent le client le jour ou le colis part. */
  const [refFournisseur, setRefFournisseur] = useState("");
  const [suiviUrl, setSuiviUrl] = useState("");
  const [transporteur, setTransporteur] = useState("");
  const [expeditionEnregistree, setExpeditionEnregistree] = useState(false);
  const [envoiExpedition, setEnvoiExpedition] = useState(false);
  const [erreurExpedition, setErreurExpedition] = useState<string | null>(null);

  const corpsExpedition = () =>
    JSON.stringify({
      orderId: selectedOrder?.id,
      fournisseurRef: refFournisseur,
      suiviUrl,
      transporteur,
    });

  const enregistrerExpedition = async () => {
    if (!selectedOrder) return;
    setErreurExpedition(null);
    const r = await fetch("/api/orders/expedition", {
      method: "PATCH",
      headers: headers(),
      body: corpsExpedition(),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      setErreurExpedition(data?.error || "Enregistrement impossible.");
      return;
    }
    setExpeditionEnregistree(true);
    setTimeout(() => setExpeditionEnregistree(false), 2500);
    fetchOrders();
  };

  const envoyerAvisExpedition = async () => {
    if (!selectedOrder) return;
    setEnvoiExpedition(true);
    setErreurExpedition(null);
    try {
      const r = await fetch("/api/orders/expedition", {
        method: "POST",
        headers: headers(),
        body: corpsExpedition(),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setErreurExpedition(data?.error || "Envoi impossible.");
        return;
      }
      /* Etat local mis a jour tout de suite : le rechargement suit, mais la
         fiche doit dire « envoye » avant qu'il n'arrive, sinon on reclique. */
      const maintenant = new Date().toISOString();
      const updated = {
        ...selectedOrder,
        fournisseur_ref: refFournisseur.trim() || null,
        suivi_url: suiviUrl.trim() || null,
        suivi_transporteur: transporteur.trim() || null,
        expedie_le: selectedOrder.expedie_le || maintenant,
        expedition_email_envoye_le: maintenant,
        status: "shipped",
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      fetchOrders();
    } catch (e) {
      setErreurExpedition(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setEnvoiExpedition(false);
    }
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

  /* Recharge les champs quand on change de commande, sinon la saisie de la
     precedente reste affichee sur la suivante — et on l'enregistrerait sur la
     mauvaise. */
  useEffect(() => {
    setCoutSaisi(selectedOrder?.cout != null ? String(selectedOrder.cout) : "");
    setCoutNoteSaisie(selectedOrder?.cout_note ?? "");
  }, [selectedOrder?.id, selectedOrder?.cout, selectedOrder?.cout_note]);

  /* Meme raison pour l'expedition : un lien de suivi laisse a l'ecran, c'est
     un colis annonce au mauvais client. */
  useEffect(() => {
    setRefFournisseur(selectedOrder?.fournisseur_ref ?? "");
    setSuiviUrl(selectedOrder?.suivi_url ?? "");
    setTransporteur(selectedOrder?.suivi_transporteur ?? "");
    setErreurExpedition(null);
  }, [
    selectedOrder?.id,
    selectedOrder?.fournisseur_ref,
    selectedOrder?.suivi_url,
    selectedOrder?.suivi_transporteur,
  ]);

  useEffect(() => {
    if (authed) {
      fetchOrders();
      fetchPrices();
      fetchSupportMessages();
      fetchSupportOutbox();
    }
  }, [authed, fetchOrders, fetchPrices, fetchSupportMessages, fetchSupportOutbox]);

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
      const extensionsParType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
      };
      const extension = extensionsParType[file.type] ?? "jpg";
      const nomPublic = `final/cartoonova-${crypto.randomUUID()}.${extension}`;
      const blob = await upload(nomPublic, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      // Save to DB
      /* Le depot pose aussi le rendez-vous d'envoi : c'est la reponse qui dit
         pour quand, et si elle l'a pose — un tirage physique pas encore valide
         par le client, lui, n'est pas programme tout seul. */
      const r = await fetch("/api/orders/send-final-image", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerEmail: selectedOrder.customer_email,
          finalImageUrl: blob.url,
          saveOnly: true,
        }),
      });
      const data = await r.json().catch(() => ({}));

      // Update local state with new URL
      const updated = {
        ...selectedOrder,
        final_image_url: blob.url,
        final_image_scheduled_at:
          data.scheduledAt ?? selectedOrder.final_image_scheduled_at ?? null,
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(`Erreur upload: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setUploadingImage(false);
  };

  /* ─── Envoi differe de l'illustration ──────────────────────────────

     Livrer un portrait deux heures apres la commande ne se lit pas comme un
     service rapide : l'e-mail annonce que « nos artistes viennent de terminer
     votre portrait », et personne ne croit qu'une equipe d'artistes a travaille
     pendant que le client refermait son onglet. Le depot programme donc l'envoi
     a un ou deux jours ; ces deux boutons servent a le deplacer ou a le retirer.

     L'image, elle, reste modifiable jusqu'au bout : le cron relit l'URL au
     moment d'envoyer, donc « Remplacer » suffit a corriger un detail sans rien
     reprogrammer. */
  const majProgrammation = (scheduledAt: string | null) => {
    if (!selectedOrder) return;
    const updated = { ...selectedOrder, final_image_scheduled_at: scheduledAt };
    setSelectedOrder(updated);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  /* `quand` absent = laisser le serveur choisir (1 a 2 jours). Sinon la valeur
     brute du champ date, convertie ici : « 2026-09-13T09:00 » sans fuseau serait
     relu comme une heure UTC par le serveur, alors que l'admin l'a saisie a
     Paris — deux heures d'ecart en ete, et personne pour s'en apercevoir. */
  const handleProgrammerEnvoi = async (quand?: string) => {
    if (!selectedOrder || programmationEnCours) return;
    let scheduledAt: string | undefined;
    if (quand) {
      const d = new Date(quand);
      if (Number.isNaN(d.getTime())) {
        alert("Date invalide.");
        return;
      }
      scheduledAt = d.toISOString();
    }

    setProgrammationEnCours(true);
    try {
      const r = await fetch("/api/orders/send-final-image", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ orderId: selectedOrder.id, action: "schedule", scheduledAt }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) majProgrammation(data.scheduledAt ?? null);
      else alert(`Erreur: ${data?.error || "Erreur inconnue"}`);
    } catch (err) {
      alert(`Erreur réseau: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setProgrammationEnCours(false);
  };

  const handleAnnulerProgrammation = async () => {
    if (!selectedOrder || programmationEnCours) return;
    setProgrammationEnCours(true);
    try {
      const r = await fetch("/api/orders/send-final-image", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ orderId: selectedOrder.id, action: "cancel" }),
      });
      if (r.ok) majProgrammation(null);
      else {
        const data = await r.json().catch(() => null);
        alert(`Erreur: ${data?.error || "Erreur inconnue"}`);
      }
    } catch (err) {
      alert(`Erreur réseau: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    }
    setProgrammationEnCours(false);
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
        /* Le rendez-vous tombe avec l'envoi : le serveur l'a efface, sans quoi
           le cron renverrait le meme portrait a son passage suivant. */
        const updated = {
          ...selectedOrder,
          final_image_sent_at: new Date().toISOString(),
          final_image_scheduled_at: null,
        };
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
                          <td className="px-4 py-3">{(() => { const opts = typeof o.options === 'string' ? JSON.parse(o.options) : o.options; const s = libelleStyle(opts?.style); return s ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-lg text-xs font-bold">{s.emoji} {s.label}</span> : <span className="text-gray-400">—</span>; })()}</td>
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

                    {/* La conversation avec le client, dans les deux sens,
                        et de quoi écrire la suite.

                        Le lien `mailto:` qui fermait ce bloc ouvrait le
                        logiciel de messagerie de la machine : le message
                        partait d'une autre adresse, ne se rattachait à rien et
                        n'apparaissait dans aucun fil. C'est par ce chemin
                        qu'un échange de mai n'est arrivé dans la boîte support
                        que par un transfert, dont une moitié n'a jamais été
                        marquée lue.

                        Le bloc s'affiche même quand le client n'a jamais
                        écrit. C'était le dernier trou : une question posée
                        dans la case « instructions » à la commande n'arrive
                        par aucun e-mail, donc n'avait rien à quoi répondre —
                        et restait sans réponse pour cette seule raison. */}
                    {(() => {
                      const fil = supportMessages
                        .filter((m) => m.order_id === selectedOrder.id && m.category !== "spam")
                        .sort((a, b) => +new Date(a.received_at) - +new Date(b.received_at));
                      const envoyes = sortants.filter((r) => r.order_id === selectedOrder.id);
                      /* Reçus et envoyés dans un seul ordre, celui du temps :
                         c'est ainsi que la conversation s'est déroulée, et la
                         seule façon de voir qu'une relance a suivi une réponse
                         plutôt que de l'avoir précédée. */
                      const echanges: { le: string; recu?: SupportMessage; envoye?: SupportReply }[] = [
                        ...fil.map((m) => ({ le: m.received_at, recu: m })),
                        ...envoyes.map((r) => ({ le: r.sent_at, envoye: r })),
                      ].sort((a, b) => +new Date(a.le) - +new Date(b.le));
                      const nonLus = fil.filter((m) => !m.read_at).length;
                      /* On répond au dernier message reçu quand il y en a un :
                         c'est celui auquel le client attend une réponse, et
                         celui dont l'identifiant rattachera son prochain
                         courrier au bon fil. Sinon c'est nous qui ouvrons. */
                      const dernier = fil.length ? fil[fil.length - 1] : null;
                      const cible: CibleCourrier = dernier
                        ? { type: "message", message: dernier }
                        : { type: "commande", commande: selectedOrder };
                      return (
                        <div className={`rounded-lg p-3 border ${nonLus ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className={`text-xs font-semibold ${nonLus ? "text-amber-700" : "text-gray-500"}`}>
                              {echanges.length > 0
                                ? `💬 Conversation client (${echanges.length})`
                                : "✉️ Écrire au client"}
                              {nonLus > 0 && ` — ${nonLus} non lu${nonLus > 1 ? "s" : ""}`}
                            </p>
                            {nonLus > 0 && (
                              <button
                                onClick={() => fil.filter((m) => !m.read_at).forEach((m) => handleMarkSupportRead(m.id))}
                                className="text-[10px] font-bold text-amber-700 underline cursor-pointer shrink-0"
                              >
                                Tout marquer lu
                              </button>
                            )}
                          </div>

                          {echanges.length > 0 && (
                            <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
                              {echanges.map((e) =>
                                e.recu ? (
                                  <div
                                    key={`recu-${e.recu.id}`}
                                    className={`rounded-lg p-2 border ${e.recu.read_at ? "bg-white border-gray-200" : "bg-white border-amber-300"}`}
                                  >
                                    <div className="flex items-baseline justify-between gap-2 mb-1">
                                      <span className="text-[10px] font-bold text-gray-700 truncate">{e.recu.from_email}</span>
                                      <span className="text-[10px] text-gray-400 shrink-0">
                                        {new Date(e.recu.received_at).toLocaleString("fr-FR")}
                                      </span>
                                    </div>
                                    {e.recu.subject && (
                                      <p className="text-[11px] font-semibold text-gray-800 mb-1">{e.recu.subject}</p>
                                    )}
                                    {e.recu.body_text && (
                                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {e.recu.body_text.length > 700 ? e.recu.body_text.slice(0, 700) + "…" : e.recu.body_text}
                                      </p>
                                    )}
                                    <TraductionFr texte={e.recu.body_text} motDePasse={password} compact />
                                  </div>
                                ) : (
                                  courrierEnvoye(e.envoye!)
                                )
                              )}
                            </div>
                          )}

                          {zoneRedaction(cible, null)}
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

                    {(() => { const opts = typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options; const s = libelleStyle(opts?.style); return s ? (
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
                        {/* Le support, en français et avec sa taille.
                            La fiche affichait `printOption`, c'est-à-dire le
                            libellé DANS LA LANGUE DU CLIENT : une commande
                            polonaise annonçait « Portret na płótnie ». Et la
                            taille n'apparaissait nulle part, alors que c'est la
                            première chose à saisir chez l'imprimeur — elle ne
                            se choisit pas, elle se déduit du support. */}
                        {(() => {
                          const opts = typeof selectedOrder.options === 'string' ? JSON.parse(selectedOrder.options) : selectedOrder.options;
                          const support = decrireSupport(opts);
                          return (
                            <div className="col-span-2">
                              <span className="text-gray-500">Support:</span>{" "}
                              <span className="font-bold text-gray-900">
                                {support.libelle}
                                {support.taille && ` — ${support.taille}`}
                              </span>
                              {support.detail && (
                                <span className="text-gray-400"> ({support.detail})</span>
                              )}
                              {/* Ce que le client a lu, gardé sous les yeux :
                                  c'est le mot qu'il emploiera s'il écrit. */}
                              {opts?.printOption && opts.printOption !== support.libelle && (
                                <span className="text-gray-400"> · vu comme « {opts.printOption} »</span>
                              )}
                            </div>
                          );
                        })()}
                        <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-600">{selectedOrder.total_price} {selectedOrder.currency}</span></div>
                      </div>

                      {/* Cout de revient et marge. Sans lui, une toile a 73 $
                          et un fichier a 5 € se ressemblent dans la liste,
                          alors que l'une paie un imprimeur et un transporteur. */}
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <p className="text-xs text-gray-500 font-semibold">💶 Coût de revient (en euros)</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={coutSaisi}
                            onChange={(e) => setCoutSaisi(e.target.value)}
                            placeholder="0,00"
                            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="text"
                            value={coutNoteSaisie}
                            onChange={(e) => setCoutNoteSaisie(e.target.value)}
                            placeholder="impression, port…"
                            className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            onClick={enregistrerCout}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-800 text-white hover:bg-black transition-colors cursor-pointer"
                          >
                            {coutEnregistre ? "✓" : "Enregistrer"}
                          </button>
                        </div>
                        {(() => {
                          if (selectedOrder.cout == null) return null;
                          const ca = toEUR(Number(selectedOrder.total_price), selectedOrder.currency);
                          const marge = ca - Number(selectedOrder.cout);
                          const part = ca > 0 ? (marge / ca) * 100 : 0;
                          return (
                            <p className="text-sm">
                              <span className="text-gray-500">Marge :</span>{" "}
                              <span className={`font-bold ${marge >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {marge.toFixed(2)} € ({part.toFixed(0)} %)
                              </span>
                              <span className="text-xs text-gray-400">
                                {" "}— {ca.toFixed(2)} € encaissés − {Number(selectedOrder.cout).toFixed(2)} €
                              </span>
                            </p>
                          );
                        })()}
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
                          <TraductionFr texte={consigne.texte} motDePasse={password} />
                          {/* Le `mailto:` qui se trouvait ici partait du
                              logiciel de messagerie de la machine, sans rien
                              rattacher ni enregistrer. La réponse s'écrit
                              maintenant dans « Écrire au client », plus haut,
                              et le brouillon IA y lit déjà cette consigne. */}
                          {consigne.question && (
                            <p className="mt-2 text-xs text-amber-800">
                              Répondez-lui depuis « Écrire au client », plus haut.
                            </p>
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
                              {sendingImage
                                ? "Envoi en cours..."
                                : selectedOrder.final_image_sent_at
                                ? "Renvoyer par email"
                                : selectedOrder.final_image_scheduled_at
                                ? "Envoyer maintenant"
                                : "Envoyer au client"}
                            </button>
                          </div>

                          {/* Envoi differe.
                              Un portrait livre dans l'heure se lit comme un
                              portrait genere dans l'heure — l'e-mail annonce
                              pourtant que « nos artistes viennent de terminer
                              votre portrait ». D'ou le rendez-vous, pose au
                              depot de l'image et modifiable jusqu'au bout. */}
                          {!selectedOrder.final_image_sent_at && (
                            <div className="rounded-lg border border-emerald-300 bg-white px-2.5 py-2 space-y-1.5">
                              {selectedOrder.final_image_scheduled_at ? (
                                <>
                                  <p className="text-[11px] font-bold text-emerald-800">
                                    ⏳ Envoi programmé le{" "}
                                    {new Date(selectedOrder.final_image_scheduled_at).toLocaleString("fr-FR", {
                                      dateStyle: "full",
                                      timeStyle: "short",
                                    })}
                                  </p>
                                  <p className="text-[10px] text-gray-500 leading-snug">
                                    Vous pouvez encore remplacer l&apos;image : c&apos;est la
                                    dernière déposée qui partira.
                                  </p>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      ref={dateEnvoiRef}
                                      key={`${selectedOrder.id}-${selectedOrder.final_image_scheduled_at}`}
                                      type="datetime-local"
                                      defaultValue={pourChampDate(selectedOrder.final_image_scheduled_at)}
                                      className="flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded-md border border-gray-300"
                                    />
                                    <button
                                      onClick={() => handleProgrammerEnvoi(dateEnvoiRef.current?.value)}
                                      disabled={programmationEnCours}
                                      className="px-2 py-1 text-[11px] font-bold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                                    >
                                      Décaler
                                    </button>
                                    <button
                                      onClick={handleAnnulerProgrammation}
                                      disabled={programmationEnCours}
                                      className="px-2 py-1 text-[11px] font-bold rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* Dire POURQUOI rien n'est programme. Le
                                      depot programme tout seul, sauf sur un
                                      tirage que le client n'a pas valide — et
                                      un « aucun envoi programmé » sans raison
                                      se lit comme une panne. */}
                                  {(() => {
                                    const opts = typeof selectedOrder.options === "string"
                                      ? JSON.parse(selectedOrder.options)
                                      : selectedOrder.options;
                                    const attendValidation =
                                      estPhysique(opts) &&
                                      selectedOrder.poster_confirmation_status !== "confirmed";
                                    return (
                                      <p className="text-[11px] font-semibold text-gray-600 leading-snug">
                                        {attendValidation
                                          ? "Aucun envoi programmé : tirage physique en attente de validation du client."
                                          : "Aucun envoi programmé."}
                                      </p>
                                    );
                                  })()}
                                  <button
                                    onClick={() => handleProgrammerEnvoi()}
                                    disabled={programmationEnCours}
                                    className="w-full px-3 py-1.5 text-[11px] font-bold rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                                  >
                                    {programmationEnCours ? "..." : "📅 Programmer dans 1 à 2 jours"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}

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
                                {/* TOUTES les demandes, pas seulement la
                                    derniere. Une retouche est une conversation :
                                    « We are almost there. One other edit. »
                                    suppose une demande precedente, que
                                    l'ecrasement de la colonne faisait
                                    disparaitre. */}
                                {(() => {
                                  const histo = (selectedOrder as { retouches?: {
                                    id: number; note: string | null; photos: string[]; demandeeLe: string;
                                  }[] }).retouches ?? [];

                                  /* Repli sur la colonne pour les demandes
                                     anterieures a l'historique. */
                                  const liste = histo.length
                                    ? histo
                                    : selectedOrder.poster_confirmation_note
                                    ? [{
                                        id: 0,
                                        note: selectedOrder.poster_confirmation_note,
                                        photos: (typeof selectedOrder.poster_confirmation_photos === "string"
                                          ? JSON.parse(selectedOrder.poster_confirmation_photos)
                                          : selectedOrder.poster_confirmation_photos) ?? [],
                                        demandeeLe: selectedOrder.poster_confirmation_responded_at ?? "",
                                      }]
                                    : [];
                                  if (!liste.length) return null;

                                  return (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-amber-700 uppercase">
                                        {liste.length} demande{liste.length > 1 ? "s" : ""} de retouche
                                      </p>
                                      {liste.map((r, i) => (
                                        <div
                                          key={r.id || i}
                                          className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-2"
                                        >
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[10px] font-bold text-amber-700">
                                              n°{liste.length - i}
                                              {i === 0 && liste.length > 1 ? " · la plus récente" : ""}
                                            </span>
                                            {r.demandeeLe && (
                                              <span className="text-[10px] text-gray-500">
                                                {new Date(r.demandeeLe).toLocaleString("fr-FR")}
                                              </span>
                                            )}
                                          </div>
                                          {r.note && (
                                            <p className="text-xs text-amber-900 whitespace-pre-wrap">{r.note}</p>
                                          )}
                                          <TraductionFr texte={r.note} motDePasse={password} compact />
                                          {Array.isArray(r.photos) && r.photos.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                              {r.photos.map((url: string, k: number) => (
                                                <a
                                                  key={k}
                                                  href={url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block aspect-square rounded-lg overflow-hidden border border-amber-300 hover:ring-2 hover:ring-amber-400 transition-all"
                                                >
                                                  <img src={url} alt={`Retouche ${k + 1}`} className="w-full h-full object-cover" />
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
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


                    {/* Expédition — commandes physiques uniquement.
                        Un fichier numérique n'a pas de colis, et proposer un
                        lien de suivi dessus, c'est le même piège que les deux
                        boutons d'envoi avant `estPhysique`. */}
                    {estPhysique(typeof selectedOrder.options === "string" ? JSON.parse(selectedOrder.options) : selectedOrder.options) && (
                      <div className="rounded-lg p-3 border border-indigo-200 bg-indigo-50 space-y-3">
                        <p className="text-xs text-indigo-700 font-semibold">📦 Expédition</p>

                        {/* Ce qu'il faut commander, répété ici. C'est à ce
                            moment précis qu'on ouvre Optimal Print, et remonter
                            chercher le support trois blocs plus haut est
                            exactement ce qui fait commander un poster à la
                            place d'une toile. */}
                        {(() => {
                          const support = decrireSupport(typeof selectedOrder.options === "string" ? JSON.parse(selectedOrder.options) : selectedOrder.options);
                          return (
                            <p className="text-sm bg-white border border-indigo-200 rounded-lg px-2 py-1.5">
                              <span className="text-gray-500 text-xs">À commander :</span>{" "}
                              <span className="font-bold text-gray-900">
                                {support.libelle}
                                {support.taille && ` ${support.taille}`}
                              </span>
                              {support.detail && (
                                <span className="text-gray-500 text-xs"> — {support.detail}</span>
                              )}
                            </p>
                          );
                        })()}

                        {/* Référence imprimeur — interne, jamais envoyée au client. */}
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                            N° de commande Optimal Print (interne)
                          </label>
                          <input
                            type="text"
                            value={refFournisseur}
                            onChange={(e) => setRefFournisseur(e.target.value)}
                            placeholder="ex. OP-123456789"
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                              Lien de suivi du colis
                            </label>
                            <input
                              type="url"
                              value={suiviUrl}
                              onChange={(e) => setSuiviUrl(e.target.value)}
                              placeholder="https://…"
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                              Transporteur
                            </label>
                            <input
                              type="text"
                              value={transporteur}
                              onChange={(e) => setTransporteur(e.target.value)}
                              placeholder="Colissimo…"
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={enregistrerExpedition}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                          >
                            {expeditionEnregistree ? "✓ Enregistré" : "Enregistrer"}
                          </button>
                          <button
                            onClick={envoyerAvisExpedition}
                            disabled={envoiExpedition || !suiviUrl.trim() || !selectedOrder.customer_email}
                            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {envoiExpedition
                              ? "Envoi en cours..."
                              : selectedOrder.expedition_email_envoye_le
                              ? "📨 Renvoyer l'e-mail de suivi"
                              : "📨 Prévenir le client de l'expédition"}
                          </button>
                        </div>

                        {erreurExpedition && (
                          <p className="text-[11px] font-bold text-red-600">{erreurExpedition}</p>
                        )}
                        {selectedOrder.expedition_email_envoye_le && (
                          <p className="text-[10px] text-gray-500">
                            Client prévenu le{" "}
                            {new Date(selectedOrder.expedition_email_envoye_le).toLocaleString("fr-FR")}
                            {selectedOrder.expedie_le &&
                              ` — expédiée le ${new Date(selectedOrder.expedie_le).toLocaleDateString("fr-FR")}`}
                          </p>
                        )}
                        {selectedOrder.suivi_url && (
                          <a
                            href={selectedOrder.suivi_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-[11px] font-semibold text-indigo-700 underline break-all"
                          >
                            Ouvrir le suivi →
                          </a>
                        )}
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
                      const reponses = m.replies ?? [];
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
                                {reponses.length > 0 && (
                                  <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                                    ↩ Répondu{reponses.length > 1 ? ` ×${reponses.length}` : ""}
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
                            <div className="px-4 pb-4 space-y-3">
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                {m.body_text || "(pas de contenu texte)"}
                              </div>
                              <TraductionFr texte={m.body_text} motDePasse={password} />

                              {/* Ce qui est déjà parti. Le relire avant
                                  d'écrire évite la faute qui use un client qui
                                  relance : lui resservir la réponse à laquelle
                                  il est justement en train de répondre. */}
                              {reponsesEnvoyees(m)}

                              {zoneRedaction(
                                { type: "message", message: m },
                                linkedOrder
                                  ? `Commande ${linkedOrder.id.slice(0, 8)} jointe au contexte`
                                  : "Aucune commande rattachée à ce message"
                              )}
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
            /* Les commandes anterieures au champ `style` n'en portent pas ;
               elles ont leur propre barre plutot que de fausser les autres. */
            const style = opts?.style || "sans-style";
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
                      const s = libelleStyle(style);
                      return (
                        <div key={style} className="flex items-center gap-3">
                          <span className="text-sm font-semibold w-32 truncate">{style === "sans-style" ? "— Sans style" : `${s?.emoji} ${s?.label}`}</span>
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
