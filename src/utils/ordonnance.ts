import jsPDF from "jspdf";

export type OrdonnanceLine = {
  medication: string;
  dosage: string;
  form: string;
  times: string;
  period: string;
  duration: string;
  route: string;
  quantity: string;
  instructions: string;
};

export type OrdonnanceSheet = {
  organization: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    city?: string;
    commune?: string;
    logo?: string;
    stamp?: string;
  };
  patientName: string;
  age: string;
  sex: string;
  recordNumber: string;
  date: string;
  doctorName: string;
  speciality?: string;
  lines: OrdonnanceLine[];
  recommendations: string;
};

export const periodOptions = ["jour", "matin", "soir", "8 h", "12 h"] as const;

export function blankLine(): OrdonnanceLine {
  return { medication: "", dosage: "", form: "", times: "", period: "jour", duration: "", route: "", quantity: "", instructions: "" };
}

export function rhythmOf(line: OrdonnanceLine) {
  if (!line.times.trim()) return "";
  return `${line.times.trim()} ${line.form} / ${line.period}`;
}

export function sentenceOf(line: OrdonnanceLine) {
  if (!line.times.trim() && !line.form.trim() && !line.duration.trim()) {
    return line.dosage.trim() ? `${line.dosage.trim()}/j` : "";
  }
  const rhythm = rhythmOf(line);
  const head = [line.dosage.trim(), rhythm ? `par ${rhythm}` : ""].filter(Boolean).join(" ");
  const duration = line.duration.trim() ? `pendant ${line.duration.trim()}` : "";
  return [head, duration].filter(Boolean).join(" ");
}

export function extraOf(line: OrdonnanceLine) {
  return [
    line.route.trim() ? `Voie ${line.route.trim()}` : "",
    line.quantity.trim() ? `Quantité ${line.quantity.trim()}` : "",
    line.instructions.trim(),
  ].filter(Boolean).join(" · ");
}

export function prescriptionText(lines: OrdonnanceLine[]) {
  return lines
    .filter((line) => line.medication.trim())
    .map((line) => `R/ ${line.medication.trim()}\nS/ ${sentenceOf(line) || "—"}`)
    .join("\n");
}

export function linesFromText(text?: string): OrdonnanceLine[] {
  const source = text?.trim();
  if (!source) return [blankLine()];
  if (!source.includes("R/")) {
    return [{ ...blankLine(), medication: source }];
  }
  const chunks = source.split(/\n(?=R\/)/).map((chunk) => chunk.trim()).filter(Boolean);
  const lines = chunks.map((chunk) => {
    const [first, ...rest] = chunk.split("\n");
    const medication = first.replace(/^R\/\s*/, "").trim();
    const sentence = rest.join(" ").replace(/^S\/\s*/, "").trim().replace(/\/j$/, "");
    return { ...blankLine(), medication, dosage: sentence };
  });
  return lines.length ? lines : [blankLine()];
}

