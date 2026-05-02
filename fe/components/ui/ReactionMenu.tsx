'use client';

import { useRef, useEffect } from 'react';

interface ReactionMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onReactionSelect: (emoji: string) => void;
  onClose: () => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

export function ReactionMenu({ isOpen, position, onReactionSelect, onClose }: ReactionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-full shadow-lg p-2 flex gap-1 border border-gray-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onReactionSelect(emoji);
            onClose();
          }}
          className="text-xl p-2 hover:bg-gray-100 rounded-full transition cursor-pointer hover:scale-125 transform"
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

