-- Migration 004: Storage Buckets and Storage Policies

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('public-assets', 'public-assets', true),
  ('private-documents', 'private-documents', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public assets storage policies
CREATE POLICY "Public read for public assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

CREATE POLICY "Admin write for public assets" ON storage.objects
  FOR ALL USING (bucket_id = 'public-assets' AND public.is_admin());

-- Private documents storage policies
CREATE POLICY "Access private documents by path or admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'private-documents' AND (
      public.is_admin() OR
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

CREATE POLICY "Admin manage private documents" ON storage.objects
  FOR ALL USING (bucket_id = 'private-documents' AND public.is_admin());

-- Avatars storage policies
CREATE POLICY "Public view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "User upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
