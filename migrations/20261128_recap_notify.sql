-- 28/11/2026 : récap épinglé en direct. Dès qu'une commande change d'étape, qu'un client écrit,
-- qu'une réponse part ou qu'une retouche est demandée, la base envoie un signal (pg_notify) sur
-- le canal « recap_cartoonova ». L'écouteur du serveur (recap-ecoute) réveille alors l'agent du récap.
-- Le signal ne contient que la table et des identifiants : aucune donnée client.
-- Sans écouteur, le signal est simplement perdu : aucun effet sur le site.
-- Gardé par des tests d'existence : sur une base neuve, les tables peuvent arriver après ce fichier.
CREATE OR REPLACE FUNCTION recap_cartoonova_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE commande text; ligne text;
BEGIN
  -- Champs lus séparément : NEW.order_id n'existe pas sur orders.
  IF TG_TABLE_NAME = 'orders' THEN
    commande := NEW.id::text;
  ELSE
    commande := NEW.order_id::text;
    ligne := NEW.id::text;
  END IF;
  PERFORM pg_notify('recap_cartoonova', json_build_object('t', TG_TABLE_NAME, 'o', commande, 'id', ligne)::text);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- un signal raté ne doit jamais bloquer une écriture du site
END $$;

DO $$
DECLARE colonnes text;
BEGIN
  IF to_regclass('orders') IS NOT NULL THEN
    SELECT string_agg(quote_ident(column_name), ', ') INTO colonnes FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name IN (
       'status', 'statut_force', 'paid_at', 'photo_urls', 'poster_confirmation_sent_at', 'poster_confirmation_status',
       'final_image_url', 'final_image_sent_at', 'final_image_scheduled_at', 'fournisseur_ref', 'suivi_url',
       'expedie_le', 'expedition_email_envoye_le');
    EXECUTE 'DROP TRIGGER IF EXISTS recap_cartoonova_orders ON orders';
    IF colonnes IS NOT NULL THEN
      EXECUTE 'CREATE TRIGGER recap_cartoonova_orders AFTER INSERT OR UPDATE OF ' || colonnes ||
              ' ON orders FOR EACH ROW WHEN (NEW.paid_at IS NOT NULL) EXECUTE FUNCTION recap_cartoonova_notify()';
    END IF;
  END IF;
  IF to_regclass('support_messages') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS recap_cartoonova_messages ON support_messages';
    EXECUTE 'CREATE TRIGGER recap_cartoonova_messages AFTER INSERT ON support_messages FOR EACH ROW EXECUTE FUNCTION recap_cartoonova_notify()';
  END IF;
  IF to_regclass('support_replies') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS recap_cartoonova_reponses ON support_replies';
    EXECUTE 'CREATE TRIGGER recap_cartoonova_reponses AFTER INSERT ON support_replies FOR EACH ROW EXECUTE FUNCTION recap_cartoonova_notify()';
  END IF;
  IF to_regclass('retouches') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS recap_cartoonova_retouches ON retouches';
    EXECUTE 'CREATE TRIGGER recap_cartoonova_retouches AFTER INSERT ON retouches FOR EACH ROW EXECUTE FUNCTION recap_cartoonova_notify()';
  END IF;
END $$;
