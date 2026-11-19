/* The rules behind the screens, with no React in them, so they can be tested without a phone:
   the menu (in the desktop's order), what the bottom status bar says, the help wording, what each review item
   offers, and how a record is edited as plain fields. The screens only draw what this file decides. */

/* ---------- the menu: the desktop's sidebar order ---------- */
export const MENU = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vehicles', label: 'Vehicles', list: 'vehicles' },
  { id: 'drivers', label: 'Drivers', list: 'drivers' },
  { id: 'clients', label: 'Clients', list: 'clients' },
  { id: 'bookings', label: 'Bookings', list: 'bookings' },
  { id: 'calendar', label: 'Calendar', viewOnly: true },
  { id: 'rentals', label: 'Rentals', list: 'rentals' },
  { id: 'payments', label: 'Payments', list: 'payments' },
  { id: 'expenses', label: 'Expenses', list: 'expenses' },
  { id: 'performance', label: 'Performance', viewOnly: true },
  { id: 'fuel', label: 'Fuel', list: 'fuelAccount' },
  { id: 'coop', label: 'Coop', list: 'coops' },
  { id: 'subhire', label: 'Sub-hire' },         // worked out from rentals and expenses: it has no list of its own
  { id: 'reports', label: 'Reports', viewOnly: true },
  { id: 'audit', label: 'Audit' }                // replaces Analysis in the menu; Analysis is a button inside the Audit
];
export const MENU_ADMIN = [{ id: 'pilot', label: 'Pilot' }];              // shows its Overview only (Step 2C)
export const MENU_TOOLS = [                                                // the phone's own screens, like the desktop's File and Connect buttons
  { id: 'connect', label: 'Connect to desktop' },
  { id: 'review', label: 'Review list' }
];
export const MENU_HIDDEN = [{ id: 'analysis', label: 'Analysis', parent: 'audit' }];   // opened from the Audit, not from the menu
export const SCREEN_LABEL = Object.fromEntries([...MENU, ...MENU_ADMIN, ...MENU_TOOLS, ...MENU_HIDDEN].map(m => [m.id, m.label]));

/* ---------- the bottom status bar (same four looks as the desktop's) ---------- */
export function barState({ paired, desktopName, needsFullCopy, ping, busy, ask }) {
  if (ask) return { tone: 'ask', text: ask === 'clock' ? 'Answer the question on the computer' : 'Waiting for approval on the computer' };
  if (busy) return { tone: 'sy', text: busy.text };
  if (!paired) return { tone: 'off', text: 'Not connected to a computer' };
  if (needsFullCopy) return { tone: 'off', text: 'Paired. The first copy is not done yet' };
  if (ping === 'connected') return { tone: 'on', text: `Connected to ${desktopName || 'the computer'}` };
  return { tone: 'off', text: 'The computer cannot be reached' };
}
export const canSync = ({ paired, needsFullCopy, busy, ask }) => !!paired && !needsFullCopy && !busy && !ask;

const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function lastSyncText(iso, now = new Date()) {
  if (!iso) return 'Not synced yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not synced yet';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return `Last sync ${same ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} `}${time}`;
}

/* ---------- the "?" guide: the desktop's text, one source for both ---------- */
/* connectHelp.json is the desktop's file, copied as it is. It speaks from the computer's side ("this window"),
   so here those few words are turned around to read right on the phone. */
export function phoneWording(text) {
  const the = (m, word) => (m[0] === m[0].toUpperCase() ? 'The ' : 'the ') + word;
  return String(text)
    .replace(/this computer's/gi, m => the(m, "computer's"))
    .replace(/this computer/gi, m => the(m, 'computer'))
    .replace(/this window/gi, 'the Connect phone window on the computer')
    .replace(/shown here/gi, 'shown on the computer');
}
export function phoneHelp(help) {
  return {
    title: help.title,
    intro: phoneWording(help.intro),
    ways: help.ways.map(w => ({ id: w.id, title: phoneWording(w.title), needs: phoneWording(w.needs), steps: w.steps.map(phoneWording), worked: phoneWording(w.worked) })),
    ifStuck: help.ifStuck.map(phoneWording)
  };                                                                        // the "no network found" line is about the computer's own check, so it is not shown here
}

/* ---------- the review list ---------- */
/* a record's name in plain words, for titles */
export const RECORD_NAME = {
  vehicles: 'Vehicle', clients: 'Client', drivers: 'Driver', invoices: 'Invoice', rentals: 'Rental', bookings: 'Booking',
  coops: 'Coop line', expenses: 'Expense', payments: 'Payment', insurance: 'Insurance', driverAllowances: 'Allowance',
  accounts: 'Account', loans: 'Loan', fuelAccount: 'Fuel entry', individuals: 'Individual', chama: 'Chama entry'
};
export const recordName = (list, id) => `${RECORD_NAME[list] || list} ${id}`;

/* the sentence shown for a review item */
export function itemTitle(item) {
  if (item.kind === 'held') return `Waiting for the computer: ${recordName(item.list, item.recId)}. Something it points to is missing there, so the computer has not added it yet.`;
  if (item.kind === 'replaced') return `Your change to ${recordName(item.list, item.recId)} was replaced by a newer change made on the computer.`;
  return item.title;
}

export const KIND_LABEL = { held: 'Held aside', replaced: 'Your change was replaced', totals: 'Totals differ' };
export const ACTION_LABEL = { edit: 'Edit', restore: 'Restore my version', keep: 'Keep the computer\'s version', seen: 'I have looked' };

/* what each kind of item offers; the first action is the main one */
export function reviewActions(item) {
  if (item.kind === 'replaced') return ['restore', 'edit', 'keep'];
  if (item.kind === 'held') return ['edit'];
  return ['seen'];
}

const money = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/* the totals payload is [{ list, a (the computer), b (the phone) }] */
export function totalsLines(diff) {
  return (Array.isArray(diff) ? diff : []).map(d =>
    `${d.list}: the computer has ${d.a.n} (${money(d.a.sum)}), the phone has ${d.b.n} (${money(d.b.sum)})`);
}

/* ---------- editing one record as plain fields (until the entry forms arrive in Step 2D) ---------- */
export function editableFields(record) {
  return Object.keys(record).filter(k => k !== 'id').map(key => {
    const v = record[key];
    if (v !== null && typeof v === 'object') return { key, kind: 'locked', value: Array.isArray(v) ? `${v.length} items` : 'details' };
    if (typeof v === 'number') return { key, kind: 'number', value: String(v) };
    if (typeof v === 'boolean') return { key, kind: 'bool', value: v };
    return { key, kind: 'text', value: v == null ? '' : String(v) };
  });
}

/* edits = { key: newValue }. Returns only what changed, and a message for every field that cannot be used. */
export function buildPatch(record, edits) {
  const patch = {}, errors = {};
  for (const [key, raw] of Object.entries(edits || {})) {
    const old = record[key];
    if (old !== null && typeof old === 'object') continue;                    // details are never edited here
    if (typeof old === 'number') {
      const text = String(raw).replace(/,/g, '').trim();
      const n = Number(text);
      if (text === '' || Number.isNaN(n)) { errors[key] = `${key} must be a number`; continue; }
      if (n !== old) patch[key] = n;
    } else if (typeof old === 'boolean') {
      if (Boolean(raw) !== old) patch[key] = Boolean(raw);
    } else {
      const text = String(raw);
      if (text !== (old == null ? '' : String(old))) patch[key] = text;
    }
  }
  return { patch, errors };
}
