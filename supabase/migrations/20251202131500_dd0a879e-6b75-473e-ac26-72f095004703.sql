-- Create storage bucket for test files
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-files', 'test-files', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload test files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-files');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read test files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'test-files');

-- Allow public read access for test files
CREATE POLICY "Public can read test files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'test-files');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete test files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-files');