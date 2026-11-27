-- 27/11/2026 : le portrait de la commande d3b67de6 est parti (Resend 01a21d52…,
-- « delivered », ledger order_delivery_effects = sent) mais la fonction a
-- planté avant de poser final_image_sent_at. On reporte la date du ledger,
-- seulement si elle manque encore. Rejouable : ne change rien la 2e fois.
UPDATE orders o
SET final_image_sent_at = (e.artifacts #>> '{deliveryHistory,sentAt}')::timestamptz,
    final_image_scheduled_at = NULL
FROM order_delivery_effects e
WHERE o.id = 'd3b67de6-8f2e-433d-a256-6c50baf0d25b'::uuid
  AND e.order_id = o.id
  AND e.kind = 'final_image'
  AND e.status = 'sent'
  AND e.email_id = '01a21d52-e4f9-728f-b34e-be0a6c7b626b'
  AND e.artifacts #>> '{deliveryHistory,sentAt}' IS NOT NULL
  AND o.final_image_sent_at IS NULL;
