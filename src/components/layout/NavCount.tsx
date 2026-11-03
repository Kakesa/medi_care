import { cn } from "@/lib/utils";

export function NavCount({ count, tone = "light" }: { count?: number; tone?: "light" | "solid" | "alert" }) {
  if (!count) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums",
        tone === "light" && "bg-white text-primary",
        tone === "solid" && "bg-primary text-primary-foreground",
        tone === "alert" && "bg-destructive text-destructive-foreground",
      )}
      aria-label={`${label} en attente`}
    >
      {label}
    </span>
  );
}
