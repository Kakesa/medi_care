import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pharmacyService, type PharmacyDashboard as DashboardData } from "@/services/pharmacyService";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
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
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Kinshasa", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function PharmacyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void pharmacyService.getDashboard().then(setData).catch((error) => toast.error(apiMessage(error)));
  }, []);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Chargement du tableau de bord…</p>;
  }

  const currency = data.currency;
  const money = (amount: number) => formatMoney(amount, currency);
  const cards: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Médicaments", value: String(data.counts.medications) },
    { label: "Produits disponibles", value: String(data.counts.available) },
    { label: "Ruptures", value: String(data.counts.outOfStock) },
    { label: "Sous le seuil", value: String(data.counts.belowAlert) },
    { label: "Péremption proche", value: String(data.counts.nearExpiry), hint: "Dans les 90 jours" },
    { label: "Valeur du stock", value: money(data.counts.stockValue) },
    { label: "Ordonnances en attente", value: String(data.counts.pendingPrescriptions) },
    { label: "Délivrances du jour", value: String(data.counts.dispensesToday) },
    {
      label: "Ventes du jour",
      value: String(data.counts.salesToday),
      hint: data.financial ? money(data.financial.salesTodayAmount) : undefined,
    },
  ];
  if (data.financial) {
    cards.push(
      { label: "Achats du mois", value: money(data.financial.purchasesMonth) },
      { label: "Dépenses du mois", value: money(data.financial.expensesMonth) },
      {
        label: "Recettes encaissées",
        value: money(data.financial.collectedMonth),
        hint: `Facturé : ${money(data.financial.billedMonth)}`,
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="card-elevated">
            <CardContent className="pt-5">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader><CardTitle>Ventes sur 14 jours</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.salesByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip labelFormatter={(label) => String(label)} />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Ventes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Médicaments les plus vendus</CardTitle></CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur les 30 derniers jours.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={110} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Quantité" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Mouvements de stock</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.movementsByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="inbound" fill="hsl(var(--primary))" name="Entrées" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="hsl(var(--destructive))" name="Sorties" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Valeur du stock</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.stockValueByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={dayLabel} className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" name="Valeur" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        {data.financial && (
          <Card className="card-elevated lg:col-span-2">
            <CardHeader>
              <CardTitle>Encaissements, achats et dépenses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.financial.financeByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="collected" stroke="hsl(var(--primary))" name="Encaissements" />
                  <Line type="monotone" dataKey="purchases" stroke="hsl(var(--warning))" name="Achats" />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" name="Dépenses" />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground">
                Les encaissements sont les ventes réglées. Le montant facturé et pas encore encaissé n’est pas additionné ici.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-elevated">
          <CardHeader><CardTitle>Ruptures</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.alerts.outOfStock.length === 0 && <p className="text-muted-foreground">Aucun produit en rupture.</p>}
            {data.alerts.outOfStock.map((item) => <p key={item.id}>{item.name}</p>)}
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Sous le seuil d’alerte</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.alerts.belowAlert.length === 0 && <p className="text-muted-foreground">Aucun produit sous le seuil.</p>}
            {data.alerts.belowAlert.map((item) => (
              <p key={item.id}>{item.name} · {item.quantity} / {item.threshold}</p>
            ))}
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Lots à échéance proche</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.alerts.nearExpiry.length === 0 && <p className="text-muted-foreground">Aucun lot dans les 90 jours.</p>}
            {data.alerts.nearExpiry.map((item) => (
              <p key={`${item.name}-${item.lotNumber}`}>{item.name} · {item.lotNumber} · {expiryLabel(item.expiresAt)}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
