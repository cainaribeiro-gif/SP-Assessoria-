-- Migration 005: Performance Indexes

CREATE INDEX IF NOT EXISTS idx_leads_protocol ON public.leads(protocol);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_protocol ON public.requests(protocol);
CREATE INDEX IF NOT EXISTS idx_requests_client_email ON public.requests(client_email);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);

CREATE INDEX IF NOT EXISTS idx_clients_cpf_hash ON public.clients(cpf_hash);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON public.clients(profile_id);

CREATE INDEX IF NOT EXISTS idx_processes_client_id ON public.processes(client_id);
CREATE INDEX IF NOT EXISTS idx_processes_protocol ON public.processes(protocol);

CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON public.documents(process_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_route ON public.rate_limits(key_hash, route);
