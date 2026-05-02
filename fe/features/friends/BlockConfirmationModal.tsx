'use client';

import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDanger = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-6">
          <div className="flex items-start gap-4">
            {isDanger && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
            )}
            <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-400">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-2 rounded-b-2xl bg-gray-50/80 px-4 py-3 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white transition shadow-sm ${
              isDanger 
                ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >

            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
