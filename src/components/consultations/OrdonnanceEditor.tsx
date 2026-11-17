import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blankLine, downloadOrdonnance, printOrdonnance, type OrdonnanceLine, type OrdonnanceSheet } from "@/utils/ordonnance";

const field = "h-9 min-w-0 flex-1 border-0 border-b border-dotted border-foreground/40 bg-transparent px-1 shadow-none focus-visible:ring-0 rounded-none";

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

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex flex-nowrap items-end gap-2">
            <span className="shrink-0 pb-1 font-serif text-lg font-bold leading-none">R/</span>
            <Input
              value={line.medication}
              disabled={readOnly}
              placeholder="............................"
              aria-label="Médicament"
              className={field}
              onChange={(event) => update(index, { medication: event.target.value })}
            />
            <span className="shrink-0 pb-1 font-serif text-lg font-bold leading-none">S/</span>
            <Input
              value={line.dosage}
              disabled={readOnly}
              placeholder="..........................."
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
        ))}
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
