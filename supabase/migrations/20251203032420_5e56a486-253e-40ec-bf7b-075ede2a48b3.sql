-- Disable RLS on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all policies on profiles
DROP POLICY IF EXISTS "Anyone can insert their profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Drop all policies on questions
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.questions;

-- Drop all policies on test_results
DROP POLICY IF EXISTS "Students can insert their own results" ON public.test_results;
DROP POLICY IF EXISTS "Students can update their own results" ON public.test_results;
DROP POLICY IF EXISTS "Students can view their own results" ON public.test_results;
DROP POLICY IF EXISTS "Teachers can view all results" ON public.test_results;

-- Drop all policies on tests
DROP POLICY IF EXISTS "Everyone can view active tests" ON public.tests;
DROP POLICY IF EXISTS "Teachers can create tests" ON public.tests;
DROP POLICY IF EXISTS "Teachers can update their own tests" ON public.tests;

-- Drop all policies on user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;