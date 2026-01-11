"use client";

import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "../../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg border border-zinc-100",
              className,
            )}
            onClick={(event: MouseEvent) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-zinc-500 hover:text-zinc-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-zinc-900">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}