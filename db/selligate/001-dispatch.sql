-- Additive isolated migration. No existing order backfill. Backup before apply.
CREATE SCHEMA selligate;
CREATE TABLE selligate.settings(id integer PRIMARY KEY CHECK(id=1),mode text NOT NULL DEFAULT 'OFF' CHECK(mode IN ('OFF','TEST','LIVE')),stopped boolean NOT NULL DEFAULT true,generation integer NOT NULL DEFAULT 1,test_group text,production_group text,updated_at timestamptz NOT NULL DEFAULT now(),updated_by text,live_approved_at timestamptz,live_approved_by text,CHECK(test_group IS DISTINCT FROM production_group OR test_group IS NULL));
INSERT INTO selligate.settings(id) VALUES(1);
CREATE TABLE selligate.availability(product_id integer PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,states text[] NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),updated_by text NOT NULL,CHECK(states <@ ARRAY['AB','AD','AK','AN','BA','BY','BE','BO','CR','DE','EB','ED','EK','EN','FC','GO','IM','JI','KD','KN','KT','KE','KO','KW','LA','NA','NI','OG','ON','OS','OY','PL','RI','SO','TA','YO','ZA']::text[]));
CREATE TABLE selligate.connection(id integer PRIMARY KEY CHECK(id=1),instance_id text,status text NOT NULL DEFAULT 'DISCONNECTED' CHECK(status IN ('CONNECTED','DISCONNECTED','RECONNECTING','AUTHENTICATION_REQUIRED')),account text,heartbeat_at timestamptz,groups jsonb NOT NULL DEFAULT '[]',groups_at timestamptz,qr_data text,qr_expires_at timestamptz,command text,command_id uuid);
INSERT INTO selligate.connection(id) VALUES(1);
CREATE TABLE selligate.jobs(id uuid PRIMARY KEY,order_id integer REFERENCES public.orders(id) ON DELETE SET NULL,order_number text NOT NULL,mode text NOT NULL CHECK(mode IN ('TEST','LIVE')),destination text NOT NULL,generation integer NOT NULL,status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','CLAIMED','SKIPPED','SENDING','SENT','FAILED','CANCELLED','UNCERTAIN')),fixture jsonb,decisions jsonb NOT NULL DEFAULT '[]',state_code text,partial boolean NOT NULL DEFAULT false,reason text,claim_token uuid,lease_until timestamptz,attempt_token uuid,attempts integer NOT NULL DEFAULT 0,message_id text,ack integer,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK((mode='TEST' AND fixture IS NOT NULL) OR (mode='LIVE' AND fixture IS NULL)));
CREATE UNIQUE INDEX selligate_live_order_once ON selligate.jobs(order_id) WHERE mode='LIVE';
CREATE UNIQUE INDEX selligate_message_once ON selligate.jobs(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX selligate_jobs_queue ON selligate.jobs(status,created_at);
CREATE TABLE selligate.attempts(token uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES selligate.jobs(id),number integer NOT NULL,status text NOT NULL,body_hash text NOT NULL,message_id text,reason text,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,UNIQUE(job_id,number));
CREATE TABLE selligate.acks(job_id uuid NOT NULL REFERENCES selligate.jobs(id),message_id text NOT NULL,ack integer NOT NULL CHECK(ack BETWEEN -1 AND 4),observed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(job_id,message_id,ack));
CREATE TABLE selligate.audit(id bigserial PRIMARY KEY,actor text NOT NULL,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE selligate.nonces(key_id text NOT NULL,nonce text NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(key_id,nonce));
CREATE TABLE selligate.order_events(order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,observed_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION selligate.capture_placed_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s selligate.settings%ROWTYPE; inserted_count integer;
BEGIN
 -- Existing lifecycle: COD starts confirmed; pending checkout becomes processing.
 -- No payment column is consulted or changed. Failed checkout attempts stay out.
 IF NEW.status NOT IN ('confirmed','processing') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('confirmed','processing','packaged','dispatched','delivered','cancelled','refunded') THEN RETURN NEW; END IF;
 INSERT INTO selligate.order_events(order_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 IF inserted_count=0 THEN RETURN NEW; END IF;
 SELECT * INTO s FROM selligate.settings WHERE id=1 FOR SHARE;
 IF s.mode='LIVE' AND NOT s.stopped AND s.production_group IS NOT NULL THEN
  INSERT INTO selligate.jobs(id,order_id,order_number,mode,destination,generation) VALUES(gen_random_uuid(),NEW.id,NEW.order_number,'LIVE',s.production_group,s.generation) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER selligate_order_placed AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION selligate.capture_placed_order();

ALTER TABLE selligate.settings ADD CONSTRAINT test_group_shape CHECK(test_group IS NULL OR test_group ~ '^\d{5,25}(-\d{5,20})?@g\.us$'), ADD CONSTRAINT production_group_shape CHECK(production_group IS NULL OR production_group ~ '^\d{5,25}(-\d{5,20})?@g\.us$');

CREATE TABLE selligate.migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO selligate.migrations(version) VALUES('001');
