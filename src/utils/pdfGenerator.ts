// ============================================
// Générateur de PDF pour factures, rapports et ordonnances
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, Consultation, Exam } from '@/types';

// Configuration du centre médical
const CLINIC_CONFIG = {
  name: 'MediCare - Centre Médical',
  address: '123 Avenue de la Santé, 75001 Paris',
  phone: '01 23 45 67 89',
  email: 'contact@medicare.fr',
  siret: 'SIRET: 123 456 789 00012',
};

// Couleurs
const COLORS = {
  primary: [32, 128, 123] as [number, number, number], // Teal
  secondary: [100, 100, 100] as [number, number, number],
  light: [240, 240, 240] as [number, number, number],
};

// ============ Facture PDF ============

export const generateInvoicePDF = (invoice: Invoice): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(CLINIC_CONFIG.name, 20, 25);

  // Clinic info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(CLINIC_CONFIG.address, pageWidth - 20, 15, { align: 'right' });
  doc.text(CLINIC_CONFIG.phone, pageWidth - 20, 22, { align: 'right' });
  doc.text(CLINIC_CONFIG.email, pageWidth - 20, 29, { align: 'right' });

  // Invoice title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 20, 60);

  // Invoice number and date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${invoice.invoiceNumber}`, 20, 70);
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}`, 20, 77);
  doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`, 20, 84);

  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    pending: [234, 179, 8],
    overdue: [239, 68, 68],
    cancelled: [107, 114, 128],
  };
  const statusLabels: Record<string, string> = {
    paid: 'PAYÉE',
    pending: 'EN ATTENTE',
    overdue: 'EN RETARD',
    cancelled: 'ANNULÉE',
  };
  doc.setFillColor(...(statusColors[invoice.status] || COLORS.secondary));
  doc.roundedRect(pageWidth - 60, 55, 40, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(statusLabels[invoice.status] || invoice.status.toUpperCase(), pageWidth - 40, 63, { align: 'center' });

  // Patient info box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(pageWidth - 100, 70, 80, 35, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT', pageWidth - 95, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.patientName, pageWidth - 95, 88);
  if (invoice.patientAddress) {
    const addressLines = doc.splitTextToSize(invoice.patientAddress, 70);
    doc.text(addressLines, pageWidth - 95, 95);
  }
  if (invoice.patientPhone) {
    doc.text(invoice.patientPhone, pageWidth - 95, 102);
  }

  // Items table
  const tableData = invoice.items.map(item => [
    item.description,
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)} €`,
    `${item.total.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: 115,
    head: [['Description', 'Qté', 'Prix unitaire', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  // Totals
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  const totalsX = pageWidth - 70;

  doc.text('Sous-total:', totalsX, finalY);
  doc.text(`${invoice.subtotal.toFixed(2)} €`, pageWidth - 20, finalY, { align: 'right' });

  if (invoice.tax > 0) {
    doc.text('TVA:', totalsX, finalY + 7);
    doc.text(`${invoice.tax.toFixed(2)} €`, pageWidth - 20, finalY + 7, { align: 'right' });
  }

  if (invoice.discount > 0) {
    doc.text('Remise:', totalsX, finalY + 14);
    doc.text(`-${invoice.discount.toFixed(2)} €`, pageWidth - 20, finalY + 14, { align: 'right' });
  }

  // Total line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 10, finalY + 20, pageWidth - 20, finalY + 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalsX, finalY + 30);
  doc.setTextColor(...COLORS.primary);
  doc.text(`${invoice.total.toFixed(2)} €`, pageWidth - 20, finalY + 30, { align: 'right' });

  // Payment info
  if (invoice.status === 'paid' && invoice.paymentMethod) {
    const paymentLabels: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte bancaire',
      transfer: 'Virement',
      insurance: 'Assurance',
    };
    doc.setTextColor(34, 197, 94);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payé par ${paymentLabels[invoice.paymentMethod]} le ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('fr-FR') : ''}`, 20, finalY + 30);
  }

  // Notes
  if (invoice.notes) {
    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(9);
    doc.text('Notes:', 20, finalY + 45);
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 40);
    doc.text(notesLines, 20, finalY + 52);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(8);
  doc.text(CLINIC_CONFIG.siret, pageWidth / 2, footerY, { align: 'center' });
  doc.text('Merci de votre confiance', pageWidth / 2, footerY + 5, { align: 'center' });

  // Save
  doc.save(`facture-${invoice.invoiceNumber}.pdf`);
};

// ============ Ordonnance PDF ============

export const generatePrescriptionPDF = (consultation: Consultation): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDONNANCE MÉDICALE', pageWidth / 2, 22, { align: 'center' });

  // Doctor info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(consultation.doctorName, 20, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(CLINIC_CONFIG.name, 20, 58);
  doc.text(CLINIC_CONFIG.address, 20, 65);
  doc.text(`Tél: ${CLINIC_CONFIG.phone}`, 20, 72);

  // Date
  doc.text(`Date: ${new Date(consultation.date).toLocaleDateString('fr-FR')}`, pageWidth - 20, 50, { align: 'right' });

  // Patient info box
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(pageWidth - 100, 55, 80, 25, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT', pageWidth - 95, 65);
  doc.setFont('helvetica', 'normal');
  doc.text(consultation.patientName, pageWidth - 95, 73);

  // Separator
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(20, 90, pageWidth - 20, 90);

  // Diagnosis
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Diagnostic:', 20, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(consultation.diagnosis, 55, 105);

  // Symptoms
  if (consultation.symptoms.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Symptômes:', 20, 115);
    doc.setFont('helvetica', 'normal');
    doc.text(consultation.symptoms.join(', '), 55, 115);
  }

  // Prescription
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Prescription:', 20, 135);

  if (consultation.prescription) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const prescriptionLines = consultation.prescription.split('\n');
    let y = 148;
    prescriptionLines.forEach((line) => {
      doc.text(`• ${line}`, 25, y);
      y += 10;
    });
  }

  // Treatment
  if (consultation.treatment) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Traitement recommandé:', 20, 185);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const treatmentLines = doc.splitTextToSize(consultation.treatment, pageWidth - 50);
    doc.text(treatmentLines, 25, 195);
  }

  // Follow-up
  if (consultation.followUpDate) {
    doc.setFillColor(255, 243, 205);
    doc.roundedRect(20, 220, pageWidth - 40, 20, 3, 3, 'F');
    doc.setTextColor(133, 100, 4);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rendez-vous de suivi prévu le ${new Date(consultation.followUpDate).toLocaleDateString('fr-FR')}`, 25, 233);
  }

  // Signature area
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Signature du médecin:', pageWidth - 70, 260);
  doc.setDrawColor(...COLORS.secondary);
  doc.line(pageWidth - 70, 280, pageWidth - 20, 280);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(8);
  doc.text('Ce document est une ordonnance médicale. Ne pas utiliser sans avis médical.', pageWidth / 2, footerY, { align: 'center' });

  // Save
  doc.save(`ordonnance-${consultation.id}-${consultation.patientName.replace(/\s+/g, '_')}.pdf`);
};

