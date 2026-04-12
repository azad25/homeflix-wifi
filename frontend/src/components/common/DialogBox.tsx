"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, X, ChevronRight, AlertTriangle } from 'lucide-react';

export type DialogType = 'alert' | 'confirm' | 'prompt' | 'info' | 'success' | 'error' | 'warning';

interface DialogBoxProps {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message?: string;
  onConfirm: (value?: string) => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
  isDangerous?: boolean;
}

const typeConfig = {
  alert: { 
    icon: AlertCircle, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  confirm: { 
    icon: AlertCircle, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  prompt: { 
    icon: Info, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  info: { 
    icon: Info, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  success: { 
    icon: CheckCircle, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  error: { 
    icon: AlertCircle, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  },
  warning: { 
    icon: AlertTriangle, 
    bgGradient: 'from-red-600 to-red-700',
    textColor: 'text-red-100',
    accentColor: 'bg-red-500/10 border-red-500/20',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white'
  }
};

export default function DialogBox({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  placeholder,
  defaultValue = '',
  isDangerous = false
}: DialogBoxProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const config = typeConfig[type];
  const IconComponent = config.icon;

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
    setInputValue(defaultValue);
  };

  const handleCancel = () => {
    setInputValue(defaultValue);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  const getConfirmButtonStyle = () => {
    if (isDangerous) {
      return 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/50';
    }
    return `${config.buttonColor} shadow-lg shadow-red-500/50`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/70 backdrop-blur-xl z-40"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.05, damping: 20, mass: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
              {/* Icon Header with gradient bar */}
              <div className={`bg-gradient-to-r ${config.bgGradient} px-5 py-6 flex items-center gap-3 relative overflow-hidden`}>
                {/* Animated background elements */}
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{ 
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{ duration: 8, repeat: Infinity }}
                  style={{
                    backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  }}
                />
                
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0, duration: 0.2, damping: 18, mass: 0.5 }}
                  className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 relative z-10"
                >
                  <IconComponent className="w-6 h-6 text-white" strokeWidth={1.5} />
                </motion.div>
                
                <div className="relative z-10 flex-1">
                  <h2 className="text-lg font-bold text-white">{title}</h2>
                </div>

                {(type === 'info' || type === 'error' || type === 'success' || type === 'warning') && (
                  <motion.button
                    onClick={handleCancel}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative z-10"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                )}
              </div>

              {/* Content */}
              <div className="px-5 py-4 space-y-4">
                {message && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.2 }}
                    className="text-slate-300 text-sm leading-relaxed"
                  >
                    {message}
                  </motion.p>
                )}

                {type === 'prompt' && (
                  <motion.input
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.2 }}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200 text-sm"
                  />
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-700/50 px-5 py-3 flex items-center justify-end gap-2 bg-slate-800/30">
                {(type === 'confirm' || type === 'prompt') && (
                  <motion.button
                    onClick={handleCancel}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 text-slate-300 hover:text-slate-100 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/50 rounded-lg transition-all duration-200 font-medium text-sm"
                  >
                    {cancelText}
                  </motion.button>
                )}
                <motion.button
                  onClick={handleConfirm}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-5 py-2 border-0 rounded-lg transition-all duration-200 flex items-center gap-2 font-semibold text-sm ${getConfirmButtonStyle()}`}
                >
                  {confirmText}
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
