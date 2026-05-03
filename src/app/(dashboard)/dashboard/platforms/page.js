'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlatformCard from '@/components/PlatformCard';
import CredentialModal from '@/components/CredentialModal';
import { Loader2 } from 'lucide-react';

const allPlatforms = ['facebook', 'instagram', 'youtube', 'tiktok', 'twitter'];

export default function PlatformsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <PlatformsContent />
    </Suspense>
  );
}

function PlatformsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPlatform, setModalPlatform] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      setToast({ type: 'success', message: success });
      setTimeout(() => {
        setToast(null);
        router.replace('/dashboard/platforms');
      }, 3000);
    } else if (error) {
      setToast({ type: 'error', message: error });
      setTimeout(() => {
        setToast(null);
        router.replace('/dashboard/platforms');
      }, 5000);
    }
  }, [searchParams, router]);

  const fetchPlatforms = useCallback(async () => {
    try {
      const res = await fetch('/api/platforms');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setConnected(data.platforms || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const handleConnect = async (platform, credentials) => {
    const res = await fetch('/api/platforms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, credentials }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save credentials');
    }

    const data = await res.json();
    await fetchPlatforms();
    
    if (data.redirectUrl) {
      return data;
    }

    setToast({ type: 'success', message: `${platform} connected successfully!` });
    setTimeout(() => setToast(null), 3000);
    return data;
  };

  const handleDisconnect = async (platform) => {
    const record = connected.find((p) => p.platform === platform);
    if (!record) return;

    const res = await fetch('/api/platforms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.id }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to disconnect');
    }

    await fetchPlatforms();
    setToast({ type: 'success', message: `${platform} disconnected.` });
    setTimeout(() => setToast(null), 3000);
  };

  const connectedMap = new Map(connected.map((p) => [p.platform, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connected Platforms</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Link your social media accounts to start posting everywhere at once.
        </p>
      </div>

      {toast && (
        <div className={`p-4 rounded-xl text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPlatforms.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              connected={!!connectedMap.get(platform)}
              details={connectedMap.get(platform)}
              onConnect={() => setModalPlatform(platform)}
              onDisconnect={() => handleDisconnect(platform)}
            />
          ))}
        </div>
      )}

      {modalPlatform && (
        <CredentialModal
          platform={modalPlatform}
          onSave={(credentials) => handleConnect(modalPlatform, credentials)}
          onClose={() => setModalPlatform(null)}
        />
      )}
    </div>
  );
}
