"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import type { CustomerHistory, CustomerHistoryEvent } from "@/lib/customerHistoryTypes";

export type CustomerHistoryTarget = { orderId?: string; supportMessageId?: number };
type Props = { target: CustomerHistoryTarget; onClose: () => void };

const badges: Record<CustomerHistoryEvent["status"], { label: string; color: string }> = {
  recorded: { label: "Enregistré", color: "bg-gray-100 text-gray-800" },
  sent: { label: "Envoyé", color: "bg-green-100 text-green-900" },
  scheduled: { label: "Programmé", color: "bg-blue-100 text-blue-900" },
  uncertain: { label: "Incertain", color: "bg-amber-100 text-amber-900" },
  failed: { label: "Échec", color: "bg-red-100 text-red-900" },
};

function dateLabel(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris",
  }).format(new Date(value));
}

// Remount synchronously on identity changes: not even one render may show the previous client.
export default function CustomerHistoryPanel(props: Props) {
  const key = JSON.stringify([props.target.orderId ?? null, props.target.supportMessageId ?? null]);
  return <HistoryDialog key={key} {...props} />;
}

function HistoryDialog({ target, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [request, setRequest] = useState({ cursor: null as string | null, sequence: 0 });
  const { orderId, supportMessageId } = target;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function fetchHistory() {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (orderId) params.set("orderId", orderId);
        else if (supportMessageId !== undefined) params.set("supportMessageId", String(supportMessageId));
        else throw new Error("Missing target");
        if (request.cursor) params.set("cursor", request.cursor);
        const response = await adminFetch(`/api/admin/customer-history?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("History unavailable");
        const result: CustomerHistory = await response.json();
        if (!active) return;
        setData(previous => request.cursor && previous ? {
          ...result,
          events: Array.from(new Map([...previous.events, ...result.events].map(event => [event.id, event])).values()),
          warnings: Array.from(new Set([...previous.warnings, ...result.warnings])),
        } : result);
      } catch {
        if (active && !controller.signal.aborted) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchHistory();
    return () => { active = false; controller.abort(); };
  }, [orderId, supportMessageId, request]);

  function load(cursor: string | null) {
    setError(false);
    setLoading(true);
    if (!cursor) setData(null);
    setRequest(previous => ({ cursor, sequence: previous.sequence + 1 }));
  }

  const events = [...(data?.events ?? [])].sort((a, b) => {
    const time = (at: string | null) => at && !Number.isNaN(Date.parse(at)) ? Date.parse(at) : -Infinity;
    return time(b.at) - time(a.at) || a.id.localeCompare(b.id);
  });

  return (
    <dialog ref={dialog} aria-labelledby={headingId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto w-[calc(100%-1rem)] max-w-3xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50"
      style={{ width: "calc(100% - 1rem)", maxWidth: "48rem", maxHeight: "90dvh", overflowWrap: "anywhere" }}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white p-4">
        <h2 id={headingId} className="text-lg font-bold">Historique client</h2>
        <button type="button" autoFocus onClick={onClose} className="min-h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-semibold">Fermer</button>
      </header>
      <div className="min-w-0 space-y-4 p-4 text-sm">
        <p id={descriptionId} className="text-gray-600">Lecture seule · Dates en heure de Paris. « Envoyé » signifie accepté par le fournisseur, pas reçu ni lu par le client.</p>
        <button type="button" disabled={loading} onClick={() => load(null)} className="min-h-11 rounded-lg border border-gray-300 px-3 disabled:opacity-50">Actualiser</button>
        {loading && <p role="status">Chargement de l’historique…</p>}
        {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">
          <p>Impossible de charger l’historique. Aucune conclusion ne peut être tirée des éléments manquants.</p>
          <button type="button" onClick={() => load(request.cursor)} className="min-h-11 font-semibold underline">Réessayer</button>
        </div>}
        {data && <>
          <section aria-label="Client" className="rounded-lg bg-gray-50 p-3">
            <h3 className="font-semibold">{data.customer.name || "Nom non renseigné"}</h3>
            <p>{data.customer.email}</p>
          </section>
          {data.warnings.length > 0 && <section aria-label="Historique partiel" className="rounded-lg bg-amber-50 p-3 text-amber-900">
            <h3 className="font-semibold">Historique partiel</h3>
            <ul className="list-inside list-disc">{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
          </section>}
          <section aria-label="Commandes du client">
            <h3 className="mb-2 font-semibold">Commandes du client</h3>
            {data.orders.length === 0 ? <p>Aucune commande rattachée.</p> : <ul className="space-y-2">
              {data.orders.map(order => <li key={order.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-medium">{order.label}</p><p className="text-xs text-gray-600">{order.id} · {dateLabel(order.createdAt)}</p>
              </li>)}
            </ul>}
          </section>
          <section aria-label="Chronologie" aria-busy={loading}>
            <h3 className="mb-2 font-semibold">Chronologie · du plus récent au plus ancien</h3>
            {events.length === 0 && <p>Aucun événement enregistré disponible.</p>}
            <ol className="space-y-3">
              {events.map(event => <li key={event.id} className="min-w-0 rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="min-w-0 flex-1 font-semibold">{event.title}</h4>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badges[event.status].color}`}>{badges[event.status].label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{dateLabel(event.at)} · Source : {event.source}</p>
                {event.orderIds.length > 0 && <p className="mt-1 text-xs text-gray-600">Commande(s) : {event.orderIds.join(", ")}</p>}
                {(event.subject || event.body || event.details) && <details className="mt-2">
                  <summary className="cursor-pointer py-2 font-medium">Consulter le contenu</summary>
                  {event.subject && <p className="mb-2 font-semibold">{event.subject}</p>}
                  {event.body && <pre className="max-w-full whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{event.body}</pre>}
                  {event.details && <pre className="mt-2 max-w-full whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{event.details}</pre>}
                </details>}
              </li>)}
            </ol>
          </section>
          {data.nextCursor && <button type="button" disabled={loading} onClick={() => load(data.nextCursor)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-semibold disabled:opacity-50">Charger la suite</button>}
        </>}
      </div>
    </dialog>
  );
}
