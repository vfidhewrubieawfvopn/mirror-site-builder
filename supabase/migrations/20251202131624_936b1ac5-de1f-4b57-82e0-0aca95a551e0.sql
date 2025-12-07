-- Drop existing restrictive RLS policies on questions table
DROP POLICY IF EXISTS "Students can view questions via view" ON public.questions;
DROP POLICY IF EXISTS "Teachers can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Teachers can view all question data" ON public.questions;

-- Create simpler policies
CREATE POLICY "Authenticated users can view questions"
ON public.questions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert questions"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update questions"
ON public.questions FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete questions"
ON public.questions FOR DELETE
TO authenticated
USING (true);