CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'teacher',
    'student'
);


--
-- Name: generate_test_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_test_code(subject_param text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  prefix TEXT;
  random_chars TEXT;
  test_code TEXT;
BEGIN
  -- Get subject prefix
  prefix := CASE subject_param
    WHEN 'english' THEN 'E'
    WHEN 'science' THEN 'S'
    WHEN 'mathematics' THEN 'M'
    ELSE 'T'
  END;
  
  -- Generate 5 random uppercase letters
  random_chars := upper(substring(md5(random()::text) from 1 for 5));
  
  -- Combine prefix and random chars
  test_code := prefix || random_chars;
  
  RETURN test_code;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    role public.app_role DEFAULT 'student'::public.app_role NOT NULL,
    student_id text,
    grade text,
    class text,
    gender text,
    age integer,
    subject text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    question_type text NOT NULL,
    difficulty text NOT NULL,
    passage_id uuid,
    passage_text text,
    passage_title text,
    sub_question_label text,
    question_text text NOT NULL,
    options jsonb,
    correct_answer text,
    marks integer DEFAULT 1,
    order_index integer DEFAULT 0,
    media_url text,
    media_type text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['practice'::text, 'easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT questions_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'audio'::text, 'video'::text, NULL::text]))),
    CONSTRAINT questions_question_type_check CHECK ((question_type = ANY (ARRAY['mcq'::text, 'short-answer'::text, 'long-answer'::text])))
);


--
-- Name: test_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    student_id uuid NOT NULL,
    score numeric(5,2),
    difficulty_level text,
    time_spent_seconds integer,
    answers jsonb DEFAULT '{}'::jsonb,
    marked_for_review integer[] DEFAULT ARRAY[]::integer[],
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT test_results_difficulty_level_check CHECK ((difficulty_level = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_code text NOT NULL,
    subject text NOT NULL,
    title text NOT NULL,
    pdf_url text,
    total_questions integer DEFAULT 0,
    duration_minutes integer DEFAULT 60,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true,
    practice_pdf_url text,
    easy_pdf_url text,
    medium_pdf_url text,
    hard_pdf_url text,
    practice_question_count integer DEFAULT 0,
    easy_question_count integer DEFAULT 0,
    medium_question_count integer DEFAULT 0,
    hard_question_count integer DEFAULT 0,
    CONSTRAINT tests_subject_check CHECK ((subject = ANY (ARRAY['english'::text, 'science'::text, 'mathematics'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: test_results test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_pkey PRIMARY KEY (id);


--
-- Name: test_results test_results_test_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_test_id_student_id_key UNIQUE (test_id, student_id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: tests tests_test_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_test_code_key UNIQUE (test_code);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: questions questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: test_results test_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: test_results test_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: tests tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Anyone can insert their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert their profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: tests Everyone can view active tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active tests" ON public.tests FOR SELECT USING ((is_active = true));


--
-- Name: test_results Students can insert their own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can insert their own results" ON public.test_results FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: test_results Students can update their own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own results" ON public.test_results FOR UPDATE USING ((auth.uid() = student_id));


--
-- Name: questions Students can view test questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view test questions" ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tests
  WHERE ((tests.id = questions.test_id) AND (tests.is_active = true)))));


--
-- Name: test_results Students can view their own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own results" ON public.test_results FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: profiles Teachers and admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers and admins can view all profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'teacher'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: tests Teachers can create tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can create tests" ON public.tests FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'teacher'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: questions Teachers can manage questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can manage questions" ON public.questions USING ((EXISTS ( SELECT 1
   FROM public.tests
  WHERE ((tests.id = questions.test_id) AND (tests.created_by = auth.uid())))));


--
-- Name: tests Teachers can update their own tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update their own tests" ON public.tests FOR UPDATE USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: test_results Teachers can view all results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view all results" ON public.test_results FOR SELECT USING ((public.has_role(auth.uid(), 'teacher'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: test_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

--
-- Name: tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


