-- Apply explicitly before deploying consumers. Atomic, repeatable, no backfill.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS photos_received_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS photos_updated_at timestamptz;

-- Comparison only: never rewrites photo_urls or replaces API origin/ownership checks.
-- SQL NULL/JSON null mean empty. Invalid data stays unknown, not empty.
-- Bound historical decoding to two string layers; preserve order, remove duplicates.
CREATE OR REPLACE FUNCTION public.order_photo_timestamp_list(raw jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  value jsonb := raw;
  item jsonb;
  url text;
  result jsonb := '[]'::jsonb;
BEGIN
  FOR i IN 1..2 LOOP
    EXIT WHEN jsonb_typeof(value) IS DISTINCT FROM 'string';
    BEGIN
      value := (value #>> '{}')::jsonb;
    EXCEPTION WHEN data_exception THEN RETURN NULL;
    END;
  END LOOP;
  IF value IS NULL OR value = 'null'::jsonb THEN RETURN result; END IF;
  IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  FOR item IN SELECT jsonb_array_elements(value) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RETURN NULL; END IF;
    url := btrim(item #>> '{}');
    -- Structural storage URL check only; the configured store and ownership
    -- continue to be validated by the existing application, not this audit clock.
    IF length(url) > 2048 OR url !~* '^https://[a-zA-Z0-9-]+[.]public[.]blob[.]vercel-storage[.]com/(orders|retouches)/[^?#[:cntrl:]]+[.](jpg|jpeg|png|webp|heic|heif)$'
      THEN RETURN NULL; END IF;
    IF NOT result @> jsonb_build_array(url) THEN result := result || jsonb_build_array(url); END IF;
    IF jsonb_array_length(result) > 8 THEN RETURN NULL; END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_order_photo_timestamps()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  observed_at timestamptz := clock_timestamp();
  new_list jsonb := public.order_photo_timestamp_list(NEW.photo_urls);
  old_list jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.photos_received_at := CASE WHEN jsonb_array_length(new_list) > 0 THEN observed_at ELSE NULL END;
    NEW.photos_updated_at := NEW.photos_received_at;
  ELSE
    old_list := public.order_photo_timestamp_list(OLD.photo_urls);
    -- Ignore all client-supplied dates, including updates not naming photo_urls.
    NEW.photos_received_at := OLD.photos_received_at;
    NEW.photos_updated_at := OLD.photos_updated_at;
    IF new_list IS DISTINCT FROM old_list
      OR (new_list IS NULL AND old_list IS NULL AND NEW.photo_urls IS DISTINCT FROM OLD.photo_urls) THEN
      NEW.photos_updated_at := observed_at;
      -- Unknown nonempty/invalid historical deposits must never gain a fake
      -- first date, even after removal and redeposit. A prior observed change
      -- with unknown first date therefore also prevents inventing that first.
      IF OLD.photos_received_at IS NULL AND OLD.photos_updated_at IS NULL
        AND old_list = '[]'::jsonb AND jsonb_array_length(new_list) > 0 THEN
        NEW.photos_received_at := observed_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_photo_timestamps ON public.orders;
CREATE TRIGGER orders_photo_timestamps BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.track_order_photo_timestamps();
COMMENT ON COLUMN public.orders.photos_received_at IS 'Server-observed first nonempty photo deposit; immutable; NULL means unknown, never backfilled.';
COMMENT ON COLUMN public.orders.photos_updated_at IS 'Server-observed last real photo list change, including removal; NULL means no observed change.';
COMMIT;
