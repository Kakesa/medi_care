import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Package, Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pharmacyService, type PharmacyDashboard as DashboardData } from "@/services/pharmacyService";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function dayLabel(value: string) {
  return value.slice(8);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
}

function expiryLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Kinshasa", day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

function Metric({
  label, value, hint, tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "border-border/70 bg-card",
    warning: "border-warning/30 bg-warning/5",
    danger: "border-destructive/30 bg-destructive/5",
    success: "border-success/30 bg-success/5",
  }[tone];
  const valueClass = {
    default: "text-foreground",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  }[tone];
  return (
    <div className={cn("rounded-2xl border px-4 py-4", toneClass)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight", valueClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  title, subtitle, action, children, className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PharmacyDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const canOpenPrescriptions = user?.role === "PHARMACIST";

  useEffect(() => {
    void pharmacyService.getDashboard().then(setData).catch((error) => toast.error(apiMessage(error)));
  }, []);

  if (!data) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card px-5 py-10 text-sm text-muted-foreground">
        Chargement du tableau de bord…
      </div>
    );
  }

  const currency = data.currency;
  const money = (amount: number) => formatMoney(amount, currency);
  const salesTotal = data.salesByDay.reduce((sum, row) => sum + row.count, 0);
  const movementTotal = data.movementsByDay.reduce((sum, row) => sum + row.inbound + row.outbound, 0);
  const alertCount = data.counts.outOfStock + data.counts.belowAlert + data.counts.nearExpiry;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-background to-background">
        <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <div>
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-primary">Vue d’ensemble</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Stock et activité pharmaceutique
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Suivi du stock de l’établissement, des ordonnances à préparer et des mouvements du jour.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 text-primary" />
                  Valeur du stock
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {money(data.counts.stockValue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.counts.available} produit{data.counts.available > 1 ? "s" : ""} disponible{data.counts.available > 1 ? "s" : ""} · {data.counts.medications} médicament{data.counts.medications > 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4 text-primary" />
                  À traiter aujourd’hui
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {data.counts.pendingPrescriptions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ordonnance{data.counts.pendingPrescriptions > 1 ? "s" : ""} en attente · {data.counts.dispensesToday} délivrance{data.counts.dispensesToday > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/dashboard/pharmacy/produits">Voir les produits</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard/pharmacy/commandes">Commandes</Link>
              </Button>
              {canOpenPrescriptions && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/pharmacie-ordonnances">Ordonnances</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 content-start">
            <Metric
              label="Ruptures"
              value={String(data.counts.outOfStock)}
              tone={data.counts.outOfStock > 0 ? "danger" : "default"}
            />
            <Metric
              label="Sous le seuil"
              value={String(data.counts.belowAlert)}
              tone={data.counts.belowAlert > 0 ? "warning" : "default"}
            />
            <Metric
              label="Péremption 90 j"
              value={String(data.counts.nearExpiry)}
              tone={data.counts.nearExpiry > 0 ? "warning" : "default"}
            />
            <Metric
              label="Ventes du jour"
              value={String(data.counts.salesToday)}
              hint={data.financial ? money(data.financial.salesTodayAmount) : undefined}
              tone={data.counts.salesToday > 0 ? "success" : "default"}
            />
          </div>
        </div>
      </section>

      {data.financial && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Achats du mois" value={money(data.financial.purchasesMonth)} />
          <Metric label="Dépenses du mois" value={money(data.financial.expensesMonth)} />
          <Metric
            label="Recettes encaissées"
            value={money(data.financial.collectedMonth)}
            hint={`Facturé non encaissé : ${money(data.financial.billedMonth)}`}
            tone="success"
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Ventes sur 14 jours"
          subtitle={salesTotal ? `${salesTotal} vente${salesTotal > 1 ? "s" : ""} sur la période` : "Aucune vente récente"}
        >
          {salesTotal === 0 ? (
            <EmptyChart message="Aucune vente enregistrée sur les 14 derniers jours." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.salesByDay}>
                <defs>
                  <linearGradient id="pharmacySales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} className="text-xs" axisLine={false} tickLine={false} width={28} />
                <Tooltip labelFormatter={(label) => String(label)} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#pharmacySales)" name="Ventes" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Médicaments les plus vendus" subtitle="30 derniers jours">
          {data.topProducts.length === 0 ? (
            <EmptyChart message="Aucune vente sur les 30 derniers jours." />
          ) : (
            <div className="space-y-3">
              {data.topProducts.slice(0, 6).map((item, index) => {
                const max = data.topProducts[0]?.quantity || 1;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                        {item.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{item.quantity}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (item.quantity / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Mouvements de stock"
          subtitle={movementTotal ? "Entrées et sorties sur 14 jours" : "Aucun mouvement récent"}
        >
          {movementTotal === 0 ? (
            <EmptyChart message="Aucun mouvement de stock sur les 14 derniers jours." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.movementsByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} className="text-xs" axisLine={false} tickLine={false} width={28} />
                <Tooltip />
                <Legend />
                <Bar dataKey="inbound" fill="hsl(var(--primary))" name="Entrées" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="hsl(var(--destructive))" name="Sorties" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Évolution de la valeur du stock" subtitle="Estimation sur 14 jours">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.stockValueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" axisLine={false} tickLine={false} />
              <YAxis className="text-xs" axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" name="Valeur" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {data.financial && (
        <Panel
          title="Encaissements, achats et dépenses"
          subtitle="Les encaissements sont les ventes déjà réglées. Le facturé non encaissé n’est pas additionné ici."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.financial.financeByMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} className="text-xs" axisLine={false} tickLine={false} />
              <YAxis className="text-xs" axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="collected" stroke="hsl(var(--primary))" name="Encaissements" strokeWidth={2} />
              <Line type="monotone" dataKey="purchases" stroke="hsl(var(--warning))" name="Achats" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" name="Dépenses" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel
        title="Alertes stock"
        subtitle={alertCount ? `${alertCount} point${alertCount > 1 ? "s" : ""} d’attention` : "Aucune alerte active"}
        action={(
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/pharmacy/produits">Catalogue</Link>
          </Button>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Ruptures
            </div>
            {data.alerts.outOfStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit en rupture.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.outOfStock.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{item.name}</span>
                    <Badge variant="destructive">Rupture</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ArrowDownRight className="h-4 w-4 text-warning" />
              Sous le seuil
            </div>
            {data.alerts.belowAlert.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit sous le seuil.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.belowAlert.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">{item.quantity}/{item.threshold}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ArrowUpRight className="h-4 w-4 text-warning" />
              Péremption proche
            </div>
            {data.alerts.nearExpiry.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun lot dans les 90 jours.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.nearExpiry.map((item) => (
                  <li key={`${item.name}-${item.lotNumber}`} className="text-sm">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Lot {item.lotNumber} · {expiryLabel(item.expiresAt)} · {item.quantityRemaining}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
