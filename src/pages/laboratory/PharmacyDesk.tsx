import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, FileText, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { pharmacyService } from "@/services/pharmacyService";
import {
  pharmacyStatusLabels,
  prescriptionService,
  type PrescriptionItem,
  type PrescriptionRecord,
} from "@/services/prescriptionService";
import type { PharmacyProduct } from "@/types";

type LineChoice = { productId: string; quantity: string; note: string };

type PatientGroup = {
  patientId: string;
  patientName: string;
  prescriptions: PrescriptionRecord[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function guessProduct(products: PharmacyProduct[], medication: string) {
  const needle = normalize(medication);
  if (!needle) return "";
  const exact = products.find((product) => normalize(product.name) === needle);
  if (exact) return exact.id;
  const contains = products.find((product) => {
    const name = normalize(product.name);
    const generic = normalize(product.genericName || "");
    return name.includes(needle) || needle.includes(name) || (generic && (generic.includes(needle) || needle.includes(generic)));
  });
  return contains?.id || "";
}

function lineSentence(line: PrescriptionItem) {
  const parts = [
    line.dosage !== "Selon prescription" ? line.dosage : "",
    line.posology,
    line.frequency,
    line.duration,
    line.administrationRoute,
  ].filter((part) => part && part.trim() && part !== "Selon prescription");
  return parts.join(" · ") || "Selon prescription";
}

function statusTone(status: PrescriptionRecord["pharmacyStatus"]) {
  if (status === "new") return "bg-sky-50 text-sky-900 border-sky-200";
  if (status === "preparing") return "bg-amber-50 text-amber-950 border-amber-200";
  if (status === "partial") return "bg-orange-50 text-orange-950 border-orange-200";
  if (status === "delivered") return "bg-emerald-50 text-emerald-950 border-emerald-200";
  return "bg-muted text-muted-foreground border-border";
}

function lineDone(line: PrescriptionItem) {
  return line.unavailable || line.quantityDispensed >= line.quantityPrescribed;
}

function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: PharmacyProduct[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between px-2 text-xs font-normal"
        >
          <span className="truncate">{selected ? selected.name : "Rechercher un produit…"}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const hay = normalize(itemValue);
            const needle = normalize(search);
            if (!needle) return 1;
            return hay.includes(needle) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Nom du produit…" className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs">Aucun produit trouvé</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.genericName || ""}`}
                  className="text-xs"
                  onSelect={() => {
                    onChange(product.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === product.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">
                    {product.name}
                    <span className="text-muted-foreground"> · {product.quantity} {product.unit}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function summaryStatus(prescriptions: PrescriptionRecord[]) {
  if (prescriptions.some((row) => row.pharmacyStatus === "new")) return "new" as const;
  if (prescriptions.some((row) => row.pharmacyStatus === "preparing")) return "preparing" as const;
  if (prescriptions.some((row) => row.pharmacyStatus === "partial")) return "partial" as const;
  if (prescriptions.some((row) => row.pharmacyStatus === "delivered")) return "delivered" as const;
  return "closed" as const;
}

export default function PharmacyDesk() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<PrescriptionRecord[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, LineChoice>>({});
  const [busyKey, setBusyKey] = useState("");

  const load = async () => {
    try {
      const [prescriptions, stock] = await Promise.all([
        prescriptionService.list(),
        pharmacyService.getProducts({ limit: 100 }),
      ]);
      const open = prescriptions.filter((row) => row.status === "validated" && row.pharmacyStatus !== "closed");
      setRows(open);
      setProducts(stock.data);
      setChoices((current) => {
        const next = { ...current };
        for (const row of open) {
          row.items.forEach((line, index) => {
            const key = `${row.id}-${index}`;
            if (next[key]?.productId) return;
            next[key] = {
              productId: guessProduct(stock.data, line.medication),
              quantity: String(Math.max(1, line.quantityPrescribed - line.quantityDispensed)),
              note: "",
            };
          });
        }
        return next;
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Pharmacie indisponible", description: apiMessage(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const choice = (key: string): LineChoice => choices[key] || { productId: "", quantity: "1", note: "" };
  const setChoice = (key: string, patch: Partial<LineChoice>) => {
    setChoices((current) => ({ ...current, [key]: { ...choice(key), ...patch } }));
  };

  const run = async (key: string, action: () => Promise<unknown>, title: string) => {
    setBusyKey(key);
    try {
      await action();
      await load();
      toast({ title });
    } catch (error) {
      toast({ variant: "destructive", title: "Action impossible", description: apiMessage(error) });
    } finally {
      setBusyKey("");
    }
  };

  const byPatient = useMemo(() => {
    const map = new Map<string, PatientGroup>();
    for (const row of rows) {
      const current = map.get(row.patientId);
      if (current) current.prescriptions.push(row);
      else map.set(row.patientId, { patientId: row.patientId, patientName: row.patientName, prescriptions: [row] });
    }
    return [...map.values()].sort((left, right) => left.patientName.localeCompare(right.patientName, "fr"));
  }, [rows]);

  const visiblePatients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return byPatient;
    return byPatient.filter((group) =>
      group.patientName.toLowerCase().includes(needle)
      || group.prescriptions.some((row) => row.prescriberName.toLowerCase().includes(needle)),
    );
  }, [byPatient, query]);

  const selected = useMemo(
    () => byPatient.find((group) => group.patientId === selectedPatientId) || null,
    [byPatient, selectedPatientId],
  );

  useEffect(() => {
    if (selectedPatientId && !selected) setSelectedPatientId(null);
  }, [selectedPatientId, selected]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordonnances à délivrer</h1>
          <p className="mt-1 text-muted-foreground">
            {selected
              ? `Ordonnance de ${selected.patientName}`
              : "Choisissez un patient pour ouvrir son ordonnance."}
          </p>
        </div>
        {!selected && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="Rechercher un patient"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
      </div>

      {!selected ? (
        visiblePatients.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
            Aucune ordonnance validée en attente de délivrance.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">
              {visiblePatients.length} patient{visiblePatients.length > 1 ? "s" : ""} à servir
            </div>
            <ul className="divide-y divide-border/70">
              {visiblePatients.map((group) => {
                const status = summaryStatus(group.prescriptions);
                const lines = group.prescriptions.reduce((sum, row) => sum + row.items.length, 0);
                const remaining = group.prescriptions.reduce(
                  (sum, row) => sum + row.items.filter((line) => !lineDone(line)).length,
                  0,
                );
                const doctor = group.prescriptions[0]?.prescriberName || "Médecin non précisé";
                return (
                  <li key={group.patientId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedPatientId(group.patientId)}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{group.patientName}</p>
                          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone(status))}>
                            {pharmacyStatusLabels[status]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {doctor} · {group.prescriptions.length} ordonnance{group.prescriptions.length > 1 ? "s" : ""} · {remaining}/{lines} ligne{lines > 1 ? "s" : ""} à délivrer
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : (
        <div className="mx-auto w-full max-w-[42rem] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPatientId(null)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Tous les patients
            </Button>
            <Badge variant="outline">
              {selected.prescriptions.length} ordonnance{selected.prescriptions.length > 1 ? "s" : ""}
            </Badge>
          </div>

          {selected.prescriptions.map((row) => {
            const remaining = row.items.filter((line) => !lineDone(line)).length;
            return (
              <article
                key={row.id}
                className="mx-auto overflow-hidden rounded-xl border border-border/80 bg-[#fcfbf7] text-foreground shadow-sm dark:bg-card"
              >
                <header className="border-b border-border/70 bg-white/70 px-4 py-3 dark:bg-background/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-primary">
                        <FileText className="h-3.5 w-3.5" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Ordonnance médicale</p>
                      </div>
                      <p className="font-serif text-base font-semibold tracking-wide">
                        {user?.organization?.name || "Établissement"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Patient : <span className="font-medium text-foreground">{row.patientName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Médecin : <span className="font-medium text-foreground">{row.prescriberName}</span>
                      </p>
                      {row.validatedAt && (
                        <p className="text-[11px] text-muted-foreground">
                          Validée le {new Intl.DateTimeFormat("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Africa/Kinshasa",
                          }).format(new Date(row.validatedAt))}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone(row.pharmacyStatus))}>
                        {pharmacyStatusLabels[row.pharmacyStatus]}
                      </span>
                      {row.pharmacyStatus === "new" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={busyKey === `prepare-${row.id}`}
                          onClick={() => run(`prepare-${row.id}`, () => prescriptionService.prepare(row.id), "Préparation commencée")}
                        >
                          Préparer
                        </Button>
                      )}
                      {row.pharmacyStatus === "delivered" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={busyKey === `close-${row.id}`}
                          onClick={() => run(`close-${row.id}`, () => prescriptionService.close(row.id), "Ordonnance clôturée")}
                        >
                          Clôturer
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 font-serif text-xs leading-relaxed">
                    Le médecin prie le pharmacien de bien vouloir délivrer les médicaments ci-après à{" "}
                    <strong>{row.patientName}</strong>.
                    {remaining > 0
                      ? ` ${remaining} ligne${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}.`
                      : " Toutes les lignes sont traitées."}
                  </p>
                </header>

                <div className="divide-y divide-border/60 px-4 py-0.5">
                  {row.items.map((line, index) => {
                    const key = `${row.id}-${index}`;
                    const selectedProduct = products.find((product) => product.id === choice(key).productId);
                    const remainingQty = Math.max(0, line.quantityPrescribed - line.quantityDispensed);
                    const done = lineDone(line);
                    return (
                      <div key={line.id} className="grid gap-3 py-2.5 sm:grid-cols-2">
                        <div className="min-w-0 space-y-0.5 font-serif">
                          <p className="text-[13px] leading-snug">
                            <span className="font-bold tracking-wide">R/</span>{" "}
                            <span className="font-semibold">{line.medication}</span>
                            {line.dosage && line.dosage !== "Selon prescription" ? (
                              <span className="text-foreground/80"> — {line.dosage}</span>
                            ) : null}
                          </p>
                          <p className="pl-4 text-xs leading-relaxed text-foreground/85">
                            <span className="font-bold tracking-wide">S/</span> {lineSentence(line)}
                          </p>
                          {line.instructions && line.instructions !== "Selon prescription" && (
                            <p className="pl-4 text-[11px] italic text-muted-foreground">{line.instructions}</p>
                          )}
                          <p className="pl-4 pt-0.5 text-[10px] text-muted-foreground">
                            Prescrit {line.quantityPrescribed} · délivré {line.quantityDispensed}
                            {line.unavailable ? ` · indisponible : ${line.unavailableNote || "sans motif"}` : ""}
                          </p>
                        </div>

                        <div className="min-w-0 rounded-md border border-border/50 bg-white/70 p-2 dark:bg-background/40">
                          {done ? (
                            <div className="flex h-full items-center justify-center py-0.5">
                              <Badge variant={line.unavailable ? "destructive" : "secondary"} className="h-5 px-1.5 text-[10px]">
                                {line.unavailable ? "Indispo." : "Délivré"}
                              </Badge>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <ProductPicker
                                products={products}
                                value={choice(key).productId}
                                onChange={(productId) => setChoice(key, { productId })}
                              />
                              {selectedProduct && (
                                <p className="truncate text-[10px] leading-tight text-muted-foreground">
                                  Stock {selectedProduct.quantity} {selectedProduct.unit}
                                </p>
                              )}
                              <div className="flex gap-1.5">
                                <Input
                                  type="number"
                                  min={1}
                                  max={remainingQty || undefined}
                                  value={choice(key).quantity}
                                  onChange={(event) => setChoice(key, { quantity: event.target.value })}
                                  aria-label="Quantité à délivrer"
                                  className="h-8 w-14 px-1.5 text-center text-xs"
                                />
                                <Button
                                  size="sm"
                                  className="h-8 flex-1 px-2 text-xs"
                                  disabled={!choice(key).productId || busyKey === key}
                                  onClick={() => run(
                                    key,
                                    () => prescriptionService.dispense(row.id, {
                                      itemIndex: index,
                                      productId: choice(key).productId,
                                      quantity: Number(choice(key).quantity),
                                    }),
                                    "Médicament délivré",
                                  )}
                                >
                                  Délivrer
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  placeholder="Motif"
                                  value={choice(key).note}
                                  onChange={(event) => setChoice(key, { note: event.target.value })}
                                  className="h-8 min-w-0 flex-1 px-2 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={busyKey === `u-${key}`}
                                  onClick={() => run(
                                    `u-${key}`,
                                    () => prescriptionService.unavailable(row.id, {
                                      itemIndex: index,
                                      note: choice(key).note || "Produit indisponible",
                                    }),
                                    "Indisponibilité signalée",
                                  )}
                                >
                                  Indispo.
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {row.recommendations?.trim() && (
                  <footer className="border-t border-border/70 bg-white/50 px-4 py-2.5 text-xs dark:bg-background/30">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recommandations</p>
                    <p className="mt-1 whitespace-pre-wrap font-serif">{row.recommendations}</p>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
