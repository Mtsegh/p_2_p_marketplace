import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Labelled select with a hint and an error. Matches TextField/TextArea styling
 * so forms read the same whichever control they use.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, hint, id, className, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ");

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </label>
        <select
          {...props}
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-11 w-full rounded-md border bg-surface px-3 text-sm text-foreground",
            error ? "border-danger" : "border-line",
            className,
          )}
        />
        {hint ? (
          <p id={hintId} className="text-xs text-muted">{hint}</p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
