import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
      <img src="/favicon.svg" alt="ChatSmile logo" className="h-8 w-8 max-[480px]:h-7 max-[480px]:w-7" />
      <span className="text-xl font-bold text-gray-900 dark:text-slate-100 max-[480px]:hidden">ChatSmile</span>
    </Link>
  );
}