// ============ Résultats d'examen PDF ============

export const generateExamResultPDF = (exam: Exam): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉSULTATS D\'EXAMEN', pageWidth / 2, 25, { align: 'center' });

  // Exam type badge
  const typeLabels: Record<string, string> = {
    laboratory: 'LABORATOIRE',
    imaging: 'IMAGERIE',
    biopsy: 'BIOPSIE',
    other: 'AUTRE',
  };
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth / 2 - 30, 30, 60, 8, 2, 2, 'F');
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text(typeLabels[exam.type] || exam.type.toUpperCase(), pageWidth / 2, 36, { align: 'center' });

  // Clinic info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(CLINIC_CONFIG.name, 20, 55);
  doc.text(CLINIC_CONFIG.address, 20, 62);
  doc.text(`Tél: ${CLINIC_CONFIG.phone}`, 20, 69);

  // Date
  doc.text(`Date de l'examen: ${new Date(exam.date).toLocaleDateString('fr-FR')}`, pageWidth - 20, 55, { align: 'right' });
  doc.text(`Référence: ${exam.id}`, pageWidth - 20, 62, { align: 'right' });

  // Patient and Doctor info boxes
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(20, 80, 80, 30, 3, 3, 'F');
  doc.roundedRect(pageWidth - 100, 80, 80, 30, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PATIENT', 25, 90);
  doc.text('MÉDECIN PRESCRIPTEUR', pageWidth - 95, 90);

  doc.setFont('helvetica', 'normal');
  doc.text(exam.patientName, 25, 98);
  doc.text(exam.doctorName, pageWidth - 95, 98);

  // Exam details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(exam.name, 20, 130);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Catégorie: ${exam.category}`, 20, 140);

  // Status
  const statusColors: Record<string, [number, number, number]> = {
    completed: [34, 197, 94],
    pending: [234, 179, 8],
    in_progress: [59, 130, 246],
    cancelled: [239, 68, 68],
  };
  const statusLabels: Record<string, string> = {
    completed: 'Terminé',
    pending: 'En attente',
    in_progress: 'En cours',
    cancelled: 'Annulé',
  };
  doc.setTextColor(...(statusColors[exam.status] || COLORS.secondary));
  doc.text(`Statut: ${statusLabels[exam.status] || exam.status}`, pageWidth - 20, 140, { align: 'right' });

  // Separator
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(20, 150, pageWidth - 20, 150);

  // Results
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RÉSULTATS', 20, 165);

  if (exam.results) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const resultsLines = doc.splitTextToSize(exam.results, pageWidth - 40);
    doc.text(resultsLines, 20, 178);
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.text('Résultats en attente...', 20, 178);
  }

  // Notes
  if (exam.notes) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes:', 20, 220);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(exam.notes, pageWidth - 40);
    doc.text(notesLines, 20, 230);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(8);
  doc.text('Ce document est confidentiel et destiné uniquement au patient et au médecin prescripteur.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(CLINIC_CONFIG.siret, pageWidth / 2, footerY + 5, { align: 'center' });

  // Save
  doc.save(`examen-${exam.id}-${exam.patientName.replace(/\s+/g, '_')}.pdf`);
};

