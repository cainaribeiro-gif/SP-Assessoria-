-- Migration 003: Row Level Security (RLS) Policies

-- Helper function to check user role safely
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND active = true
  LIMIT 1;
$$;

-- Helper function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('admin', 'gestor', 'supervisor', 'analista', 'atendente', 'consulta')
  );
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own non-sensitive profile fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = public.current_user_role() -- cannot elevate own role
  );

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'admin');

-- Policies for site_content
CREATE POLICY "Public can view public site content" ON public.site_content
  FOR SELECT USING (is_public = true OR public.is_admin());

CREATE POLICY "Admins can edit site content" ON public.site_content
  FOR ALL USING (public.is_admin());

-- Policies for leads
CREATE POLICY "Staff can view leads" ON public.leads
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Staff can edit leads" ON public.leads
  FOR ALL USING (public.is_admin());

-- Policies for requests
CREATE POLICY "Clients can view own requests" ON public.requests
  FOR SELECT USING (
    client_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Staff can manage requests" ON public.requests
  FOR ALL USING (public.is_admin());

-- Policies for clients
CREATE POLICY "Clients can view own data" ON public.clients
  FOR SELECT USING (
    profile_id = auth.uid()
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Staff can manage clients" ON public.clients
  FOR ALL USING (public.is_admin());

-- Policies for processes
CREATE POLICY "Clients can view own processes" ON public.processes
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Staff can manage processes" ON public.processes
  FOR ALL USING (public.is_admin());

-- Policies for documents
CREATE POLICY "Clients can access own documents" ON public.documents
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Staff can manage documents" ON public.documents
  FOR ALL USING (public.is_admin());

-- Policies for audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() IN ('admin', 'gestor'));
