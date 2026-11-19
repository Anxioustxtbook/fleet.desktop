/* The new navigation, with no React in it so it can be tested (UI_SPEC section 4; the v5 Jirani prototype).
   The 5-slot tab bar, the "Add new" sheet, the Menu sheet and its groups, which screen a swipe goes to,
   and the back history (at most 30 screens). The screens and sheets only draw what this file decides. */

export const HISTORY_MAX = 30;

/* the three tabs; the bar is  Home  Rentals  [+]  Calendar  Menu */
export const TABS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'rentals', icon: 'key', label: 'Rentals' },
  { id: 'calendar', icon: 'cal', label: 'Calendar' }
];

/* the Menu sheet: icon, name, screen */
export const MENU_GROUPS = [
  { title: 'Fleet', items: [['car', 'Vehicles', 'vehicles'], ['id', 'Drivers', 'drivers'], ['users', 'Clients', 'clients']] },
  { title: 'Operations', items: [['bk', 'Bookings', 'bookings'], ['cal', 'Calendar', 'calendar'], ['key', 'Rentals', 'rentals'], ['hand', 'Sub-hire', 'subhire']] },
  { title: 'Money', items: [['wallet', 'Payments', 'payments'], ['receipt', 'Expenses', 'expenses'], ['fuel', 'Fuel', 'fuel'], ['users', 'Coop', 'coop']] },
  { title: 'Insights', items: [['chart', 'Performance', 'performance'], ['file', 'Reports', 'reports'], ['shield', 'Audit', 'audit'], ['gauge', 'Pilot', 'pilot']] },
  { title: 'Office computer', items: [['mon', 'Connect', 'connect'], ['list', 'Review list', 'review'], ['file', 'File & backup', 'files']] }
];

/* the "Add new" sheet: each tile opens the phone's existing entry form (the full-page forms replace them in Step 4) */
export const ADD_TILES = [
  { icon: 'key', label: 'New rental', request: { form: 'rentals' } },
  { icon: 'wallet', label: 'Payment', request: { form: 'payments' } },
  { icon: 'bk', label: 'Booking', request: { form: 'bookings' } },
  { icon: 'receipt', label: 'Expense', request: { form: 'expenses' } },
  { icon: 'users', label: 'Client', request: { form: 'clients' } },
  { icon: 'car', label: 'Vehicle', request: { form: 'vehicles' } },
  { icon: 'id', label: 'Driver', request: { form: 'drivers' } },
  { icon: 'fuel', label: 'Fuel fill', request: { form: 'expenses', preset: { category: 'Fuel' } } },
  { icon: 'wallet', label: 'Fuel top-up', request: { form: 'fuelTopup' } }
];

/* the name at the top of a screen's Back link and in the Placeholder */
export const LABELS = {
  home: 'Home', rentals: 'Rentals', calendar: 'Calendar', deskdash: 'Full dashboard', dashboard: 'Dashboard', overdue: 'Overdue payments',
  vehicles: 'Vehicles', drivers: 'Drivers', clients: 'Clients', bookings: 'Bookings', subhire: 'Sub-hire', payments: 'Payments', expenses: 'Expenses',
  fuel: 'Fuel', coop: 'Coop', performance: 'Performance', reports: 'Reports', audit: 'Audit', analysis: 'Analysis', pilot: 'Pilot',
  connect: 'Connect', review: 'Review list', files: 'File & backup', alerts: 'Needs attention', notifs: 'Notifications'
};

/* which step of the rebuild brings each screen in its new look (for the "not here yet" page) */
export const ARRIVES = { files: 'Step 6', alerts: 'Step 7', notifs: 'Step 7' };

/* ---------- the back history ---------- */
export function pushHistory(history, cur, next, noHistory) {
  if (noHistory || next === cur) return history;
  const h = [...history, cur];
  return h.length > HISTORY_MAX ? h.slice(h.length - HISTORY_MAX) : h;
}
export function popHistory(history) {
  if (!history.length) return { screen: 'home', history };
  return { screen: history[history.length - 1], history: history.slice(0, -1) };
}

/* ---------- swipes ---------- */
export const SWIPE = { minDx: 70, ratio: 1.6, maxMs: 800 };
export const isSwipe = (dx, dy, ms) => Math.abs(dx) >= SWIPE.minDx && Math.abs(dx) >= Math.abs(dy) * SWIPE.ratio && ms <= SWIPE.maxMs;
export const swipeDirection = dx => (dx > 0 ? 'r' : 'l');

/* what a swipe does: 'r' is a swipe to the right (finger moves right), 'l' to the left.
   { type: 'back' | 'go' | 'menu' | 'none', id?, noHistory? } */
export function swipeAction(cur, dir, { pageOpen = false, sheetOpen = false } = {}) {
  if (sheetOpen) return { type: 'none' };
  if (pageOpen) return dir === 'r' ? { type: 'back-page' } : { type: 'none' };
  const R = dir === 'r';
  if (cur === 'home') return R ? { type: 'go', id: 'deskdash' } : { type: 'go', id: 'rentals' };
  if (cur === 'deskdash') return R ? { type: 'none' } : { type: 'go', id: 'home', noHistory: true };
  if (cur === 'rentals') return R ? { type: 'go', id: 'home', noHistory: true } : { type: 'go', id: 'calendar' };
  if (cur === 'calendar') return R ? { type: 'go', id: 'rentals' } : { type: 'menu' };
  return R ? { type: 'back' } : { type: 'none' };
}

/* the "N cars · Admin" line under the name */
export const carsLine = n => `${Number(n) || 0} car${Number(n) === 1 ? '' : 's'} · Admin`;

/* the sheet and page motion, from the prototype (milliseconds) */
export const MOTION = { screenIn: 260, screenRise: 8, pageIn: 220, pageOut: 150, pageSlide: 36, scrim: 180, sheetUp: 260, addReveal: 500, tabPop: 350 };
