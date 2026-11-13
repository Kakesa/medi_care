import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
}

const cardTones = [
  {
    match: "destructive",
    card: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50",
    icon: "bg-red-600 text-white",
    value: "text-red-700 dark:text-red-200",
  },
  {
    match: "success",
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50",
    icon: "bg-emerald-600 text-white",
    value: "text-emerald-800 dark:text-emerald-200",
  },
  {
    match: "warning",
    card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    icon: "bg-amber-500 text-amber-950",
    value: "text-amber-800 dark:text-amber-200",
  },
  {
    match: "info",
    card: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/50",
    icon: "bg-sky-600 text-white",
    value: "text-sky-800 dark:text-sky-200",
  },
  {
    match: "primary",
    card: "border-primary/25 bg-primary/10",
    icon: "bg-primary text-primary-foreground",
    value: "text-primary",
  },
];

function toneFor(iconColor: string) {
  return cardTones.find((tone) => iconColor.includes(tone.match)) ?? cardTones[cardTones.length - 1];
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral",
  icon: Icon,
  iconColor = "bg-primary/10 text-primary",
  delay = 0
}: StatCardProps) {
  const tone = toneFor(iconColor);
  return (
    <div 
      className={cn("group animate-slide-up rounded-2xl border p-4 opacity-0 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-5", tone.card)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tone.icon)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground/80">{title}</p>
          <p className={cn("text-3xl font-bold tabular-nums tracking-tight", tone.value)}>{value}</p>
          {change && (
            <div className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              changeType === "positive" && "text-emerald-700 dark:text-emerald-300",
              changeType === "negative" && "text-red-700 dark:text-red-300",
              changeType === "neutral" && "text-foreground/60"
            )}>
              {changeType === "positive" && <TrendingUp className="h-3.5 w-3.5" />}
              {changeType === "negative" && <TrendingDown className="h-3.5 w-3.5" />}
              <span>{change}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}