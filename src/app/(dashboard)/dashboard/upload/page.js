'use client';

import { useState } from 'react';
import MediaUploader from '@/components/MediaUploader';
import { Link } from 'lucide-react';

export default function UploadPage() {
  const [lastUpload, setLastUpload] = useState(null);

  const handleUpload = (data) => {
    setLastUpload(data);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Upload Media</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Drag and drop or browse to upload images and videos for your posts.
        </p>
      </div>

      <MediaUploader onUpload={handleUpload} />

      {lastUpload && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Upload successful!</p>
              <p className="text-xs text-zinc-500">{lastUpload.file_name}</p>
            </div>
          </div>
          <a
            href="/posts/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <Link className="w-4 h-4" />
            Create a Post with this
          </a>
        </div>
      )}
    </div>
  );
}
