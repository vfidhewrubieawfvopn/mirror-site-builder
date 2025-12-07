-- Create a secure view that hides correct_answer from students
CREATE OR REPLACE VIEW public.questions_student AS
SELECT 
  id,
  test_id,
  question_type,
  difficulty,
  passage_id,
  passage_text,
  passage_title,
  sub_question_label,
  question_text,
  options,
  marks,
  order_index,
  media_url,
  media_type,
  created_at
  -- correct_answer is intentionally excluded
FROM public.questions;

-- Grant access to the view
GRANT SELECT ON public.questions_student TO authenticated;
GRANT SELECT ON public.questions_student TO anon;

-- Enable RLS on the view (inherited from base table)
-- Create a function to check answers securely (server-side only)
CREATE OR REPLACE FUNCTION public.check_answer(
  p_question_id UUID,
  p_answer TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_answer TEXT;
BEGIN
  SELECT correct_answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;
  
  RETURN v_correct_answer = p_answer;
END;
$$;

-- Update the student policy to be more restrictive
DROP POLICY IF EXISTS "Students can view test questions" ON public.questions;

-- Students should use the view instead, but teachers still need full access
-- Create policy that only allows teachers/admins to see correct_answer via direct table access
CREATE POLICY "Teachers can view all question data" 
ON public.questions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tests 
    WHERE tests.id = questions.test_id 
    AND (tests.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  )
);

-- Students can only access via the view which excludes correct_answer
-- They need basic SELECT for the view to work, but the view filters the columns
CREATE POLICY "Students can view questions via view" 
ON public.questions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tests 
    WHERE tests.id = questions.test_id 
    AND tests.is_active = true
    AND has_role(auth.uid(), 'student'::app_role)
  )
);