import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blankLine, downloadOrdonnance, extraOf, formOptions, periodOptions, printOrdonnance, sentenceOf, type OrdonnanceLine, type OrdonnanceSheet } from "@/utils/ordonnance";

const field = "h-9 border-0 border-b border-foreground/30 bg-transparent px-1 shadow-none focus-visible:ring-0 rounded-none";

type Props = {
  lines: OrdonnanceLine[];
  recommendations: string;
  sheet: Omit<OrdonnanceSheet, "lines" | "recommendations">;
  onLines: (lines: OrdonnanceLine[]) => void;
  onRecommendations: (value: string) => void;
  readOnly?: boolean;
};

export default function OrdonnanceEditor({ lines, recommendations, sheet, onLines, onRecommendations, readOnly }: Props) {
  const update = (index: number, patch: Partial<OrdonnanceLine>) => {
    onLines(lines.map((line, current) => current === index ? { ...line, ...patch } : line));
  };

  const documentSheet = (): OrdonnanceSheet => ({ ...sheet, lines, recommendations });

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Prescription médicale</p>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => printOrdonnance(documentSheet())}>
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => downloadOrdonnance(documentSheet())}>PDF</Button>
        </div>
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-end gap-2">
              <span className="w-7 shrink-0 pb-1 font-serif text-lg font-bold leading-none">R/</span>
              <Input
                value={line.medication}
                disabled={readOnly}
                placeholder="Nom du médicament"
                className={field}
                onChange={(event) => update(index, { medication: event.target.value })}
              />
              {!readOnly && lines.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onLines(lines.filter((_, current) => current !== index))} aria-label="Retirer le médicament">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1 pl-0 sm:pl-9">
              <span className="w-7 shrink-0 pb-1 font-serif text-lg font-bold leading-none">S/</span>
              <Input value={line.dosage} disabled={readOnly} placeholder="Dosage" className={`${field} w-28`} onChange={(event) => update(index, { dosage: event.target.value })} />
              <span className="pb-1 text-sm">par</span>
              <Input value={line.times} disabled={readOnly} inputMode="numeric" placeholder="2" className={`${field} w-12 text-center`} onChange={(event) => update(index, { times: event.target.value.replace(/[^\d]/g, "").slice(0, 2) })} />
              <select disabled={readOnly} className="h-9 border-0 border-b border-foreground/30 bg-transparent text-sm" value={line.form} onChange={(event) => update(index, { form: event.target.value })}>
                {formOptions.map((form) => <option key={form} value={form}>{form}</option>)}
              </select>
              <span className="pb-1 text-sm">/</span>
              <select disabled={readOnly} className="h-9 border-0 border-b border-foreground/30 bg-transparent text-sm" value={line.period} onChange={(event) => update(index, { period: event.target.value })}>
                {periodOptions.map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
              <span className="pb-1 text-sm">pendant</span>
              <Input value={line.duration} disabled={readOnly} placeholder="7 jours" className={`${field} w-24`} onChange={(event) => update(index, { duration: event.target.value })} />
            </div>
            <p className="pl-9 text-xs text-muted-foreground">S/ {sentenceOf(line) || "dosage par 2 comp / jour"}</p>
            <div className="grid gap-2 pl-0 sm:grid-cols-3 sm:pl-9">
              <Input value={line.route} disabled={readOnly} placeholder="Voie" className="h-8" onChange={(event) => update(index, { route: event.target.value })} />
              <Input value={line.quantity} disabled={readOnly} inputMode="numeric" placeholder="Quantité" className="h-8" onChange={(event) => update(index, { quantity: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })} />
              <Input value={line.instructions} disabled={readOnly} placeholder="Instructions" className="h-8 sm:col-span-1" onChange={(event) => update(index, { instructions: event.target.value })} />
            </div>
            {extraOf(line) ? <p className="pl-9 text-xs text-muted-foreground">{extraOf(line)}</p> : null}
          </div>
        ))}
      </div>

      {!readOnly && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onLines([...lines, blankLine()])}>
          <Plus className="h-4 w-4" />
          Ajouter un médicament
        </Button>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">Recommandations</p>
        <Textarea value={recommendations} disabled={readOnly} rows={2} placeholder="Précautions, conseils, régime..." onChange={(event) => onRecommendations(event.target.value)} />
      </div>
    </div>
  );
}
