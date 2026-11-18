import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const role = tone === "danger" ? "alert" : "status";

  return (
    <div
      role={role}
      className={cn("rounded-md border p-4", toneClasses[tone], className)}
    >
      <p className="text-sm font-semibold">{title}</p>
      {children ? (
        <div className="mt-1 text-sm text-foreground">{children}</div>
      ) : null}
    </div>
  );
}