export function lineFromItem(item: { medication: string; dosage: string; posology: string; form?: string; frequency?: string; duration: string; administrationRoute?: string; quantityPrescribed?: number; instructions?: string }): OrdonnanceLine {
  const fromDosage = item.dosage && item.dosage !== "Selon prescription" ? item.dosage.replace(/\/j$/, "") : "";
  const fromPosology = item.posology && item.posology !== "Selon prescription" ? item.posology.replace(/\/j$/, "") : "";
  return {
    ...blankLine(),
    medication: item.medication,
    dosage: fromDosage || fromPosology,
    route: item.administrationRoute || "",
    quantity: item.quantityPrescribed ? String(item.quantityPrescribed) : "",
    instructions: item.instructions || "",
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filledLines(sheet: OrdonnanceSheet) {
  return sheet.lines.filter((line) => line.medication.trim());
}

function paperHtml(sheet: OrdonnanceSheet) {
  const lines = filledLines(sheet);
  const place = [sheet.organization.city, sheet.organization.commune].filter(Boolean).join(", ");
  const contact = [sheet.organization.address, place, sheet.organization.phone ? `Tél : ${sheet.organization.phone}` : "", sheet.organization.email].filter(Boolean);
  const rows = lines.map((line) => `
    <p class="rx"><strong>R/</strong> ${escapeHtml(line.medication.trim())}</p>
    <p class="sig"><strong>S/</strong> ${escapeHtml(sentenceOf(line) || "—")}</p>
    ${extraOf(line) ? `<p class="extra">${escapeHtml(extraOf(line))}</p>` : ""}
  `).join("");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Ordonnance médicale</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; font-family: "Times New Roman", Times, serif; font-size: 13px; }
  header { text-align: center; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 16px; }
  img.logo, img.stamp { object-fit: contain; }
  img.logo { width: 64px; height: 64px; }
  h1 { margin: 4px 0 0; font-size: 16px; letter-spacing: 0.04em; }
  .contact { margin: 2px 0; font-size: 12px; }
  h2 { margin: 14px 0 10px; font-size: 20px; letter-spacing: 0.08em; text-decoration: underline; }
  .intro { margin: 0 0 12px; line-height: 1.45; }
  .rx { margin: 10px 0 0; font-size: 15px; }
  .sig { margin: 0 0 0 18px; }
  .extra { margin: 0 0 8px 18px; font-size: 12px; }
  .notes { margin-top: 14px; }
  footer { margin-top: 28px; display: flex; justify-content: flex-end; }
  .sign { width: 220px; text-align: center; }
  .line { margin-top: 36px; border-top: 1px solid #111; }
  img.stamp { width: 90px; height: 90px; margin-top: 8px; }
</style>
</head>
<body>
  <header>
    <div class="brand">
      ${sheet.organization.logo ? `<img class="logo" src="${escapeHtml(sheet.organization.logo)}" alt="" />` : ""}
      <div>
        <h1>${escapeHtml(sheet.organization.name || "Établissement")}</h1>
        ${contact.map((line) => `<p class="contact">${escapeHtml(line)}</p>`).join("")}
      </div>
    </div>
    <h2>ORDONNANCE MÉDICALE</h2>
  </header>
  <p class="intro">Le médecin prie le pharmacien de bien vouloir délivrer les médicaments ci-après à <strong>${escapeHtml(sheet.patientName)}</strong>, ${escapeHtml(sheet.sex)}, âgé(e) de ${escapeHtml(sheet.age)}, dossier n° ${escapeHtml(sheet.recordNumber)}.</p>
  <p class="intro">Date de consultation : ${escapeHtml(sheet.date)} · Médecin : ${escapeHtml(sheet.doctorName)}${sheet.speciality ? ` · ${escapeHtml(sheet.speciality)}` : ""}</p>
  ${rows || "<p>Aucun médicament.</p>"}
  ${sheet.recommendations.trim() ? `<div class="notes"><strong>Recommandations</strong><p>${escapeHtml(sheet.recommendations.trim())}</p></div>` : ""}
  <footer>
    <div class="sign">
      <p>Fait le ${escapeHtml(sheet.date)}</p>
      <p>${escapeHtml(sheet.doctorName)}</p>
      <div class="line">Signature</div>
      ${sheet.organization.stamp ? `<img class="stamp" src="${escapeHtml(sheet.organization.stamp)}" alt="" />` : `<p class="extra">Cachet</p>`}
    </div>
  </footer>
</body>
</html>`;
}

export function printOrdonnance(sheet: OrdonnanceSheet) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=1000");
  if (!popup) return false;
  popup.document.write(paperHtml(sheet));
  popup.document.close();
  popup.focus();
  popup.onload = () => popup.print();
  window.setTimeout(() => popup.print(), 300);
  return true;
}

export function downloadOrdonnance(sheet: OrdonnanceSheet) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const left = 16;
  const right = pageWidth - 16;
  let y = 16;

  const next = (height: number) => {
    if (y + height <= 282) return;
    doc.addPage();
    y = 16;
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.text(`${sheet.organization.name} · ${sheet.patientName}`, left, y);
    y = 24;
  };

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(sheet.organization.name || "Établissement", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const place = [sheet.organization.address, sheet.organization.city, sheet.organization.phone ? `Tél : ${sheet.organization.phone}` : "", sheet.organization.email].filter(Boolean);
  for (const line of place) {
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += 4.5;
  }
  y += 3;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("ORDONNANCE MÉDICALE", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const intro = doc.splitTextToSize(`Le médecin prie le pharmacien de bien vouloir délivrer les médicaments ci-après à ${sheet.patientName}, ${sheet.sex}, âgé(e) de ${sheet.age}, dossier n° ${sheet.recordNumber}.`, right - left);
  next(intro.length * 5);
  doc.text(intro, left, y);
  y += intro.length * 5 + 2;
  doc.text(`Date de consultation : ${sheet.date} · Médecin : ${sheet.doctorName}${sheet.speciality ? ` · ${sheet.speciality}` : ""}`, left, y);
  y += 8;

  for (const line of filledLines(sheet)) {
    next(18);
    doc.setFont("times", "bold");
    doc.text(`R/  ${line.medication.trim()}`, left, y);
    y += 5.5;
    doc.setFont("times", "normal");
    const sentence = doc.splitTextToSize(`S/  ${sentenceOf(line) || "—"}`, right - left - 8);
    doc.text(sentence, left + 6, y);
    y += sentence.length * 5;
    const extra = extraOf(line);
    if (extra) {
      const extraLines = doc.splitTextToSize(extra, right - left - 8);
      doc.setFontSize(10);
      doc.text(extraLines, left + 6, y);
      y += extraLines.length * 4.5;
      doc.setFontSize(11);
    }
    y += 3;
  }

  if (sheet.recommendations.trim()) {
    next(16);
    doc.setFont("times", "bold");
    doc.text("Recommandations", left, y);
    y += 5;
    doc.setFont("times", "normal");
    const notes = doc.splitTextToSize(sheet.recommendations.trim(), right - left);
    next(notes.length * 5);
    doc.text(notes, left, y);
    y += notes.length * 5 + 4;
  }

  next(36);
  doc.text(`Fait le ${sheet.date}`, right, y, { align: "right" });
  y += 5;
  doc.text(sheet.doctorName, right, y, { align: "right" });
  y += 16;
  doc.text("Signature et cachet", right, y, { align: "right" });

  const slug = sheet.patientName.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "patient";
  doc.save(`ordonnance-${slug}.pdf`);
}
