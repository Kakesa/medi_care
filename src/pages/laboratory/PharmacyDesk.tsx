import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { pharmacyService } from "@/services/pharmacyService";
import { pharmacyStatusLabels, prescriptionService, type PrescriptionRecord } from "@/services/prescriptionService";
import type { PharmacyProduct } from "@/types";

export default function PharmacyDesk() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PrescriptionRecord[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<Record<string, { productId: string; quantity: string; note: string }>>({});

  const load = async () => {
    try {
      const [prescriptions, stock] = await Promise.all([
        prescriptionService.list(),
        pharmacyService.getProducts({ limit: 100 }),
      ]);
      setRows(prescriptions);
      setProducts(stock.data);
    } catch (error) {
      toast({ variant: "destructive", title: "Pharmacie indisponible", description: apiMessage(error) });
    }
  };

  useEffect(() => { void load(); }, []);

  const choice = (key: string) => choices[key] || { productId: "", quantity: "1", note: "" };
  const setChoice = (key: string, patch: Partial<{ productId: string; quantity: string; note: string }>) => {
    setChoices((current) => ({ ...current, [key]: { ...choice(key), ...patch } }));
  };

  const run = async (action: () => Promise<unknown>, title: string) => {
    try {
      await action();
      await load();
      toast({ title });
    } catch (error) {
      toast({ variant: "destructive", title: "Action impossible", description: apiMessage(error) });
    }
  };

  const visible = rows.filter((row) => row.patientName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ordonnances à délivrer</h1>
        <p className="mt-1 text-muted-foreground">Seules les ordonnances validées arrivent ici. Le stock baisse à chaque délivrance.</p>
      </div>
      <Input value={query} placeholder="Rechercher un patient" onChange={(event) => setQuery(event.target.value)} />
      <div className="space-y-3">
        {visible.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{row.patientName}</p>
                  <p className="text-sm text-muted-foreground">{row.prescriberName}</p>
                </div>
                <Badge>{pharmacyStatusLabels[row.pharmacyStatus]}</Badge>
              </div>
              {row.pharmacyStatus === "new" && <Button size="sm" onClick={() => run(() => prescriptionService.prepare(row.id), "Préparation commencée")}>Préparer</Button>}
              {row.items.map((line, index) => {
                const key = `${row.id}-${index}`;
                const selected = products.find((product) => product.id === choice(key).productId);
                return (
                  <div key={line.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{line.medication} · {line.dosage}</p>
                    <p className="text-muted-foreground">{line.posology} · {line.duration} · {line.instructions}</p>
                    <p>Prescrit {line.quantityPrescribed} · délivré {line.quantityDispensed}{line.unavailable ? ` · indisponible : ${line.unavailableNote}` : ""}</p>
                    {selected && <p>Stock actuel : {selected.quantity} {selected.unit}</p>}
                    {!line.unavailable && line.quantityDispensed < line.quantityPrescribed && row.pharmacyStatus !== "closed" && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <Select value={choice(key).productId} onValueChange={(productId) => setChoice(key, { productId })}>
                          <SelectTrigger><SelectValue placeholder="Produit en stock" /></SelectTrigger>
                          <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name} ({product.quantity})</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min={1} value={choice(key).quantity} onChange={(event) => setChoice(key, { quantity: event.target.value })} />
                        <Button size="sm" disabled={!choice(key).productId} onClick={() => run(() => prescriptionService.dispense(row.id, { itemIndex: index, productId: choice(key).productId, quantity: Number(choice(key).quantity) }), "Médicament délivré")}>Délivrer</Button>
                        <Input placeholder="Motif d'indisponibilité" value={choice(key).note} onChange={(event) => setChoice(key, { note: event.target.value })} />
                        <Button size="sm" variant="outline" className="sm:col-span-4" onClick={() => run(() => prescriptionService.unavailable(row.id, { itemIndex: index, note: choice(key).note }), "Indisponibilité signalée")}>Signaler indisponible</Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {row.pharmacyStatus === "delivered" && <Button size="sm" variant="outline" onClick={() => run(() => prescriptionService.close(row.id), "Ordonnance clôturée")}>Clôturer</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
