-- PostHive Database Schema

-- 1. Profiles Table
-- Extends the default auth.users table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Media Uploads Table
-- Stores metadata for files uploaded to Supabase Storage
CREATE TABLE IF NOT EXISTS public.media_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  bucket_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on media_uploads
ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

-- 3. Connected Platforms Table
-- Stores API credentials for social media platforms
CREATE TABLE IF NOT EXISTS public.connected_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Enable RLS on connected_platforms
ALTER TABLE public.connected_platforms ENABLE ROW LEVEL SECURITY;

-- 4. Posts Table
-- Tracks posts created through the platform
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  media_id UUID REFERENCES public.media_uploads(id) ON DELETE SET NULL,
  caption TEXT NOT NULL,
  platforms TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'posted', 'partial', 'failed'
  results JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- --- RLS POLICIES ---

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Media Uploads policies
CREATE POLICY "Users can view their own media" ON public.media_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media" ON public.media_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media" ON public.media_uploads
  FOR DELETE USING (auth.uid() = user_id);

-- Connected Platforms policies
CREATE POLICY "Users can view their own connections" ON public.connected_platforms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own connections" ON public.connected_platforms
  FOR ALL USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Users can view their own posts" ON public.posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
