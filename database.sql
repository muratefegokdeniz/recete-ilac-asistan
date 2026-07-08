-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.active_medicines (
  id text NOT NULL,
  user_id uuid NOT NULL,
  medicine_id text,
  medicine_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  meal_timing text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  reminder_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_ids jsonb,
  notes text,
  CONSTRAINT active_medicines_pkey PRIMARY KEY (id),
  CONSTRAINT active_medicines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT active_medicines_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);
CREATE TABLE public.child_link_requests (
  id text NOT NULL,
  parent_user_id uuid NOT NULL,
  child_display_name text NOT NULL,
  device_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT child_link_requests_pkey PRIMARY KEY (id),
  CONSTRAINT child_link_requests_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.family_members (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  age integer,
  gender text,
  height integer,
  weight integer,
  blood_type text,
  chronic_conditions text,
  allergies text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT family_members_pkey PRIMARY KEY (id),
  CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.child_vaccines (
  id text NOT NULL,
  user_id uuid NOT NULL,
  child_name text NOT NULL,
  vaccine_name text NOT NULL,
  recommended_age text,
  due_date date NOT NULL,
  completed_at timestamp with time zone,
  notification_id text,
  CONSTRAINT child_vaccines_pkey PRIMARY KEY (id),
  CONSTRAINT child_vaccines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_conversations (
  id text NOT NULL,
  user_id uuid,
  title text NOT NULL DEFAULT 'Yeni Sohbet'::text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT chat_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.login_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT login_logs_pkey PRIMARY KEY (id),
  CONSTRAINT login_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.medicines (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  purpose text,
  side_effects text,
  dosage text,
  frequency text,
  meal_timing text,
  expiry_date text,
  quantity integer DEFAULT 0,
  image_uri text,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medicines_pkey PRIMARY KEY (id),
  CONSTRAINT medicines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.prescriptions (
  id text NOT NULL,
  user_id uuid NOT NULL,
  image_uri text,
  analysis jsonb NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prescriptions_pkey PRIMARY KEY (id),
  CONSTRAINT prescriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  age integer,
  gender text,
  height integer,
  weight integer,
  blood_type text,
  chronic_conditions text,
  allergies text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.taken_doses (
  id text NOT NULL,
  user_id uuid NOT NULL,
  active_medicine_id text NOT NULL,
  scheduled_time timestamp with time zone NOT NULL,
  taken_at timestamp with time zone,
  skipped boolean DEFAULT false,
  CONSTRAINT taken_doses_pkey PRIMARY KEY (id),
  CONSTRAINT taken_doses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT taken_doses_active_medicine_id_fkey FOREIGN KEY (active_medicine_id) REFERENCES public.active_medicines(id)
);