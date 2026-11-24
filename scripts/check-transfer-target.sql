SET LOCAL search_path = pg_catalog, public;
SET LOCAL row_security = off;

SELECT (
  (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) || ':' ||
  (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database())
) = :'expected_identity' AS matching_identity \gset
\if :matching_identity
\else
  DO $$ BEGIN RAISE EXCEPTION 'A identidade do destino mudou após a verificação.'; END $$;
\endif

SELECT coalesce(jsonb_object_agg(migration_name, checksum), '{}'::jsonb) = :'expected_migrations'::jsonb
       AND count(*) = count(DISTINCT migration_name)
       AND NOT EXISTS (SELECT FROM public._prisma_migrations
         WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS matching_migrations
FROM public._prisma_migrations
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL \gset
\if :matching_migrations
\else
  DO $$ BEGIN RAISE EXCEPTION 'Histórico de migrations incompatível com o destino.'; END $$;
\endif

\if :core_target
  LOCK TABLE public.users, public.monitors, public.check_executions IN SHARE ROW EXCLUSIVE MODE;
  SELECT id,name,email,password_hash,role,"createdAt","updatedAt","passwordResetDigest","passwordResetExpires"
    FROM public.users WHERE false \g /dev/null
  SELECT id,"userId",name,url,interval_minutes,status,"createdAt","updatedAt"
    FROM public.monitors WHERE false \g /dev/null
  SELECT id,"monitorId",status_code,response_time_ms,timestamp
    FROM public.check_executions WHERE false \g /dev/null
  SELECT
    has_table_privilege('public.users','INSERT') AND
    has_table_privilege('public.monitors','INSERT') AND
    has_table_privilege('public.check_executions','INSERT') AS can_insert,
    NOT EXISTS (SELECT FROM public.users UNION ALL SELECT FROM public.monitors
      UNION ALL SELECT FROM public.check_executions) AS empty_destination \gset
\else
  LOCK TABLE public.incidents, public.alerts IN SHARE ROW EXCLUSIVE MODE;
  SELECT id,"monitorId",status,"errorLog","startedAt","resolvedAt"
    FROM public.incidents WHERE false \g /dev/null
  SELECT id,"monitorId","incidentId",type,message,"sentAt"
    FROM public.alerts WHERE false \g /dev/null
  SELECT
    has_database_privilege(current_database(),'TEMP') AND
    has_table_privilege('public.incidents','INSERT') AND
    has_table_privilege('public.alerts','INSERT') AS can_insert,
    NOT EXISTS (SELECT FROM public.incidents UNION ALL SELECT FROM public.alerts) AS empty_destination \gset
\endif
\if :can_insert
\else
  DO $$ BEGIN RAISE EXCEPTION 'Permissões insuficientes no destino.'; END $$;
\endif
\if :empty_destination
\else
  DO $$ BEGIN RAISE EXCEPTION 'O destino deve estar vazio.'; END $$;
\endif
