"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

export type DialogVariant = "default" | "danger" | "warning" | "info" | "success" | "error";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger" | "warning" | "info";
  isDestructive?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  inputType?: "text" | "datetime-local" | "url" | "email" | "number";
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger" | "warning";
  required?: boolean;
}

export interface AlertOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  variant?: "info" | "error" | "warning" | "success";
}

type DialogState =
  | {
      type: "confirm";
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      type: "prompt";
      options: PromptOptions;
      resolve: (value: string | null) => void;
    }
  | {
      type: "alert";
      options: AlertOptions;
      resolve: () => void;
    }
  | null;

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  alert: (options: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: "confirm",
        options,
        resolve: (val) => {
          setDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    setInputValue(options.defaultValue || "");
    return new Promise<string | null>((resolve) => {
      setDialog({
        type: "prompt",
        options,
        resolve: (val) => {
          setDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setDialog({
        type: "alert",
        options,
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  }, []);

  // Prevent background scroll when dialog is active
  useEffect(() => {
    if (dialog) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [dialog]);

  // Focus management
  useEffect(() => {
    if (dialog) {
      const timer = setTimeout(() => {
        if (dialog.type === "prompt" && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dialog]);

  // Handle escape key
  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (dialog.type === "confirm") {
          dialog.resolve(false);
        } else if (dialog.type === "prompt") {
          dialog.resolve(null);
        } else if (dialog.type === "alert") {
          dialog.resolve();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (dialog?.type === "confirm") {
        dialog.resolve(false);
      } else if (dialog?.type === "prompt") {
        dialog.resolve(null);
      } else if (dialog?.type === "alert") {
        dialog.resolve();
      }
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/80 ring-1 ring-white/10 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.type === "confirm" && (
              <ConfirmView
                options={dialog.options}
                titleId={titleId}
                descId={descId}
                confirmButtonRef={confirmButtonRef}
                onConfirm={() => dialog.resolve(true)}
                onCancel={() => dialog.resolve(false)}
              />
            )}
            {dialog.type === "prompt" && (
              <PromptView
                options={dialog.options}
                value={inputValue}
                onChange={setInputValue}
                titleId={titleId}
                descId={descId}
                inputRef={inputRef}
                confirmButtonRef={confirmButtonRef}
                onSubmit={() => dialog.resolve(inputValue)}
                onCancel={() => dialog.resolve(null)}
              />
            )}
            {dialog.type === "alert" && (
              <AlertView
                options={dialog.options}
                titleId={titleId}
                descId={descId}
                confirmButtonRef={confirmButtonRef}
                onDismiss={() => dialog.resolve()}
              />
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function getVariantIcon(variant: DialogVariant | undefined, isDestructive?: boolean) {
  if (isDestructive || variant === "danger" || variant === "error") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <AlertCircle className="h-5 w-5" />
      </div>
    );
  }
  if (variant === "warning") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
    );
  }
  if (variant === "success") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
      <Info className="h-5 w-5" />
    </div>
  );
}

function ConfirmView({
  options,
  titleId,
  descId,
  confirmButtonRef,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  titleId: string;
  descId: string;
  confirmButtonRef: React.RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = options.isDestructive || options.variant === "danger";
  const isWarning = options.variant === "warning";

  return (
    <div>
      <div className="flex items-start gap-4">
        {getVariantIcon(options.variant, options.isDestructive)}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-lg font-semibold text-white">
            {options.title}
          </h3>
          {options.description && (
            <div id={descId} className="mt-2 text-sm leading-relaxed text-zinc-400">
              {options.description}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap-reverse items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white sm:w-auto"
        >
          {options.cancelText || "Cancel"}
        </button>
        <button
          ref={confirmButtonRef}
          type="button"
          onClick={onConfirm}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg transition sm:w-auto ${
            isDanger
              ? "bg-red-600 hover:bg-red-500 shadow-red-950/40 focus:ring-2 focus:ring-red-500"
              : isWarning
              ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/40 focus:ring-2 focus:ring-amber-500"
              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/40 focus:ring-2 focus:ring-indigo-500"
          }`}
        >
          {options.confirmText || "Confirm"}
        </button>
      </div>
    </div>
  );
}

function PromptView({
  options,
  value,
  onChange,
  titleId,
  descId,
  inputRef,
  confirmButtonRef,
  onSubmit,
  onCancel,
}: {
  options: PromptOptions;
  value: string;
  onChange: (val: string) => void;
  titleId: string;
  descId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  confirmButtonRef: React.RefObject<HTMLButtonElement | null>;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const isDanger = options.variant === "danger";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div>
      <div className="flex items-start gap-4">
        {getVariantIcon(options.variant)}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-lg font-semibold text-white">
            {options.title}
          </h3>
          {options.description && (
            <div id={descId} className="mt-1 text-sm leading-relaxed text-zinc-400">
              {options.description}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          type={options.inputType || "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={options.placeholder}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-6 flex flex-wrap-reverse items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white sm:w-auto"
        >
          {options.cancelText || "Cancel"}
        </button>
        <button
          ref={confirmButtonRef}
          type="button"
          onClick={onSubmit}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg transition sm:w-auto ${
            isDanger
              ? "bg-red-600 hover:bg-red-500 shadow-red-950/40 focus:ring-2 focus:ring-red-500"
              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/40 focus:ring-2 focus:ring-indigo-500"
          }`}
        >
          {options.confirmText || "Submit"}
        </button>
      </div>
    </div>
  );
}

function AlertView({
  options,
  titleId,
  descId,
  confirmButtonRef,
  onDismiss,
}: {
  options: AlertOptions;
  titleId: string;
  descId: string;
  confirmButtonRef: React.RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
}) {
  return (
    <div>
      <div className="flex items-start gap-4">
        {getVariantIcon(options.variant)}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-lg font-semibold text-white">
            {options.title}
          </h3>
          {options.description && (
            <div id={descId} className="mt-2 text-sm leading-relaxed text-zinc-400">
              {options.description}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          ref={confirmButtonRef}
          type="button"
          onClick={onDismiss}
          className="w-full rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-auto"
        >
          {options.confirmText || "Dismiss"}
        </button>
      </div>
    </div>
  );
}
