export const DEFAULT_CSV_EXPORT = Object.freeze({
  enabled: false,
  currency: 'KES',
  defaultRule: Object.freeze({ mode: 'none', rate: 0 }),
  categoryRules: Object.freeze({})
});

const MODES = new Set(['none', 'inclusive', 'exclusive']);

export function normalizeCsvExport(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaultRule = raw.defaultRule && typeof raw.defaultRule === 'object' ? raw.defaultRule : {};
  const mode = MODES.has(defaultRule.mode) ? defaultRule.mode : 'none';
  const rate = Number(defaultRule.rate);
  const categoryRules = {};
  if (raw.categoryRules && typeof raw.categoryRules === 'object' && !Array.isArray(raw.categoryRules)) {
    Object.entries(raw.categoryRules).forEach(([category, rule]) => {
      if (!category.trim() || !rule || typeof rule !== 'object' || !MODES.has(rule.mode)) return;
      const n = rule.rate == null || rule.rate === '' ? null : Number(rule.rate);
      categoryRules[category] = { mode: rule.mode, rate: n != null && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null };
    });
  }
  return {
    enabled: raw.enabled === true,
    currency: String(raw.currency || 'KES').trim().slice(0, 12) || 'KES',
    defaultRule: { mode, rate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0 },
    categoryRules
  };
}

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('CSV export found a transaction with an invalid amount.');
  return Math.round(n * 100);
}

function applyRule(amount, rule) {
  const amountCents = cents(amount);
  if (rule.mode === 'inclusive') {
    const tax = rule.rate > 0 ? Math.round(amountCents * rule.rate / (100 + rule.rate)) : 0;
    return { gross: amountCents, tax, net: amountCents - tax };
  }
  if (rule.mode === 'exclusive') {
    const tax = Math.round(amountCents * rule.rate / 100);
    return { gross: amountCents + tax, tax, net: amountCents };
  }
  return { gross: amountCents, tax: 0, net: amountCents };
}

function isoDate(value) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('CSV export found a transaction without a valid YYYY-MM-DD date.');
  const parsed = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new Error('CSV export found a transaction without a valid YYYY-MM-DD date.');
  return date;
}

function csvText(value) {
  let text = String(value == null ? '' : value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

const money = value => (value / 100).toFixed(2);
const header = ['Transaction_Date', 'Reference_ID', 'Category', 'Description', 'Currency', 'Gross_Amount', 'Tax_Amount', 'Net_Amount', 'Filing_Period'];

export function buildCsvTransactions(db, config, { start = '', end = '' } = {}) {
  const settings = normalizeCsvExport(config);
  const rows = [];
  const add = ({ date: rawDate, reference, category, description, amount }) => {
    const date = isoDate(rawDate);
    if ((start && date < start) || (end && date > end)) return;
    const override = settings.categoryRules[category];
    const defaultRule = settings.defaultRule;
    const rule = override ? { mode: override.mode, rate: override.rate == null ? defaultRule.rate : override.rate }
      : defaultRule;
    const totals = applyRule(amount, rule);
    rows.push([
      csvText(date), csvText(reference), csvText(category), csvText(description), csvText(settings.currency),
      money(totals.gross), money(totals.tax), money(totals.net), csvText(date.slice(0, 7))
    ].join(','));
  };

  (db.rentals || []).forEach(r => {
    if (!r || r.status === 'Cancelled') return;
    const reference = r.invoice || r.contract || r.receipt || ('RENTAL-' + r.id);
    add({ date: r.pickup, reference, category: 'Rental income', description: 'Rental' + (r.contract ? ' · ' + r.contract : ''), amount: r.amount });
  });
  (db.expenses || []).forEach(x => {
    if (!x) return;
    add({ date: x.date, reference: x.xlRef || ('EXP-' + x.id), category: String(x.category || 'Other'), description: x.desc || x.category || 'Expense', amount: x.amount });
  });
  rows.sort((a, b) => a.localeCompare(b));
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function buildCsvBlob(db, config, scope) {
  return new Blob(['\uFEFF', buildCsvTransactions(db, config, scope)], { type: 'text/csv;charset=utf-8' });
}
