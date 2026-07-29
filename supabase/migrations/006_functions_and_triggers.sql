-- Migration 006: Functions and Triggers

-- Sequence for protocol generation
CREATE SEQUENCE IF NOT EXISTS public.protocol_seq START WITH 1 INCREMENT BY 1;

-- Function to generate unique protocol numbers (e.g. SPA-2026-000001)
CREATE OR REPLACE FUNCTION public.generate_protocol()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val BIGINT;
  year_str TEXT;
BEGIN
  seq_val := nextval('public.protocol_seq');
  year_str := to_char(now(), 'YYYY');
  RETURN 'SPA-' || year_str || '-' || lpad(seq_val::text, 6, '0');
END;
$$;

-- Automatic updated_at timestamp function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS tr_leads_updated_at ON public.leads;
CREATE TRIGGER tr_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_requests_updated_at ON public.requests;
CREATE TRIGGER tr_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_clients_updated_at ON public.clients;
CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_processes_updated_at ON public.processes;
CREATE TRIGGER tr_processes_updated_at BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