// ============ Rapport statistiques PDF ============

interface StatsData {
  period: string;
  stats: {
    label: string;
    value: number | string;
    change?: string;
  }[];
  chartData?: {
    title: string;
    data: { label: string; value: number }[];
  }[];
}

export const generateStatsReportPDF = (data: StatsData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RAPPORT STATISTIQUE', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.period, pageWidth / 2, 38, { align: 'center' });

  // Clinic info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(CLINIC_CONFIG.name, 20, 60);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth - 20, 60, { align: 'right' });

  // Stats grid
  let y = 80;
  const statBoxWidth = (pageWidth - 60) / 2;
  const statBoxHeight = 30;

  data.stats.forEach((stat, index) => {
    const x = 20 + (index % 2) * (statBoxWidth + 20);
    if (index > 0 && index % 2 === 0) {
      y += statBoxHeight + 10;
    }

    doc.setFillColor(...COLORS.light);
    doc.roundedRect(x, y, statBoxWidth, statBoxHeight, 3, 3, 'F');

    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(9);
    doc.text(stat.label, x + 10, y + 12);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(stat.value), x + 10, y + 24);

    if (stat.change) {
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.change, x + statBoxWidth - 10, y + 24, { align: 'right' });
    }
  });

  // Chart data tables
  if (data.chartData && data.chartData.length > 0) {
    y += statBoxHeight + 30;

    data.chartData.forEach((chart) => {
      if (y > 240) {
        doc.addPage();
        y = 30;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.title, 20, y);

      const tableData = chart.data.map(item => [item.label, String(item.value)]);

      autoTable(doc, {
        startY: y + 5,
        head: [['Catégorie', 'Valeur']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: COLORS.primary,
          textColor: [255, 255, 255],
        },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto',
      });

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    });
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(8);
  doc.text('Rapport généré automatiquement par MediCare SIH', pageWidth / 2, footerY, { align: 'center' });

  // Save
  doc.save(`rapport-statistiques-${data.period.replace(/\s+/g, '_')}.pdf`);
};
