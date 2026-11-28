-- 28/11/2026 : le portrait de la commande 98f5c550 est parti le 27/11 à 18:15 UTC (Resend 01a21e37…,
-- « delivered ») mais la fonction a échoué avant de confirmer (même panne que Jeanne, avant le correctif
-- de 60 s mis en ligne à 18:23). Le journal d'envoi est resté « sending », la date d'envoi vide et
-- l'envoi programmé du 28/11 a été bloqué (pour ne pas envoyer deux fois). On note l'envoi réel.
-- Rejouable : ne change rien la 2e fois. Gardé par des tests de colonnes pour une base neuve.
DO $$
BEGIN
  IF to_regclass('order_delivery_effects') IS NOT NULL THEN
    UPDATE order_delivery_effects
       SET status = 'sent', email_id = '01a21e37-f44b-7dc7-8da8-d59ad70abad8', updated_at = now(),
           artifacts = CASE WHEN artifacts ? 'deliveryHistory' AND artifacts #>> '{deliveryHistory,sentAt}' IS NULL
                            THEN jsonb_set(artifacts, '{deliveryHistory,sentAt}', to_jsonb('2026-11-27T18:15:10+00:00'::text)) ELSE artifacts END
     WHERE order_id = '98f5c550-e463-4a66-945e-13d7095088c7'::uuid AND kind = 'final_image' AND status = 'sending';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'final_image_sent_at') THEN
    EXECUTE $q$ UPDATE orders SET final_image_sent_at = '2026-11-27T18:15:10+00:00'
                 WHERE id = '98f5c550-e463-4a66-945e-13d7095088c7'::uuid AND final_image_sent_at IS NULL $q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'final_image_scheduled_at') THEN
    EXECUTE $q$ UPDATE orders SET final_image_scheduled_at = NULL
                 WHERE id = '98f5c550-e463-4a66-945e-13d7095088c7'::uuid AND final_image_sent_at IS NOT NULL $q$;
  END IF;
END $$;
