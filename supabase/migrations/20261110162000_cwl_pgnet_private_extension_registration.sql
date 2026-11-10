-- #104: pg_net creates its operational functions in net.* but Supabase
-- default CREATE EXTENSION registered the extension in public, causing
-- the security advisor 'extension_in_public' finding.
-- pg_net is non-relocatable, so reinstall it explicitly under extensions.
-- No HTTP queue entries may be discarded; fail closed if any are pending.
-- Historical net._http_response probe results (short-lived operational
-- responses only) are intentionally reset by a pg_net reinstall.
DO $pgnet$
DECLARE installed_schema text;
BEGIN
 SELECT n.nspname INTO installed_schema
 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
 WHERE e.extname='pg_net';
 IF installed_schema='public' THEN
   IF (SELECT count(*) FROM net.http_request_queue) > 0 THEN
     RAISE EXCEPTION 'pg_net has outstanding HTTP requests; retry later';
   END IF;
   DROP EXTENSION pg_net;
   CREATE EXTENSION pg_net WITH SCHEMA extensions;
 END IF;
END
$pgnet$;
-- net.http_post remains net.*; active cron.job command needs no edit.
