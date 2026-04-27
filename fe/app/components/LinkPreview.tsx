'use client';

import { useState, useEffect } from 'react';
import { messagesApi } from '@/lib/api';

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    image: string;
    siteName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const data = await messagesApi.getLinkPreview(url);
        if (isMounted) setPreview(data);
      } catch (e) {
        console.error('Link preview failed:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-3 animate-pulse">
        <div className="h-4 w-2/3 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
        <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded mb-1"></div>
        <div className="h-3 w-1/2 bg-gray-200 dark:bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (!preview || (!preview.title && !preview.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm group no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <div className="aspect-video w-full overflow-hidden border-b border-gray-100 dark:border-slate-700 bg-gray-100 dark:bg-slate-900">
          <img
            src={preview.image}
            alt={preview.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}
      <div className="p-3">
        {preview.siteName && (
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
            {preview.siteName}
          </p>
        )}
        <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 mb-1">
          {preview.title}
        </h4>
        {preview.description && (
          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
