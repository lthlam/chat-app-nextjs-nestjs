import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

interface UiStoreState {
  toasts: ToastItem[];
  confirmDialog: ConfirmDialogState;
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
  requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (accepted: boolean) => void;
  closeConfirm: () => void;
  activeActionMenuMessageId: string | null;
  reactionPickerFor: string | null;
  setActiveActionMenuMessageId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setReactionPickerFor: (id: string | null | ((prev: string | null) => string | null)) => void;
  reset: () => void;
}

const defaultConfirmDialog: ConfirmDialogState = {
  isOpen: false,
  title: 'Xác nhận',
  message: '',
  confirmText: 'Đồng ý',
  cancelText: 'Hủy',
};

let toastId = 0;
let confirmResolver: ((accepted: boolean) => void) | null = null;

export const useUiStore = create<UiStoreState>((set) => ({
  toasts: [],
  confirmDialog: defaultConfirmDialog,

  showToast: (message, type = 'info') => {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  requestConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      confirmResolver = resolve;
      set({
        confirmDialog: {
          isOpen: true,
          title: options.title || 'Xác nhận',
          message: options.message,
          confirmText: options.confirmText || 'Đồng ý',
          cancelText: options.cancelText || 'Hủy',
        },
      });
    }),

  resolveConfirm: (accepted) => {
    if (confirmResolver) {
      confirmResolver(accepted);
      confirmResolver = null;
    }

    set({
      confirmDialog: defaultConfirmDialog,
    });
  },

  closeConfirm: () => {
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    set({
      confirmDialog: defaultConfirmDialog,
    });
  },
  activeActionMenuMessageId: null,
  reactionPickerFor: null,
  setActiveActionMenuMessageId: (id) => set((state) => ({ 
    activeActionMenuMessageId: typeof id === 'function' ? id(state.activeActionMenuMessageId) : id 
  })),
  setReactionPickerFor: (id) => set((state) => ({ 
    reactionPickerFor: typeof id === 'function' ? id(state.reactionPickerFor) : id 
  })),

  reset: () => set({
    toasts: [],
    confirmDialog: defaultConfirmDialog,
    activeActionMenuMessageId: null,
    reactionPickerFor: null,
  }),
}));
