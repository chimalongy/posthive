'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Image, Film, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabaseBrowser';

export default function MediaUploader({ onUpload }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const acceptedTypes = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/mov,video/avi';

  const handleFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload an image (JPG, PNG, GIF, WEBP) or video (MP4, MOV, AVI).');
      return;
    }

    // Optional: Check local size limit (e.g. 80MB)
    if (selectedFile.size > 80 * 1024 * 1024) {
      setError('File is too large. Max limit is 80MB.');
      return;
    }

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFile(droppedFile);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');

    const supabase = createClient();
    
    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in to upload media.');

      const fileName = file.name;
      const fileType = file.type;
      const timestamp = Date.now();
      const path = `${user.id}/${timestamp}_${fileName}`;
      const bucketName = 'posthive'; // Match your Supabase bucket name

      // 2. Upload directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          contentType: fileType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Supabase Storage Error:', uploadError);
        // If bucket doesn't exist or policy is missing
        if (uploadError.message.includes('bucket not found')) {
          throw new Error('Storage bucket "posthive" not found. Please create it in Supabase.');
        }
        if (uploadError.message.includes('row-level security policy')) {
          throw new Error('Storage RLS Error: Your Supabase storage bucket "posthive" is missing policies. Please enable "Insert" access for authenticated users in the storage dashboard.');
        }
        throw uploadError;
      }

      setProgress(50); // Direct upload doesn't have easy progress in SDK, we simulate or just show active

      // 3. Get Public URL
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;

      // 4. Save metadata to DB via API (to keep logic centralized and secure)
      console.log('Saving metadata to DB...');
      const res = await fetch('/api/upload/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: fileName,
          file_type: fileType,
          bucket_path: path,
          public_url: publicUrl,
        }),
      });

      const dbData = await res.json();
      if (!res.ok) {
        console.error('Metadata API Error:', dbData.error);
        if (dbData.error?.includes('row-level security policy')) {
          throw new Error('Database RLS Error: Metadata save failed. The server was unable to verify your permission to create this record.');
        }
        throw new Error(dbData.error || 'Failed to save metadata');
      }

      setProgress(100);
      onUpload?.(dbData);
      clearFile();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setProgress(0);
    setError('');
  };

  const isVideo = file?.type?.startsWith('video/');

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Upload className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Drag and drop your media here</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                or click to browse (Max 80MB)
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept={acceptedTypes}
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" />
                Choose File
              </span>
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                {isVideo ? <Film className="w-5 h-5 text-zinc-500" /> : <Image className="w-5 h-5 text-zinc-500" />}
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={clearFile}
              disabled={uploading}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-4">
            {isVideo ? (
              <video src={preview} controls className="w-full max-h-64 object-contain" />
            ) : (
              <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
            )}
          </div>

          {uploading && (
            <div className="mb-3 space-y-2">
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Uploading directly to secure storage...
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload to PostHive'}
          </button>
        </div>
      )}
    </div>
  );
}
