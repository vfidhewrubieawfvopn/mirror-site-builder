-- Explicitly set security_invoker on the view
ALTER VIEW public.questions_student SET (security_invoker = true);