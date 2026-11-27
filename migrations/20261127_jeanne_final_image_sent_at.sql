-- 27/11/2026 : le portrait de la commande d3b67de6 est parti (Resend 01a21d52…,
-- « delivered », ledger order_delivery_effects = sent) mais la fonction a
-- échoué avant de poser final_image_sent_at. On reporte la date du ledger,
-- seulement si elle manque encore. Rejouable : ne change rien la 2e fois.
-- Gardé par un test de colonne : sur une base neuve, add_final_image.sql
-- passe après ce fichier (ordre alphabétique) et la commande n'existe pas.
-- final_image_scheduled_at n'est pas touché : il est créé au démarrage du
-- site, pas par une migration (il était déjà vide pour cette commande).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'orders'
               AND column_name = 'final_image_sent_at')
     AND to_regclass('order_delivery_effects') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE orders o
      SET final_image_sent_at = (e.artifacts #>> '{deliveryHistory,sentAt}')::timestamptz
      FROM order_delivery_effects e
      WHERE o.id = 'd3b67de6-8f2e-433d-a256-6c50baf0d25b'::uuid
        AND e.order_id = o.id
        AND e.kind = 'final_image'
        AND e.status = 'sent'
        AND e.email_id = '01a21d52-e4f9-728f-b34e-be0a6c7b626b'
        AND e.artifacts #>> '{deliveryHistory,sentAt}' IS NOT NULL
        AND o.final_image_sent_at IS NULL
    $q$;
  END IF;
END $$;
