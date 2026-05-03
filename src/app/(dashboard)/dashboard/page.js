'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseBrowser';
import { Layers, Upload, FileText, ArrowRight, Image, Video } from 'lucide-react';

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [platformCount, setPlatformCount] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      const [profileRes, platformsRes, uploadsRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).single(),
        supabase.from('connected_platforms').select('id').eq('user_id', userId).eq('is_active', true),
        supabase.from('media_uploads').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('posts').select('*, media_uploads(file_type, public_url)').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      ]);

      setProfile(profileRes.data);
      setPlatformCount(platformsRes.data?.length || 0);
      setUploadCount(uploadsRes.data?.length || 0);
      setPostCount(postsRes.data?.length || 0);
      setPosts(postsRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'posted':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'partial':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name || 'User'}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Here's what's happening with your social accounts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{platformCount}</p>
              <p className="text-xs text-zinc-500">Connected Platforms</p>
            </div>
          </div>
          <Link href="/dashboard/platforms" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 hover:underline">
            Manage platforms <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uploadCount}</p>
              <p className="text-xs text-zinc-500">Total Uploads</p>
            </div>
          </div>
          <Link href="/dashboard/upload" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 hover:underline">
            Upload media <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{postCount}</p>
              <p className="text-xs text-zinc-500">Total Posts</p>
            </div>
          </div>
          <Link href="/dashboard/posts" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 hover:underline">
            View history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/platforms" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
          <Layers className="w-4 h-4" />
          Connect a Platform
        </Link>
        <Link href="/dashboard/upload" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors">
          <Upload className="w-4 h-4" />
          Upload Media
        </Link>
        <Link href="/dashboard/posts/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors">
          <FileText className="w-4 h-4" />
          Create Post
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Posts</h2>
        {posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => {
              const isVideo = post.media_uploads?.file_type?.startsWith('video/');
              return (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {post.media_uploads?.public_url && !isVideo ? (
                      <img src={post.media_uploads.public_url} alt="" className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <Video className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <Image className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {post.caption?.slice(0, 80)}{post.caption?.length > 80 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {post.platforms?.map((platform) => (
                        <span
                          key={platform}
                          className="px-2 py-0.5 rounded-md text-xs font-medium border bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 capitalize"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(post.status)}`}>
                    {post.status}
                  </span>
                  <span className="text-xs text-zinc-400 hidden sm:inline">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-sm text-zinc-500">No posts yet. Create your first post to see it here.</p>
            <Link href="/dashboard/posts/new" className="inline-flex items-center gap-2 mt-3 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
              Create a post <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
