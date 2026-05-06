'use client';

import { useState, useEffect, useCallback } from 'react';
import PostHistory from '@/components/PostHistory';
import { createClient } from '@/lib/supabaseBrowser';
import { Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

export default function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const supabase = createClient();
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (postsData) {
      setPosts(postsData);

      const mediaIds = postsData.map((p) => p.media_id).filter(Boolean);
      if (mediaIds.length > 0) {
        const { data: mediaData } = await supabase
          .from('media_uploads')
          .select('id, file_type, public_url')
          .in('id', mediaIds);

        const map = {};
        mediaData?.forEach((m) => (map[m.id] = m));
        setMediaMap(map);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post History</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">View all your published posts and their status.</p>
        </div>
        <Link
          href="/dashboard/posts/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Post
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : posts.length > 0 ? (
        <PostHistory posts={posts} mediaMap={mediaMap} />
      ) : (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-500">No posts yet. Create your first post to see it here.</p>
          <Link href="/dashboard/posts/new" className="inline-flex items-center gap-2 mt-3 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
            <Plus className="w-4 h-4" />
            Create a post
          </Link>
        </div>
      )}
    </div>
  );
}
