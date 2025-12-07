-- Remove storage policies on test-files bucket
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view test files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Create permissive policies for storage
CREATE POLICY "Allow all operations on test-files"
ON storage.objects
FOR ALL
USING (true)
WITH CHECK (true);