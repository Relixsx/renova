export const quoteIdentifier = value => '"' + value.replaceAll('"', '""') + '"';
export const quoteLiteral = value => "'" + String(value).replaceAll("'", "''") + "'";

export function emptyCheckSql() {
  return `DO $renova_empty$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','v','m','S','f'))
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','drizzle'))
 OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','drizzle') AND t.typtype IN ('e','d','r','m'))
 OR to_regnamespace('renova_migration') IS NOT NULL
 THEN RAISE EXCEPTION USING MESSAGE='RENOVA_NOT_EMPTY', ERRCODE='P0001'; END IF;
END $renova_empty$;`;
}

export function preparationSql() {
  return `SET lock_timeout='20s';
SELECT pg_advisory_xact_lock(723481938473::bigint);
${emptyCheckSql()}
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS drizzle;
`;
}

export function countVerificationSql(manifest) {
  const counts = manifest.tableCounts.map(row => `
 IF to_regclass(${quoteLiteral(row.schema + '.' + row.table)}) IS NULL THEN
   RAISE EXCEPTION USING MESSAGE='RENOVA_TABLE_SET_MISMATCH', ERRCODE='P0001';
 END IF;
 SELECT count(*) INTO n FROM ONLY ${quoteIdentifier(row.schema)}.${quoteIdentifier(row.table)};
 IF n <> ${row.rows}::bigint THEN RAISE EXCEPTION USING MESSAGE='RENOVA_COUNT_MISMATCH', ERRCODE='P0001'; END IF;`).join('\n');
  return `DO $renova_counts$
DECLARE n bigint;
BEGIN
${counts}
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE c.relkind IN ('r','p') AND ns.nspname IN ('public','drizzle');
 IF n <> ${manifest.tableCounts.length} THEN RAISE EXCEPTION USING MESSAGE='RENOVA_TABLE_SET_MISMATCH', ERRCODE='P0001'; END IF;
END $renova_counts$;
DO $renova_sequences$
DECLARE rec record; seq_name text; hi numeric; last_n numeric; called boolean; step_n bigint; cycles boolean;
BEGIN
 FOR rec IN
  SELECT ns.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name
  FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE ns.nspname IN ('public','drizzle') AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
 LOOP
  seq_name := pg_get_serial_sequence(format('%I.%I',rec.schema_name,rec.table_name),rec.column_name);
  IF seq_name IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT max(%I)::numeric FROM ONLY %I.%I',rec.column_name,rec.schema_name,rec.table_name) INTO hi;
  EXECUTE format('SELECT last_value::numeric,is_called FROM %s',seq_name) INTO last_n,called;
  SELECT seqincrement,seqcycle INTO step_n,cycles FROM pg_sequence WHERE seqrelid=seq_name::regclass;
  IF step_n<=0 OR cycles OR (hi IS NOT NULL AND (CASE WHEN called THEN last_n+step_n ELSE last_n END)<=hi)
   THEN RAISE EXCEPTION USING MESSAGE='RENOVA_SEQUENCE_UNSAFE', ERRCODE='P0001'; END IF;
 END LOOP;
END $renova_sequences$;
`;
}

export function verificationAndReceiptSql(manifest) {
  return `${countVerificationSql(manifest)}
CREATE SCHEMA renova_migration;
CREATE TABLE renova_migration.backup_receipt (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 archive_sha256 text NOT NULL, captured_at text NOT NULL, source_host text NOT NULL,
 table_counts jsonb NOT NULL, purpose text NOT NULL CHECK(purpose='initial-store-copy'),
 restored_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO renova_migration.backup_receipt(singleton,archive_sha256,captured_at,source_host,table_counts,purpose)
 VALUES(true,${quoteLiteral(manifest.sha256)},${quoteLiteral(manifest.capturedAt)},${quoteLiteral(manifest.sourceHost)},${quoteLiteral(JSON.stringify(manifest.tableCounts))}::jsonb,'initial-store-copy');
`;
}

export function receiptAssertionSql(manifest) {
  return `DO $renova_receipt$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM renova_migration.backup_receipt WHERE singleton AND archive_sha256=${quoteLiteral(manifest.sha256)} AND captured_at=${quoteLiteral(manifest.capturedAt)} AND purpose='initial-store-copy')
 THEN RAISE EXCEPTION USING MESSAGE='RENOVA_RECEIPT_MISMATCH', ERRCODE='P0001'; END IF;
END $renova_receipt$;`;
}
