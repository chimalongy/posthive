# PostHive — Social Media Posting Platform

A full-stack social media posting platform built with Next.js, Tailwind CSS, and Supabase. Users can register, connect multiple social media accounts, upload media, and post to one or more platforms simultaneously.

## Features

- **Authentication**: Email/password auth via Supabase Auth
- **Platform Management**: Connect Facebook, Instagram, YouTube, TikTok, and Twitter/X with verified API credentials
- **Media Upload**: Drag-and-drop upload to Supabase Storage with live preview
- **Create Post**: Select media, write captions, choose platforms, and post simultaneously
- **Post History**: Track posting status and view per-platform results
- **Dark Mode**: Automatic dark mode support via Tailwind CSS

## Tech Stack

- **Frontend**: Next.js (App Router), JavaScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database & Auth**: Supabase (PostgreSQL, Auth, Storage)

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd posthive
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Set up Supabase

1. Create a new Supabase project
2. Run the following SQL in the Supabase SQL Editor to create tables:

```sql
-- Table: profiles
CREATE TABLE profiles (
  id uuid references auth.users.id primary key,
  email text,
  full_name text,
  created_at timestamptz default now()
);

-- Table: connected_platforms
CREATE TABLE connected_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  platform text,
  credentials jsonb,
  connected_at timestamptz default now(),
  is_active boolean default true
);

-- Table: media_uploads
CREATE TABLE media_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  file_name text,
  file_type text,
  bucket_path text,
  public_url text,
  uploaded_at timestamptz default now()
);

-- Table: posts
CREATE TABLE posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  media_id uuid references media_uploads(id),
  caption text,
  platforms text[],
  status text,
  results jsonb,
  created_at timestamptz default now()
);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('media-uploads', 'media-uploads', true);

-- RLS policies
alter table profiles enable row level security;
alter table connected_platforms enable row level security;
alter table media_uploads enable row level security;
alter table posts enable row level security;

create policy "Users can only access their own profile" on profiles
  for all using (auth.uid() = id);

create policy "Users can only access their own platforms" on connected_platforms
  for all using (auth.uid() = user_id);

create policy "Users can only access their own uploads" on media_uploads
  for all using (auth.uid() = user_id);

create policy "Users can only access their own posts" on posts
  for all using (auth.uid() = user_id);
```

3. In Supabase Storage, create the **media-uploads** bucket and set it to public.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Credentials Guide

Each platform requires specific API credentials. See the in-app CredentialModal for field-level help links and warnings.

| Platform | Credentials Required |
|----------|---------------------|
| Facebook | App ID, App Secret, Page Access Token, Page ID |
| Instagram | IG Business Account ID, Facebook Page Access Token, Facebook Page ID |
| YouTube | Client ID, Client Secret, Refresh Token |
| TikTok | Client Key, Client Secret, Access Token, Refresh Token |
| Twitter/X | API Key, API Key Secret, Access Token, Access Token Secret |

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in API routes and never exposed to the client.
- Platform credentials are stored in the `connected_platforms.credentials` JSONB column and never returned to the client.
- All API routes verify the authenticated Supabase session before processing requests.

## License

MIT
