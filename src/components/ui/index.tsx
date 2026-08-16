"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * The component library.
 *
 * Kept in one module because these are small, tightly related primitives that
 * are almost always imported together; splitting them across twenty files would
 * add friction without adding structure. Anything with real behaviour — the
 * toast host, the modal — lives in its own file.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-ink-soft active:bg-ink disabled:bg-faint shadow-[0_1px_2px_rgb(20_18_15/0.12)]",
  secondary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-200",
  outline:
    "bg-white text-ink border border-line hover:border-ink/30 hover:bg-paper-alt active:bg-line-soft",
  ghost: "bg-transparent text-ink-soft hover:bg-paper-alt hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[8px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-[11px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // `disabled` alone would drop the button from the tab order mid-action;
      // aria-busy keeps it announced while it works.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-70 select-none whitespace-nowrap",
        "active:scale-[0.985]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === "lg" ? 18 : 14} /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx("animate-spin", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, required, children, htmlFor }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft">
          {label}
          {required && <span className="text-brand-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger flex items-start gap-1">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full bg-white border rounded-[10px] px-3 text-sm text-ink placeholder:text-faint " +
  "transition-colors duration-150 disabled:bg-paper-alt disabled:text-muted";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        CONTROL,
        "h-10",
        invalid ? "border-danger focus:border-danger" : "border-line focus:border-ink/40",
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          CONTROL,
          "py-2.5 min-h-[80px] resize-y leading-relaxed",
          invalid ? "border-danger" : "border-line focus:border-ink/40",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cx(CONTROL, "h-10 border-line focus:border-ink/40 cursor-pointer pr-8 appearance-none",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M3 4.5L6 8l3-3.5%22 stroke=%22%2378716c%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>')] bg-no-repeat bg-[right_10px_center]",
          className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

// ---------------------------------------------------------------------------
// Selectable chips — used heavily by the brand wizard
// ---------------------------------------------------------------------------

export function Chip({
  selected,
  onClick,
  children,
  disabled,
  title,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={selected}
      className={cx(
        "px-3.5 h-9 rounded-full text-[13px] font-medium border transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]",
        selected
          ? "bg-ink text-white border-ink"
          : "bg-white text-ink-soft border-line hover:border-ink/30 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  interactive,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cx(
        "bg-white border border-line rounded-[14px] shadow-card",
        interactive && "transition-all duration-200 hover:shadow-lift hover:border-ink/15",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "success" | "warn" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-paper-alt text-muted border-line",
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    success: "bg-success-bg text-success border-success/20",
    warn: "bg-warn-bg text-warn border-warn/20",
    danger: "bg-danger-bg text-danger border-danger/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 h-[22px] rounded-full text-[11.5px] font-medium border",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading states
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6">
      {icon && <div className="mb-4 flex justify-center text-faint">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-[10px]", className)} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export interface Toast {
  id: number;
  tone: "info" | "success" | "error" | "warn";
  message: string;
  detail?: string;
}

interface ToastApi {
  push: (tone: Toast["tone"], message: string, detail?: string) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
  warn: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((tone: Toast["tone"], message: string, detail?: string) => {
    const id = ++counter.current;
    setToasts((current) => [...current, { id, tone, message, detail }]);
    // Errors stay longer — they usually carry something the user must read.
    const ttl = tone === "error" ? 8000 : detail ? 6500 : 4200;
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), ttl);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m, d) => push("success", m, d),
      error: (m, d) => push("error", m, d),
      info: (m, d) => push("info", m, d),
      warn: (m, d) => push("warn", m, d),
    }),
    [push],
  );

  const tones = {
    info: "border-line bg-white",
    success: "border-success/25 bg-success-bg",
    error: "border-danger/25 bg-danger-bg",
    warn: "border-warn/25 bg-warn-bg",
  };
  const marks = { info: "→", success: "✓", error: "✕", warn: "!" };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 pointer-events-none sm:w-[380px]"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            className={cx(
              "pointer-events-auto animate-in-up rounded-[12px] border shadow-pop px-4 py-3 flex gap-2.5",
              tones[toast.tone],
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "font-semibold text-sm leading-5 shrink-0",
                toast.tone === "success" && "text-success",
                toast.tone === "error" && "text-danger",
                toast.tone === "warn" && "text-warn",
                toast.tone === "info" && "text-brand-500",
              )}
            >
              {marks[toast.tone]}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-ink leading-snug">{toast.message}</p>
              {toast.detail && (
                <p className="text-[12.5px] text-muted mt-0.5 leading-snug">{toast.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Prevent the page behind from scrolling under the overlay.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          "relative bg-white w-full rounded-t-[18px] sm:rounded-[16px] shadow-pop animate-pop",
          "max-h-[92vh] overflow-hidden flex flex-col outline-none",
          widths[width],
        )}
      >
        <div className="px-5 pt-5 pb-3 border-b border-line-soft shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-[17px] font-semibold text-ink">
                {title}
              </h2>
              {description && <p className="text-[13px] text-muted mt-1 leading-relaxed">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-faint hover:text-ink transition-colors -mt-1 -mr-1 p-1.5 rounded-lg hover:bg-paper-alt shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {children && <div className="px-5 py-4 overflow-y-auto grow">{children}</div>}
        {footer && (
          <div className="px-5 py-3.5 border-t border-line-soft bg-paper flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx("flex gap-1 p-1 bg-paper-alt rounded-[11px] overflow-x-auto", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            "px-3.5 h-8 rounded-[8px] text-[13px] font-medium transition-all whitespace-nowrap",
            value === tab.value
              ? "bg-white text-ink shadow-[0_1px_2px_rgb(20_18_15/0.07)]"
              : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[11px] text-faint tabular-nums">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx("h-1.5 bg-line-soft rounded-full overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-ink rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Renders trusted server-generated SVG markup. */
export function SvgFrame({
  svg,
  className,
  contain = true,
  label,
}: {
  svg: string;
  className?: string;
  contain?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cx(contain ? "svg-contain" : "svg-fit", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      // The SVG comes from our own render engine, never from user markup — user
      // text is escaped by `esc()` in src/lib/render/svg.ts before it gets here.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <div className={cx("flex items-center gap-3", className)}>
        <div className="h-px bg-line grow" />
        <span className="text-[12px] text-faint uppercase tracking-wider">{label}</span>
        <div className="h-px bg-line grow" />
      </div>
    );
  }
  return <div className={cx("h-px bg-line", className)} />;
}
