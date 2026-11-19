import { buildOverview } from './overview.js';
import { buildPerformance } from './performanceView.js';
import { lookups, monthName } from './tables.js';

export const DASHBOARD_LISTS = ['rentals', 'payments', 'vehicles', 'expenses', 'fuelAccount', 'bookings', 'clients', 'drivers', 'insurance'];

const num = value => Number(value) || 0;
const round2 = value => Math.round(value * 100) / 100;

function monthKeys(today, count = 12) {
  const [year, month] = today.slice(0, 7).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, month - 1 - count + i + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function buildDashboardData(data, today) {
  const lookup = lookups(data);
  const overview = buildOverview(data, new Date(`${today}T12:00:00Z`));
  const performance = buildPerformance(data);
  const currentMonth = today.slice(0, 7);
  const monthlyPerformance = buildPerformance(data, {
    from: `${currentMonth}-01`,
    to: `${currentMonth}-31`
  });
  const overviewMonths = new Map((overview.empty ? [] : overview.months).map(month => [month.month, month]));
  const trend = monthKeys(today).map(month => {
    const row = overviewMonths.get(month);
    return { month, label: monthName(month), revenue: row ? row.billed : 0, expenses: row ? row.spent : 0 };
  });
  const activeRentals = (data.rentals || [])
    .filter(rental => rental.status === 'Active' && (rental.pickup || '') <= today)
    .sort((a, b) => (a.return || '9999').localeCompare(b.return || '9999'));
  const upcomingBookings = (data.bookings || [])
    .filter(booking => booking.status !== 'Cancelled' && (booking.pickup || '') >= today)
    .sort((a, b) => (a.pickup || '').localeCompare(b.pickup || ''));
  const fuel = overview.empty ? 0 : (overview.totals.cols.find(column => column.key === 'fuel') || { value: 0 }).value;
  const spent = overview.empty ? 0 : overview.totals.spent;
  const received = round2((data.payments || []).reduce((sum, payment) => sum + num(payment.amount), 0));
  const owed = round2(performance.rows.reduce((sum, rental) => sum + rental.owed, 0));
  const vehicleCount = (data.vehicles || []).length;

  const currentRentals = activeRentals.map(rental => {
    const vehicle = lookup.vehicle(rental.vehicleId) || {};
    return {
      id: rental.id,
      reg: lookup.reg(rental.vehicleId),
      vehicle: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—',
      client: lookup.clientName(rental.clientId),
      contract: rental.contract || '—',
      due: rental.return || '—',
      rate: num(rental.rate)
    };
  });
  const bookings = upcomingBookings.slice(0, 5).map(booking => {
    const vehicle = lookup.vehicle(booking.vehicleId) || {};
    return {
      id: booking.id,
      reg: lookup.reg(booking.vehicleId),
      vehicle: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—',
      client: lookup.clientName(booking.clientId),
      pickup: booking.pickup || '—',
      status: booking.status || 'Pending'
    };
  });

  return {
    metrics: {
      vehicles: vehicleCount,
      onRent: activeRentals.length,
      bookings: upcomingBookings.length,
      billed: performance.totals.amount,
      received,
      fuel,
      net: round2(performance.totals.amount - spent),
      owed
    },
    trend,
    currentMonth: monthName(currentMonth),
    byCar: monthlyPerformance.byCar.map(car => {
      const vehicle = lookup.vehicle(car.vehicleId) || {};
      return { ...car, vehicle: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—' };
    }),
    currentRentals,
    bookings,
    vehicleCount
  };
}
