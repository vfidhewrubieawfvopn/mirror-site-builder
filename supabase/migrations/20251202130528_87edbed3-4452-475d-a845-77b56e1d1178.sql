-- Drop the SECURITY DEFINER view and recreate as regular view
DROP VIEW IF EXISTS public.questions_student;

-- Create a regular view (not SECURITY DEFINER) that excludes correct_answer
CREATE VIEW public.questions_student AS
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
FROM public.questions;