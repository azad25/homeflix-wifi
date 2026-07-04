"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Settings } from 'lucide-react';

async function apiVerifyPin(pin: string): Promise<boolean> {
  const res = await fetch('/api/pin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function apiChangePin(currentPin: string, newPin: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/pin/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPin, newPin }),
  });
  return res.json();
}

interface PinLockProps {
  children: React.ReactNode;
}

export default function PinLock({ children }: PinLockProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [showDigits, setShowDigits] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    setTimeout(() => inputRefs[0].current?.focus(), 100);
  }, []);

  const triggerError = useCallback(() => {
    setError(true);
    setShake(true);
    setTimeout(() => {
      setDigits(['', '', '', '']);
      setShake(false);
      setError(false);
      inputRefs[0].current?.focus();
    }, 600);
  }, []);

  const checkPin = useCallback(async (d: string[]) => {
    const ok = await apiVerifyPin(d.join(''));
    if (ok) {
      setUnlocked(true);
    } else {
      triggerError();
    }
  }, [triggerError]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(false);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
    if (next.every(d => d !== '') && value) {
      checkPin(next);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 4) {
      const next = text.split('');
      setDigits(next);
      inputRefs[3].current?.focus();
      checkPin(next);
    }
    e.preventDefault();
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8 px-8 py-10 rounded-2xl bg-white/5 border border-white/10 shadow-2xl w-full max-w-sm mx-4"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium tracking-widest uppercase">Settings</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Enter PIN</h2>
          <p className="text-white/40 text-sm text-center">Enter your 4-digit PIN to access settings</p>
        </div>

        <div className="flex gap-4" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type={showDigits ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white/10 text-white outline-none transition-all
                ${error ? 'border-red-500 bg-red-500/10' : digit ? 'border-red-500 bg-white/15' : 'border-white/20 focus:border-white/50'}`}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-sm font-medium -mt-4"
            >
              Incorrect PIN. Try again.
            </motion.p>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowDigits(v => !v)}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          {showDigits ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showDigits ? 'Hide digits' : 'Show digits'}
        </button>
      </motion.div>
    </div>
  );
}
