'use client';

import React from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  status?: 'online' | 'offline' | 'away';
  showStatus?: boolean;
}

const sizeMap: Record<string, string> = {
  'xs': 'w-6 h-6 text-[10px]',
  'sm': 'w-8 h-8 text-xs',
  'md': 'w-10 h-10 text-sm',
  'lg': 'w-12 h-12 text-lg',
  'xl': 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
};

export function Avatar({ src, name, size = 'md', className = '', status, showStatus = false }: AvatarProps) {

  const currentSizeClass = typeof size === 'string' ? sizeMap[size] : '';
  const customSizeStyle = typeof size === 'number' ? { width: size, height: size, fontSize: size / 2.5 } : {};

  return (
    <div className={`relative flex-shrink-0 rounded-full ${currentSizeClass} ${className}`} style={customSizeStyle}>
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        {src ? (
          <img width={400} height={400} src={src} alt={name || 'Avatar'} className="w-full h-full object-cover" />
        ) : (
          <span>{name ? name.charAt(0).toUpperCase() : '?'}</span>
        )}
      </div>

      {showStatus && status && (
        <span
          className={`absolute -bottom-[2%] -right-[2%] rounded-full border-2 border-white dark:border-slate-900 ${
            status === 'online' ? 'bg-green-500' : status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
          }`}
          style={{ width: '32%', height: '32%', minWidth: '12px', minHeight: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        />
      )}
    </div>
  );
}
