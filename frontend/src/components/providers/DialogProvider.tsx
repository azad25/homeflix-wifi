"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import DialogBox, { DialogType } from '@/components/common/DialogBox';

interface DialogConfig {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
  isDangerous?: boolean;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

interface DialogContextType {
  alert: (title: string, message?: string) => Promise<void>;
  confirm: (title: string, message?: string, isDangerous?: boolean) => Promise<boolean>;
  prompt: (title: string, message?: string, defaultValue?: string, placeholder?: string) => Promise<string | null>;
  info: (title: string, message?: string) => Promise<void>;
  success: (title: string, message?: string) => Promise<void>;
  error: (title: string, message?: string) => Promise<void>;
  warning: (title: string, message?: string) => Promise<void>;
  show: (config: Omit<DialogConfig, 'isOpen'>) => Promise<any>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface DialogProviderProps {
  children: ReactNode;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [dialog, setDialog] = useState<DialogConfig>({
    isOpen: false,
    type: 'alert',
    title: '',
    confirmText: 'OK',
    cancelText: 'Cancel'
  });

  const closeDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const show = useCallback((config: Omit<DialogConfig, 'isOpen'>): Promise<any> => {
    return new Promise((resolve) => {
      setDialog(prev => ({
        ...prev,
        ...config,
        isOpen: true,
        onConfirm: (value?: string) => {
          resolve(value !== undefined ? value : true);
          setTimeout(() => closeDialog(), 100);
        },
        onCancel: () => {
          resolve(config.type === 'confirm' ? false : null);
          setTimeout(() => closeDialog(), 100);
        }
      }));
    });
  }, [closeDialog]);

  const alert = useCallback((title: string, message?: string) => {
    return show({ type: 'alert', title, message, confirmText: 'OK' });
  }, [show]);

  const confirm = useCallback((title: string, message?: string, isDangerous = false) => {
    return show({
      type: 'confirm',
      title,
      message,
      confirmText: isDangerous ? 'Delete' : 'Confirm',
      cancelText: 'Cancel',
      isDangerous
    });
  }, [show]);

  const prompt = useCallback((title: string, message?: string, defaultValue = '', placeholder = '') => {
    return show({
      type: 'prompt',
      title,
      message,
      confirmText: 'Submit',
      cancelText: 'Cancel',
      placeholder,
      defaultValue
    });
  }, [show]);

  const info = useCallback((title: string, message?: string) => {
    return show({ type: 'info', title, message, confirmText: 'OK' });
  }, [show]);

  const success = useCallback((title: string, message?: string) => {
    return show({ type: 'success', title, message, confirmText: 'OK' });
  }, [show]);

  const error = useCallback((title: string, message?: string) => {
    return show({ type: 'error', title, message, confirmText: 'OK' });
  }, [show]);

  const warning = useCallback((title: string, message?: string) => {
    return show({ type: 'warning', title, message, confirmText: 'OK' });
  }, [show]);

  return (
    <DialogContext.Provider
      value={{
        alert,
        confirm,
        prompt,
        info,
        success,
        error,
        warning,
        show
      }}
    >
      {children}
      <DialogBox
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        placeholder={dialog.placeholder}
        defaultValue={dialog.defaultValue}
        isDangerous={dialog.isDangerous}
        onConfirm={dialog.onConfirm || (() => {})}
        onCancel={dialog.onCancel}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
}
