'use client';

interface TypingIndicatorProps {
  typingUsers: { userId: string; username: string }[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  return (
    <div className="flex gap-2 items-center text-gray-500 text-sm mt-2 animate-fade-in">
      <div className="flex gap-1 items-center px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-full">
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
      </div>
      <span className="italic">
        {typingUsers.map((u) => u.username).join(', ')} {typingUsers.length === 1 ? 'đang gõ…' : 'đang gõ…'}
      </span>
    </div>
  );
}
