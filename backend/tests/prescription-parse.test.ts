import { describe, expect, it } from 'vitest';
import {
  buildLineQuote,
  matchCatalogProduct,
  parsePrescriptionLine,
  summarizeQuote,
} from '../src/services/prescriptionParse.logic.js';

const catalog = [
  {
    id: 'p-tanzol',
    name: 'Tanzol',
    genericName: 'Albendazole',
    dosage: '400 mg',
    form: 'Comprimé',
    unit: 'comprimé',
    saleUnit: 'comprimé',
    price: 30,
    quantity: 100,
  },
  {
    id: 'p-tanzol-200',
    name: 'Tanzol',
    genericName: 'Albendazole',
    dosage: '200 mg',
    form: 'Comprimé',
    unit: 'comprimé',
    price: 20,
    quantity: 50,
  },
  {
    id: 'p-artemether',
    name: 'Artemether',
    genericName: 'Artéméther',
    dosage: '80 mg',
    form: 'Ampoule',
    unit: 'ampoule',
    saleUnit: 'ampoule',
    price: 50,
    quantity: 40,
  },
  {
    id: 'p-artemether-sirop',
    name: 'Artemether',
    dosage: '80 mg',
    form: 'Sirop',
    unit: 'flacon',
    price: 45,
    quantity: 10,
  },
];

describe('parseur de prescriptions pharmaceutiques', () => {
  it('analyse Tanzol Cés 400mg Dr 2 S/ 1cé /j après 72h', () => {
    const parsed = parsePrescriptionLine({
      rawText: 'R/ Tanzol Cés 400mg Dr 2 S/ 1cé /j après 72h',
    });

    expect(parsed.medicationName.toLowerCase()).toBe('tanzol');
    expect(parsed.dosage.amount).toBe(400);
    expect(parsed.dosage.unit).toBe('mg');
    expect(parsed.form.toLowerCase()).toContain('comprim');
    expect(parsed.quantityMarked).toBe(2);
    expect(parsed.dosePerDay).toBe(1);
    expect(parsed.durationDays).toBeNull();
    expect(parsed.quantityFromPosology).toBeNull();
    expect(parsed.quantityProposed).toBe(2);
    expect(parsed.needsPharmacistValidation).toBe(false);
    expect(parsed.instructions.toLowerCase()).toContain('après 72h');

    const match = matchCatalogProduct(parsed, catalog);
    expect(match.productId).toBe('p-tanzol');
    expect(match.confidence).toMatch(/high|medium/);

    const quote = buildLineQuote(parsed, match, catalog.find((row) => row.id === match.productId));
    expect(quote.unitPrice).toBe(30);
    expect(quote.quantityProposed).toBe(2);
    expect(quote.lineTotal).toBe(60);
    expect(quote.billable).toBe(true);
  });

  it('détecte l’anomalie Artemether : propose 6 et alerte si DR 5 ≠ posologie', () => {
    const parsed = parsePrescriptionLine({
      rawText: 'R/ Artemether Amp 80 mg DR 5 S/ 2 amps/j || 3j',
    });

    expect(parsed.medicationName.toLowerCase()).toBe('artemether');
    expect(parsed.dosage.amount).toBe(80);
    expect(parsed.form.toLowerCase()).toContain('ampoule');
    expect(parsed.quantityMarked).toBe(5);
    expect(parsed.dosePerDay).toBe(2);
    expect(parsed.durationDays).toBe(3);
    expect(parsed.quantityFromPosology).toBe(6);
    expect(parsed.quantityProposed).toBe(6);
    expect(parsed.needsPharmacistValidation).toBe(true);
    expect(parsed.alerts.some((alert) => alert.code === 'quantity_ambiguous')).toBe(true);
    expect(parsed.alerts[0].message.toLowerCase()).toContain('ne correspond pas');

    const match = matchCatalogProduct(parsed, catalog);
    expect(match.productId).toBe('p-artemether');
    expect(match.productId).not.toBe('p-artemether-sirop');

    const quote = buildLineQuote(parsed, match, catalog.find((row) => row.id === match.productId));
    expect(quote.unitPrice).toBe(50);
    expect(quote.billable).toBe(false);
    expect(quote.lineTotal).toBe(300);
  });

  it('refuse le matching approximatif sur un autre dosage', () => {
    const parsed = parsePrescriptionLine({
      rawText: 'R/ Tanzol Cés 400mg Dr 2 S/ 1cé /j',
    });
    const match = matchCatalogProduct(parsed, catalog.filter((row) => row.id === 'p-tanzol-200'));
    expect(match.productId).toBeNull();
    expect(match.alerts.some((alert) => alert.code === 'dosage_mismatch' || alert.code === 'product_not_found')).toBe(true);
  });

  it('refuse une forme différente au même dosage', () => {
    const parsed = parsePrescriptionLine({
      rawText: 'R/ Artemether Amp 80 mg DR 5 S/ 1 amp /j || 5j',
    });
    const match = matchCatalogProduct(parsed, catalog.filter((row) => row.id === 'p-artemether-sirop'));
    expect(match.productId).toBeNull();
    expect(match.alerts.some((alert) => alert.code === 'form_mismatch' || alert.code === 'product_not_found')).toBe(true);
  });

  it('calcule le total estimé (60+300) et sépare les lignes en revue', () => {
    const tanzol = parsePrescriptionLine({ rawText: 'R/ Tanzol Cés 400mg Dr 2 S/ 1cé /j après 72h' });
    const artemether = parsePrescriptionLine({ rawText: 'R/ Artemether Amp 80 mg DR 5 S/ 2 amps/j || 3j' });
    const tanzolMatch = matchCatalogProduct(tanzol, catalog);
    const artemetherMatch = matchCatalogProduct(artemether, catalog);
    const quotes = [
      buildLineQuote(tanzol, tanzolMatch, catalog.find((row) => row.id === tanzolMatch.productId)),
      buildLineQuote(artemether, artemetherMatch, catalog.find((row) => row.id === artemetherMatch.productId)),
    ];
    const summary = summarizeQuote(quotes);
    expect(summary.total).toBe(360);
    expect(summary.validatedTotal).toBe(60);
    expect(summary.billableCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
  });

  it('n’invente pas une quantité si les infos manquent', () => {
    const parsed = parsePrescriptionLine({
      rawText: 'R/ Tanzol Cés 400mg S/ 1cé /j après repas',
    });
    expect(parsed.quantityProposed).toBeNull();
    expect(parsed.alerts.some((alert) => alert.code === 'quantity_unknown')).toBe(true);
    expect(parsed.needsPharmacistValidation).toBe(true);
  });

  it('accepte aussi medication + dosage séparés comme dans OrdonnanceEditor', () => {
    const parsed = parsePrescriptionLine({
      medication: 'Tanzol Cés 400mg Dr 2',
      dosage: '1cé /j après 72h',
    });
    expect(parsed.medicationName.toLowerCase()).toBe('tanzol');
    expect(parsed.quantityProposed).toBe(2);
  });
});
