'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';

export function AppPopupHost() {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);
  const confirmDialog = useUiStore((state) => state.confirmDialog);
  const resolveConfirm = useUiStore((state) => state.resolveConfirm);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      setTimeout(() => {
        removeToast(toast.id);
      }, 2600),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex flex-col items-end gap-2 max-w-[min(92vw,360px)]">
        {toasts.map((toast) => {
          const toneClass =
            toast.type === 'success'
              ? 'bg-green-600/95'
              : toast.type === 'error'
                ? 'bg-red-600/95'
                : 'bg-slate-900/95 dark:bg-slate-700/95';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toneClass}`}
            >
              {toast.message}
            </div>
          );
        })}
      </div>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              {confirmDialog.title}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              {confirmDialog.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => resolveConfirm(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

