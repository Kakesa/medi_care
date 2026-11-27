import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blankLine, downloadOrdonnance, printOrdonnance, type OrdonnanceLine, type OrdonnanceSheet } from "@/utils/ordonnance";
import {
  prescriptionService,
  type PharmacyAbbreviationItem,
  type PrescriptionParsePreview,
} from "@/services/prescriptionService";
import { cn } from "@/lib/utils";

const field = "h-9 min-w-0 flex-1 border-0 border-b border-dotted border-foreground/40 bg-transparent px-1 shadow-none focus-visible:ring-0 rounded-none";

type Props = {
  lines: OrdonnanceLine[];
  recommendations: string;
  sheet: Omit<OrdonnanceSheet, "lines" | "recommendations">;
  onLines: (lines: OrdonnanceLine[]) => void;
  onRecommendations: (value: string) => void;
  readOnly?: boolean;
};

function previewLabel(parsed: PrescriptionParsePreview) {
  const parts = [
    parsed.medicationName ? `Médicament : ${parsed.medicationName}` : "",
    parsed.dosage.amount != null ? `Dosage : ${parsed.dosage.amount} ${parsed.dosage.unit}` : "",
    parsed.form ? `Forme : ${parsed.form}` : "",
    parsed.quantityProposed != null ? `Qté : ${parsed.quantityProposed}` : "",
    parsed.dosePerDay != null ? `Posologie : ${parsed.dosePerDay}/j` : "",
    parsed.durationDays != null ? `Durée : ${parsed.durationDays} j` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function applyParseToLine(line: OrdonnanceLine, parsed: PrescriptionParsePreview): OrdonnanceLine {
  return {
    ...line,
    form: line.form.trim() || parsed.formUnit || parsed.form || "",
    quantity: line.quantity.trim() || (parsed.quantityProposed != null ? String(parsed.quantityProposed) : ""),
    duration: line.duration.trim() || (parsed.durationDays != null ? `${parsed.durationDays} j` : ""),
    instructions: line.instructions.trim() || parsed.instructions || "",
  };
}

export default function OrdonnanceEditor({ lines, recommendations, sheet, onLines, onRecommendations, readOnly }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [abbrevQuery, setAbbrevQuery] = useState("");
  const [abbreviations, setAbbreviations] = useState<PharmacyAbbreviationItem[]>([]);
  const [previews, setPreviews] = useState<Record<number, PrescriptionParsePreview | null>>({});

  useEffect(() => {
    let cancelled = false;
    void prescriptionService.listAbbreviations().then((result) => {
      if (!cancelled) setAbbreviations(result.items || []);
    }).catch(() => {
      if (!cancelled) setAbbreviations([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    lines.forEach((line, index) => {
      if (!line.medication.trim() && !line.dosage.trim()) {
        timers.push(setTimeout(() => {
          setPreviews((current) => ({ ...current, [index]: null }));
        }, 0));
        return;
      }
      const timer = setTimeout(() => {
        void prescriptionService.parseLine({
          medication: line.medication,
          dosage: line.dosage,
          duration: line.duration,
          instructions: line.instructions,
          quantityPrescribed: Number(line.quantity) || undefined,
        }).then((result) => {
          setPreviews((current) => ({ ...current, [index]: result.parsed }));
          const parsed = result.parsed;
          if (!parsed) return;
          const next = applyParseToLine(line, parsed);
          if (
            next.form !== line.form
            || next.quantity !== line.quantity
            || next.duration !== line.duration
            || next.instructions !== line.instructions
          ) {
            onLines(lines.map((row, current) => (current === index ? next : row)));
          }
        }).catch(() => {
          setPreviews((current) => ({ ...current, [index]: null }));
        });
      }, 450);
      timers.push(timer);
    });
    return () => { timers.forEach((timer) => clearTimeout(timer)); };
    // Intentionally depend on medication/dosage text only to avoid loops when we patch form/qty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((line) => `${line.medication}|${line.dosage}`).join("||"), readOnly]);

  const update = (index: number, patch: Partial<OrdonnanceLine>) => {
    onLines(lines.map((line, current) => (current === index ? { ...line, ...patch } : line)));
  };

  const documentSheet = (): OrdonnanceSheet => ({ ...sheet, lines, recommendations });

  const visibleAbbrevs = useMemo(() => {
    const needle = abbrevQuery.trim().toLowerCase();
    const rows = abbreviations.filter((item) => item.kind === "form" || item.kind === "frequency" || item.kind === "duration" || item.kind === "marker");
    if (!needle) return rows;
    return rows.filter((item) =>
      item.code.includes(needle)
      || item.meaning.toLowerCase().includes(needle)
      || item.variants.some((variant) => variant.toLowerCase().includes(needle)),
    );
  }, [abbreviations, abbrevQuery]);

  const quickHelp = useMemo(() => {
    const preferred = ["ce", "ces", "amp", "amps", "fl", "inj", "cr", "pomm", "per_j", "h", "j", "dr"];
    const byCode = new Map(abbreviations.map((item) => [item.code, item]));
    return preferred.map((code) => byCode.get(code)).filter(Boolean) as PharmacyAbbreviationItem[];
  }, [abbreviations]);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Prescription médicale</p>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setHelpOpen((open) => !open)}>
            <BookOpen className="mr-1 h-3.5 w-3.5" />
            Abréviations
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", helpOpen && "rotate-180")} />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => printOrdonnance(documentSheet())}>
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => downloadOrdonnance(documentSheet())}>PDF</Button>
        </div>
      </div>

      {helpOpen && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Abréviations disponibles</p>
          <div className="flex flex-wrap gap-1.5">
            {quickHelp.map((item) => (
              <span key={item.code} className="rounded-md border bg-background px-2 py-1 text-[11px]">
                <span className="font-semibold">{item.variants[0] || item.code}</span>
                <span className="text-muted-foreground"> = {item.meaning}</span>
              </span>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={abbrevQuery}
              onChange={(event) => setAbbrevQuery(event.target.value)}
              placeholder="Rechercher une abréviation…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-36 overflow-auto rounded-md border bg-background">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Abréviation</th>
                  <th className="px-2 py-1.5 font-medium">Signification</th>
                  <th className="px-2 py-1.5 font-medium">Unité</th>
                </tr>
              </thead>
              <tbody>
                {visibleAbbrevs.map((item) => (
                  <tr key={item.code} className="border-t">
                    <td className="px-2 py-1 font-medium">{[item.code, ...item.variants].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 3).join(", ")}</td>
                    <td className="px-2 py-1">{item.meaning}</td>
                    <td className="px-2 py-1 text-muted-foreground">{item.unit || "—"}</td>
                  </tr>
                ))}
                {visibleAbbrevs.length === 0 && (
                  <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Aucune abréviation</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Exemples : <code className="rounded bg-muted px-1">Tanzol Cés 400mg DR 2</code> · <code className="rounded bg-muted px-1">1cé /j après 72h</code>
          </p>
        </div>
      )}

      <div className="space-y-2">
        {lines.map((line, index) => {
          const preview = previews[index];
          return (
            <div key={index} className="space-y-1">
              <div className="flex flex-nowrap items-end gap-2">
                <span className="shrink-0 pb-1 font-serif text-lg font-bold leading-none">R/</span>
                <Input
                  value={line.medication}
                  disabled={readOnly}
                  placeholder="Tanzol Cés 400mg DR 2"
                  aria-label="Médicament"
                  className={field}
                  onChange={(event) => update(index, { medication: event.target.value })}
                />
                <span className="shrink-0 pb-1 font-serif text-lg font-bold leading-none">S/</span>
                <Input
                  value={line.dosage}
                  disabled={readOnly}
                  placeholder="1cé /j après 72h"
                  aria-label="Posologie"
                  className={field}
                  onChange={(event) => update(index, { dosage: event.target.value })}
                />
                <span className="shrink-0 pb-1 font-serif text-lg leading-none">/j</span>
                {!readOnly && lines.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onLines(lines.filter((_, current) => current !== index))} aria-label="Retirer le médicament">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {preview && (line.medication.trim() || line.dosage.trim()) && (
                <div className="pl-6 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{previewLabel(preview) || "Analyse en cours…"}</p>
                  {preview.alerts.map((alert) => (
                    <p key={alert.code} className="flex items-start gap-1 text-[11px] text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {alert.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onLines([...lines, blankLine()])}>
          <Plus className="h-4 w-4" />
          Ajouter un médicament
        </Button>
      )}
    </div>
  );
}
