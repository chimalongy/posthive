'use client';

import { useState, useEffect, useCallback } from 'react';
import MediaUploader from '@/components/MediaUploader';
import { Link2, Image as ImageIcon, Film, Loader2, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';

export default function UploadPage() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpload, setLastUpload] = useState(null);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch('/api/upload');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMedia(data.media || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = (data) => {
    setLastUpload(data);
    setMedia((prev) => [data, ...prev]);
    // Clear last upload message after 5 seconds
    setTimeout(() => setLastUpload(null), 5000);
  };

  return (
    <div className="space-y-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Upload Media</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Add new images or videos to your library to use in your posts.
        </p>
        <div className="mt-6">
          <MediaUploader onUpload={handleUpload} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Media Library</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your previously uploaded files.
            </p>
          </div>
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            {media.length} items
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">No media uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {media.map((item) => {
              const isVideo = item.file_type?.startsWith('video/');
              return (
                <div 
                  key={item.id} 
                  className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300"
                >
                  <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    {isVideo ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <video 
                          src={item.public_url} 
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                            <Film className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img 
                        src={item.public_url} 
                        alt={item.file_name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                    
                    <div className="absolute top-3 right-3">
                      <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                        {isVideo ? 'Video' : 'Image'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100" title={item.file_name}>
                        {item.file_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/posts?mediaId=${item.id}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-zinc-900 dark:text-zinc-100 hover:text-white dark:hover:text-white text-xs font-bold transition-all duration-200"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Create Post
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
