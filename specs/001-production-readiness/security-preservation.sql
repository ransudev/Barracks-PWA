-- Read operational data only to return aggregate fingerprints; no source rows.
-- Run before and after in an approved quiet window; schema_migrations advances.
CREATE TEMP TABLE readiness_preservation(table_name text,row_count bigint,fingerprint text);
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'schema_migrations'
  LOOP
    EXECUTE format($query$
      INSERT INTO readiness_preservation SELECT %L,count(*),
      md5(COALESCE(string_agg(row_hash,'' ORDER BY row_hash),''))
      FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public.%I t) rows
    $query$,t.relname,t.relname);
  END LOOP;
END $$;
SELECT * FROM readiness_preservation ORDER BY table_name;
DROP TABLE readiness_preservation;
