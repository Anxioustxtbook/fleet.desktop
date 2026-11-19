export const DEFAULT_CSV_EXPORT = Object.freeze({
  enabled: false,
  currency: 'KES',
  defaultRule: Object.freeze({ mode: 'none', rate: 0 }),
  categoryRules: Object.freeze({})
});

const MODES = new Set(['none', 'inclusive', 'exclusive']);
const HEADER = [
  'Transaction_Date', 'Reference_ID', 'Category', 'Description', 'Currency',
  'Gross_Amount', 'Tax_Amount', 'Net_Amount', 'Filing_Period'
];

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
      categoryRules[category] = {
        mode: rule.mode,
        rate: n != null && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
      };
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

function validateSettings(settings, categories) {
  if (!settings.currency) throw new Error('Enter a currency code before exporting CSV.');
  const validateRule = (rule, label, inheritedRate = null) => {
    if (rule.mode === 'none') return;
    const rate = rule.rate == null ? inheritedRate : rule.rate;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100)
      throw new Error(`Enter a tax rate greater than 0 and no more than 100 for ${label}.`);
  };
  validateRule(settings.defaultRule, 'the default CSV rule');
  categories.forEach(category => {
    const rule = settings.categoryRules[category];
    if (rule) validateRule(rule, category, settings.defaultRule.rate);
  });
}

export function buildCsvTransactions(data, config, { start = '', end = '' } = {}) {
  const settings = normalizeCsvExport(config);
  if (start && isoDate(start) !== start) throw new Error('Choose a start date in YYYY-MM-DD format.');
  if (end && isoDate(end) !== end) throw new Error('Choose an end date in YYYY-MM-DD format.');
  if (start && end && start > end) throw new Error('The CSV start date must be on or before the end date.');
  const categories = [...new Set([
    'Rental income',
    ...(data.expenses || []).map(x => String(x && x.category || 'Other')),
    ...Object.keys(settings.categoryRules)
  ])];
  validateSettings(settings, categories);

  const rows = [];
  const add = ({ date: rawDate, reference, category, description, amount }) => {
    const date = isoDate(rawDate);
    if ((start && date < start) || (end && date > end)) return;
    const override = settings.categoryRules[category];
    const rule = override ? {
      mode: override.mode,
      rate: override.rate == null ? settings.defaultRule.rate : override.rate
    } : settings.defaultRule;
    const totals = applyRule(amount, rule);
    rows.push([
      csvText(date), csvText(reference), csvText(category), csvText(description), csvText(settings.currency),
      (totals.gross / 100).toFixed(2), (totals.tax / 100).toFixed(2), (totals.net / 100).toFixed(2),
      csvText(date.slice(0, 7))
    ].join(','));
  };

  (data.rentals || []).forEach(r => {
    if (!r || r.status === 'Cancelled') return;
    const reference = r.invoice || r.contract || r.receipt || ('RENTAL-' + r.id);
    add({
      date: r.pickup, reference, category: 'Rental income',
      description: 'Rental' + (r.contract ? ' · ' + r.contract : ''), amount: r.amount
    });
  });
  (data.expenses || []).forEach(x => {
    if (!x) return;
    add({
      date: x.date, reference: x.xlRef || ('EXP-' + x.id),
      category: String(x.category || 'Other'), description: x.desc || x.category || 'Expense',
      amount: x.amount
    });
  });
  rows.sort((a, b) => a.localeCompare(b));
  return [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

export function createCsvExport({ db, records, platform, now }) {
  const getSettings = async () => normalizeCsvExport(await db.getMeta('csvExport', null));
  const saveSettings = async value => {
    const settings = normalizeCsvExport(value);
    await db.setMeta('csvExport', settings);
    return settings;
  };

  return {
    getSettings,
    saveSettings,
    async export(scope = {}) {
      const settings = await getSettings();
      if (!settings.enabled) throw new Error('CSV export is turned off. Enable it and save the CSV settings first.');
      const data = {
        rentals: await records.all('rentals'),
        expenses: await records.all('expenses')
      };
      const csv = buildCsvTransactions(data, settings, scope);
      const date = now().toISOString().slice(0, 10);
      return platform.fs.shareCsv(`FleetPilot-${date}.csv`, '\uFEFF' + csv);
    }
  };
}
