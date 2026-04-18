-- Create profiles table for user management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'tourist' CHECK (role IN ('tourist', 'guide')),
  phone TEXT,
  bio TEXT,
  languages TEXT[] DEFAULT '{}',
  -- Guide-specific fields
  guide_tier TEXT DEFAULT 'free' CHECK (guide_tier IN ('free', 'pro')),
  guide_verified BOOLEAN DEFAULT FALSE,
  guide_rating NUMERIC(3,2) DEFAULT 0,
  guide_total_reviews INTEGER DEFAULT 0,
  guide_total_tours INTEGER DEFAULT 0,
  -- Tourist-specific fields
  tourist_total_bookings INTEGER DEFAULT 0,
  tourist_confirmed_attendances INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles table
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_public_guides"
  ON public.profiles FOR SELECT
  USING (role = 'guide' AND guide_verified = TRUE);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
