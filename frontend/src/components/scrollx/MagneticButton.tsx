"use client";

import React, { useRef, useState } from 'react';

interface MagneticButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'onDragEnter' | 'onDragExit' | 'onDragLeave' | 'onDragOver' | 'onDrop'> {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  strength = 0.4,
  disabled = false,
  onClick,
  style,
  ...props
}) => {
  // The magnetic pull moves the button's content only (via --mx/--my). Moving the <button>
  // itself (plus scale-on-hover/tap) shifted its hit area under the cursor,
  // so a press that started near an edge often released outside the button
  // and the click was lost - users had to click twice.
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const max = 6; // px, keep the content inside the button
    const clamp = (v: number) => Math.max(-max, Math.min(max, v));
    setPosition({
      x: clamp((clientX - (left + width / 2)) * strength * 0.25),
      y: clamp((clientY - (top + height / 2)) * strength * 0.25),
    });
  };

  const handleMouseLeave = () => setPosition({ x: 0, y: 0 });

  return (
    <button
      ref={ref}
      className={`relative overflow-hidden transition-[filter,opacity] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60 [&>*]:transition-transform [&>*]:duration-150 [&>*]:[transform:translate(var(--mx),var(--my))] ${className}`}
      style={{ ['--mx' as any]: `${position.x}px`, ['--my' as any]: `${position.y}px`, ...(style || {}) }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default MagneticButton;
