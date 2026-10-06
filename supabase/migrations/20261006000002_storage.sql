-- Stackr — Anhänge in Supabase Storage (Phase 1, ersetzt Vercel Blob in api/blob-upload.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen, nach 20261006000001_sync.sql.
--
-- Bucket privat: kein öffentlicher Abruf, der Browser bekommt nur kurzlebige
-- signierte URLs über api/blob-upload.js (action=sign). Auf storage.objects gibt es
-- bewusst KEINE Policy — anon/authenticated sehen nichts, nur der Service-Key.
-- Inhalt ist ausschließlich Chiffrat (E1 Option A).
--
-- 200 MB je Objekt = MAX_TOTAL_BYTES in api/blob-upload.js. Die projektweite
-- Upload-Grenze (Dashboard → Storage → Settings) muss mindestens so hoch stehen,
-- sonst gewinnt sie.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 209715200)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Objektnamen unter einem Präfix, optional nur ältere als p_before. Für purge und den
-- Aufräum-Cron; die Storage-REST-API listet nur eine Ordnerebene.
-- left() statt like: in Nutzer-IDs und Scopes steckt '_', bei like ein Platzhalter.
create or replace function sync_storage_list(p_prefix text, p_before timestamptz, p_limit integer)
returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(name), '[]'::jsonb) from (
        select name from storage.objects
         where bucket_id = 'attachments'
           and left(name, length(p_prefix)) = p_prefix
           and (p_before is null or created_at < p_before)
         order by name
         limit p_limit
    ) t
$$;

revoke all on function sync_storage_list(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function sync_storage_list(text, timestamptz, integer) to service_role;
