-- Barracks uses its own server sessions. No internal object is a browser API.
-- current_schema() keeps the same migration usable in isolated test schemas.
-- The migration role is the backend owner (or has BYPASSRLS); other backend
-- identities must be inventoried and explicitly authorized before rollout.
DO $$
DECLARE
  schema_name TEXT := current_schema();
  object_row RECORD;
  role_name TEXT;
  creator TEXT;
  grantee TEXT;
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Run internal security migration as the backend owner';
  END IF;
  -- Preserve server schema access before removing the implicit PUBLIC grant.
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I',schema_name,current_user);
  FOREACH role_name IN ARRAY ARRAY['PUBLIC','anon','authenticated'] LOOP
    IF role_name='PUBLIC' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      grantee := CASE WHEN role_name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(role_name) END;
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %s',schema_name,grantee);
      FOR object_row IN
        SELECT c.oid,c.relname,c.relkind FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=schema_name AND c.relkind IN ('r','p','v','m','S','f')
          AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
            AND d.objid=c.oid AND d.deptype='e')
      LOOP
        EXECUTE format('REVOKE ALL ON %s %I.%I FROM %s',
          CASE WHEN object_row.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,
          schema_name,object_row.relname,grantee);
        IF role_name='PUBLIC' AND object_row.relkind IN ('r','p') THEN
          EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',schema_name,object_row.relname);
        END IF;
      END LOOP;
      FOR object_row IN
        SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=schema_name AND p.prokind IN ('f','p')
          AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
            AND d.objid=p.oid AND d.deptype='e')
      LOOP
        EXECUTE format('REVOKE ALL ON ROUTINE %I.%I(%s) FROM %s',
          schema_name,object_row.proname,object_row.arguments,grantee);
      END LOOP;
    END IF;
  END LOOP;
  -- Cover each existing internal creator, plus this migration identity.
  -- Function EXECUTE defaults to PUBLIC globally. A per-schema REVOKE alone
  -- cannot subtract that global grant, so revoke both levels explicitly.
  FOR creator IN
    SELECT DISTINCT pg_get_userbyid(owner_id) FROM (
      SELECT c.relowner AS owner_id FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=schema_name AND c.relkind IN ('r','p','v','m','S','f')
        AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
      UNION SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=schema_name AND p.prokind IN ('f','p')
        AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      UNION SELECT oid FROM pg_roles WHERE rolname=current_user
    ) owners
  LOOP
    FOREACH role_name IN ARRAY ARRAY['PUBLIC','anon','authenticated'] LOOP
      IF role_name='PUBLIC' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        grantee := CASE WHEN role_name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(role_name) END;
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON TABLES FROM %s',creator,schema_name,grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %s',creator,schema_name,grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON FUNCTIONS FROM %s',creator,grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %s',creator,schema_name,grantee);
      END IF;
    END LOOP;
  END LOOP;
  -- REVOKE cannot subtract privileges inherited from an unrelated grant role.
  -- Fail closed for an unexpected role graph instead of recording containment.
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name AND (rolsuper OR rolbypassrls))
        OR has_schema_privilege(role_name,schema_name,'CREATE')
        OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname=schema_name AND c.relkind IN ('r','p','v','m','f')
          AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
          AND has_table_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
        OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname=schema_name AND c.relkind='S'
          AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
          AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(role_name,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)
        OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname=schema_name AND p.prokind IN ('f','p')
          AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
          AND has_function_privilege(role_name,p.oid,'EXECUTE')) THEN
        RAISE EXCEPTION 'API role % retains inherited/elevated internal access; review its role graph before rollout',role_name;
      END IF;
    END IF;
  END LOOP;
END $$;
