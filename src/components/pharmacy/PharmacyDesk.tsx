import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { pharmacyService } from "@/services/pharmacyService";
import type { PharmacyProduct } from "@/types";
import { toast } from "sonner";

interface PharmacyDeskProps {
  products: PharmacyProduct[];
  currency: string;
  permissions: string[];
  onChanged: () => Promise<void>;
}

export function PharmacyDesk({ products, currency, permissions, onChanged }: PharmacyDeskProps) {
  const canApprove = permissions.includes("pharmacy.purchase.approve");
  const canFinance = permissions.includes("pharmacy.reports.financial");
  const [requests, setRequests] = useState<Array<{ id: string; number: string; status: string; lines: Array<{ productName: string; quantity: number }> }>>([]);
  const [movements, setMovements] = useState<Array<{ id: string; type: string; quantity: number; status: string; quantityBefore: number; quantityAfter: number }>>([]);
  const [finance, setFinance] = useState<{ stockValue: number; paid: number; engaged: number; remaining: number; unpaidInvoices: number; salesTotal: number; alert: string } | null>(null);
  const [sale, setSale] = useState({ productId: "", quantity: 1, settlement: "paid" });

  const load = async () => {
    try {
      const [requestRows, movementRows] = await Promise.all([
        pharmacyService.getRequests(),
        pharmacyService.getMovements(),
      ]);
      setRequests(requestRows);
      setMovements(movementRows);
      if (canFinance) setFinance(await pharmacyService.getFinance());
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  useEffect(() => {
    void load();
  }, [canFinance]);

  const sell = async () => {
    if (!sale.productId || sale.quantity < 1) {
      toast.error("Choisissez un produit et une quantité");
      return;
    }
    try {
      const created = await pharmacyService.createSale({
        kind: sale.settlement === "internal" ? "ward" : "counter",
        settlement: sale.settlement as "paid" | "internal",
        paymentMethod: sale.settlement === "paid" ? "cash" : undefined,
        idempotencyKey: `ui-${Date.now()}`,
        lines: [{ productId: sale.productId, quantity: sale.quantity }],
      });
      toast.success(`Sortie ${created.number} enregistrée`);
      await onChanged();
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const decide = async (id: string) => {
    try {
      await pharmacyService.decideRequest(id, "approve");
      toast.success("Demande approuvée");
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium">Sortie de stock</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Produit</Label>
              <Select value={sale.productId} onValueChange={(productId) => setSale({ ...sale, productId })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name} ({product.quantity})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input type="number" min={1} value={sale.quantity} onChange={(event) => setSale({ ...sale, quantity: parseInt(event.target.value, 10) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={sale.settlement} onValueChange={(settlement) => setSale({ ...sale, settlement })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Vente encaissée</SelectItem>
                  <SelectItem value="internal">Sortie de service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => sell()}>Enregistrer la sortie</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="font-medium">Demandes d'approvisionnement</p>
            {requests.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande.</p>}
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{request.number}</p>
                  <p className="text-muted-foreground">{request.lines.map((line) => `${line.productName} × ${line.quantity}`).join(", ")} · {request.status}</p>
                </div>
                {canApprove && request.status === "submitted" && (
                  <Button size="sm" variant="outline" onClick={() => decide(request.id)}>Approuver</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="font-medium">Derniers mouvements</p>
            {movements.slice(0, 6).map((movement) => (
              <p key={movement.id} className="text-sm text-muted-foreground">
                {movement.type} · {movement.quantity} · {movement.quantityBefore} → {movement.quantityAfter} · {movement.status}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      {canFinance && finance && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Valeur du stock</p><p className="text-xl font-bold">{formatMoney(finance.stockValue, currency)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Dépenses payées</p><p className="text-xl font-bold">{formatMoney(finance.paid, currency)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Budget restant</p><p className="text-xl font-bold">{formatMoney(finance.remaining, currency)}</p></CardContent></Card>
        </div>
      )}
    </div>
  );
}
