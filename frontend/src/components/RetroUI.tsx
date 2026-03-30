import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WindowProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}

export const Window = ({ children, className, title }: WindowProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  if (isClosed) return null;

  return (
    <div className={cn("window flex flex-col h-full", className, isMinimized && "!h-auto !min-h-0 flex-none")}>
      {title && (
        <div className="title-bar shrink-0">
          <span>{title}</span>
          <div className="flex gap-1">
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="bg-retro-bg text-black border border-black px-1 text-xs shadow-button active:shadow-button-pressed focus:outline-none"
            >
              _
            </button>
            <button 
              onClick={() => setIsClosed(true)}
              className="bg-retro-bg text-black border border-black px-1 text-xs pb-0.5 leading-none shadow-button active:shadow-button-pressed focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {!isMinimized && (
        <div className="window-content flex-1">
          {children}
        </div>
      )}
    </div>
  );
};

interface RetroButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const RetroButton = ({ children, onClick, className, disabled }: RetroButtonProps) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={cn("retro-button disabled:opacity-50 font-bold", className)}
  >
    {children}
  </button>
);
