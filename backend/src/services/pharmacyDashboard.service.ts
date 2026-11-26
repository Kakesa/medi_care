import { PharmacyExpense, PharmacySale } from '../models/PharmacyOperations.js';
import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { Prescription } from '../models/Prescription.js';
import { StockLot } from '../models/StockLot.js';
import { StockMovement } from '../models/StockMovement.js';
import { organizationCurrency } from './catalog.service.js';

const timeZone = 'Africa/Kinshasa';

function dayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function shiftDay(day: string, delta: number) {
  const start = new Date(`${day}T00:00:00+01:00`);
  return dayKey(new Date(start.getTime() + delta * 24 * 60 * 60 * 1000));
}

function dayStart(day: string) {
  return new Date(`${day}T00:00:00+01:00`);
}

function recentDays(today: string, count: number) {
  return Array.from({ length: count }, (_, index) => shiftDay(today, index - (count - 1)));
}

function recentMonths(today: string, count: number) {
  const [year, month] = today.split('-').map(Number);
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export async function pharmacyDashboard(organizationId: string, financial: boolean) {
  const today = dayKey(new Date());
  const days = recentDays(today, 14);
  const months = recentMonths(today, 6);
  const rangeStart = dayStart(`${months[0]}-01`);
  const rangeEnd = dayStart(shiftDay(today, 1));
  const todayStart = dayStart(today);
  const expiryHorizon = dayStart(shiftDay(today, 90));
  const topSince = dayStart(shiftDay(today, -29));
  const currentMonth = today.slice(0, 7);

  const [currency, products, lots, sales, expenses, movements, pendingPrescriptions, dispensesToday, pendingOrders] = await Promise.all([
    organizationCurrency(organizationId),
    PharmacyProduct.find({ organizationId, archivedAt: null }).select('name kind quantity minStock alertStock'),
    StockLot.find({ organizationId }).select('productId lotNumber quantityRemaining purchasePrice expiresAt status').limit(5000),
    PharmacySale.find({
      organizationId,
      kind: { $in: ['counter', 'dispense'] },
      createdAt: { $gte: rangeStart, $lt: rangeEnd },
    }).select('total settlement createdAt lines.productName lines.quantity'),
    PharmacyExpense.find({
      organizationId,
      status: 'paid',
      date: { $gte: rangeStart, $lt: rangeEnd },
    }).select('amount date'),
    StockMovement.find({
      organizationId,
      status: 'validated',
      occurredAt: { $gte: rangeStart, $lt: rangeEnd },
    }).select('type direction quantity occurredAt lotId'),
    Prescription.countDocuments({
      organizationId,
      status: 'validated',
      pharmacyStatus: { $in: ['new', 'preparing', 'partial'] },
    }),
    StockMovement.countDocuments({
      organizationId,
      type: 'dispense',
      status: 'validated',
      occurredAt: { $gte: todayStart, $lt: rangeEnd },
    }),
    PharmacyOrder.countDocuments({ organizationId, status: { $in: ['pending', 'confirmed', 'partial'] } }),
  ]);

  const names = new Map(products.map((product) => [product.id, product.name]));
  let medications = 0;
  let available = 0;
  let outOfStock = 0;
  let belowAlert = 0;
  const outOfStockNames: Array<{ id: string; name: string }> = [];
  const belowAlertRows: Array<{ id: string; name: string; quantity: number; threshold: number }> = [];
  for (const product of products) {
    if (product.kind === 'medication' || !product.kind) medications += 1;
    if (product.quantity > 0) available += 1;
    else {
      outOfStock += 1;
      if (outOfStockNames.length < 8) outOfStockNames.push({ id: product.id, name: product.name });
    }
    const threshold = product.alertStock > 0 ? product.alertStock : product.minStock;
    if (product.quantity > 0 && threshold > 0 && product.quantity <= threshold) {
      belowAlert += 1;
      if (belowAlertRows.length < 8) {
        belowAlertRows.push({ id: product.id, name: product.name, quantity: product.quantity, threshold });
      }
    }
  }

  const lotCost = new Map(lots.map((lot) => [lot.id, lot.purchasePrice || 0]));
  let stockValue = 0;
  let nearExpiry = 0;
  const nearExpiryRows: Array<{ name: string; lotNumber: string; expiresAt: Date; quantityRemaining: number }> = [];
  const seenExpiry = new Set<string>();
  for (const lot of lots) {
    if (lot.status === 'available' && lot.quantityRemaining > 0) {
      stockValue += lot.quantityRemaining * (lot.purchasePrice || 0);
    }
    if (!lot.expiresAt || lot.quantityRemaining <= 0 || lot.status === 'depleted' || lot.status === 'blocked') continue;
    if (lot.expiresAt < todayStart || lot.expiresAt > expiryHorizon) continue;
    const productId = lot.productId.toString();
    if (seenExpiry.has(productId)) continue;
    seenExpiry.add(productId);
    nearExpiry += 1;
    if (nearExpiryRows.length < 8) {
      nearExpiryRows.push({
        name: names.get(productId) || 'Produit',
        lotNumber: lot.lotNumber,
        expiresAt: lot.expiresAt,
        quantityRemaining: lot.quantityRemaining,
      });
    }
  }

  const salesByDay = new Map(days.map((day) => [day, { count: 0, amount: 0 }]));
  const top = new Map<string, number>();
  let salesToday = 0;
  let salesTodayAmount = 0;
  let collectedMonth = 0;
  let billedMonth = 0;
  for (const sale of sales) {
    const key = dayKey(sale.createdAt);
    const bucket = salesByDay.get(key);
    if (bucket) {
      bucket.count += 1;
      if (sale.settlement === 'paid') bucket.amount += sale.total;
    }
    if (key === today) {
      salesToday += 1;
      if (sale.settlement === 'paid') salesTodayAmount += sale.total;
    }
    if (key.startsWith(currentMonth)) {
      if (sale.settlement === 'paid') collectedMonth += sale.total;
      if (sale.settlement === 'invoiced') billedMonth += sale.total;
    }
    if (sale.createdAt >= topSince) {
      for (const line of sale.lines) {
        top.set(line.productName, (top.get(line.productName) || 0) + line.quantity);
      }
    }
  }

  const movementByDay = new Map(days.map((day) => [day, { inbound: 0, outbound: 0 }]));
  const netValueByDay = new Map<string, number>();
  let purchasesMonth = 0;
  for (const movement of movements) {
    const key = dayKey(movement.occurredAt);
    const bucket = movementByDay.get(key);
    if (bucket) {
      if (movement.direction === 'in') bucket.inbound += movement.quantity;
      else bucket.outbound += movement.quantity;
    }
    const cost = movement.lotId ? (lotCost.get(movement.lotId.toString()) || 0) : 0;
    const delta = (movement.direction === 'in' ? movement.quantity : -movement.quantity) * cost;
    netValueByDay.set(key, (netValueByDay.get(key) || 0) + delta);
    if (movement.type === 'purchase_receipt' && key.startsWith(currentMonth)) {
      purchasesMonth += movement.quantity * cost;
    }
  }

  let running = stockValue;
  const stockValueByDay: Array<{ date: string; value: number }> = [];
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    stockValueByDay.push({ date: day, value: money(running) });
    running -= netValueByDay.get(day) || 0;
  }
  stockValueByDay.reverse();

  const expenseByMonth = new Map(months.map((month) => [month, 0]));
  let expensesMonth = 0;
  for (const expense of expenses) {
    const key = dayKey(expense.date).slice(0, 7);
    if (expenseByMonth.has(key)) expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + expense.amount);
    if (key === currentMonth) expensesMonth += expense.amount;
  }
  const collectedByMonth = new Map(months.map((month) => [month, 0]));
  const purchasesByMonth = new Map(months.map((month) => [month, 0]));
  for (const sale of sales) {
    if (sale.settlement !== 'paid') continue;
    const key = dayKey(sale.createdAt).slice(0, 7);
    if (collectedByMonth.has(key)) collectedByMonth.set(key, (collectedByMonth.get(key) || 0) + sale.total);
  }
  for (const movement of movements) {
    if (movement.type !== 'purchase_receipt') continue;
    const key = dayKey(movement.occurredAt).slice(0, 7);
    const cost = movement.lotId ? (lotCost.get(movement.lotId.toString()) || 0) : 0;
    if (purchasesByMonth.has(key)) purchasesByMonth.set(key, (purchasesByMonth.get(key) || 0) + movement.quantity * cost);
  }

  return {
    currency,
    counts: {
      medications,
      available,
      outOfStock,
      belowAlert,
      nearExpiry,
      stockValue: money(stockValue),
      pendingPrescriptions,
      dispensesToday,
      salesToday,
      pendingOrders,
    },
    alerts: {
      outOfStock: outOfStockNames,
      belowAlert: belowAlertRows,
      nearExpiry: nearExpiryRows,
    },
    salesByDay: days.map((day) => ({
      date: day,
      count: salesByDay.get(day)?.count || 0,
      amount: financial ? money(salesByDay.get(day)?.amount || 0) : null,
    })),
    topProducts: [...top.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, quantity]) => ({ name, quantity })),
    movementsByDay: days.map((day) => ({
      date: day,
      inbound: movementByDay.get(day)?.inbound || 0,
      outbound: movementByDay.get(day)?.outbound || 0,
    })),
    stockValueByDay,
    financial: financial ? {
      salesTodayAmount: money(salesTodayAmount),
      purchasesMonth: money(purchasesMonth),
      expensesMonth: money(expensesMonth),
      collectedMonth: money(collectedMonth),
      billedMonth: money(billedMonth),
      financeByMonth: months.map((month) => ({
        month,
        collected: money(collectedByMonth.get(month) || 0),
        expenses: money(expenseByMonth.get(month) || 0),
        purchases: money(purchasesByMonth.get(month) || 0),
      })),
    } : null,
  };
}
