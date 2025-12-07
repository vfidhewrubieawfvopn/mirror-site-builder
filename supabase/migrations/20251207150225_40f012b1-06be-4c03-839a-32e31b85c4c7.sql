-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    student_id TEXT,
    grade TEXT,
    class TEXT,
    gender TEXT,
    age INTEGER,
    subject TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can view student profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- Tests table
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 60,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_grade TEXT,
    target_section TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own tests"
ON public.tests FOR ALL
USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view active tests"
ON public.tests FOR SELECT
USING (is_active = true);

-- Passages table
CREATE TABLE public.passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    passage_code TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    passage_type TEXT DEFAULT 'text',
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(test_id, passage_code)
);

ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage passages for their tests"
ON public.passages FOR ALL
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = passages.test_id AND tests.teacher_id = auth.uid()));

CREATE POLICY "Students can view passages"
ON public.passages FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = passages.test_id AND tests.is_active = true));

-- Questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    passage_id UUID REFERENCES public.passages(id) ON DELETE SET NULL,
    question_type TEXT DEFAULT 'mcq',
    difficulty TEXT DEFAULT 'easy',
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    marks INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    media_url TEXT,
    media_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage questions for their tests"
ON public.questions FOR ALL
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.teacher_id = auth.uid()));

CREATE POLICY "Students can view questions for active tests"
ON public.questions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.is_active = true));

-- Test results table
CREATE TABLE public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    score INTEGER,
    correct_answers INTEGER,
    wrong_answers INTEGER,
    total_questions INTEGER,
    difficulty_level TEXT,
    practice_score INTEGER,
    time_spent INTEGER,
    answers JSONB,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(test_id, student_id)
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own results"
ON public.test_results FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own results"
ON public.test_results FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view results for their tests"
ON public.test_results FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_results.test_id AND tests.teacher_id = auth.uid()));

-- Test sessions table (for state persistence)
CREATE TABLE public.test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    answers JSONB DEFAULT '{}',
    current_question INTEGER DEFAULT 0,
    time_remaining INTEGER,
    marked_for_review JSONB DEFAULT '[]',
    difficulty_level TEXT,
    practice_complete BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT now(),
    last_saved_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(test_id, student_id)
);

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own sessions"
ON public.test_sessions FOR ALL
USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view sessions for their tests"
ON public.test_sessions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_sessions.test_id AND tests.teacher_id = auth.uid()));

-- Create storage bucket for test files
INSERT INTO storage.buckets (id, name, public) VALUES ('test-files', 'test-files', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload test files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test-files' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-files' AND auth.role() = 'authenticated');

CREATE POLICY "Teachers can delete their uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'test-files' AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();