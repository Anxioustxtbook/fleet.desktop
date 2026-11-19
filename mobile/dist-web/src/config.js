/* Every fixed setting in one place. Nothing else in the app hard-codes these numbers. */

export const APP_NAME = 'FleetPilot Mobile';
export const APP_VERSION = '0.1.1';
export const ANDROID_PACKAGE = 'com.fleetpilot.mobile';

/* The sync message protocol (SYNC_SPEC.md). A different number is refused by the desktop with "update the app". */
export const PROTOCOL = 1;

/* The lists that sync, parents first. The desktop sends and expects this order. */
export const LISTS = [
  'vehicles', 'clients', 'drivers', 'invoices', 'rentals', 'bookings', 'coops', 'expenses',
  'payments', 'insurance', 'driverAllowances', 'accounts', 'loans', 'fuelAccount', 'individuals', 'chama'
];

/* Not synced, by design: settings (admin PIN, idle and screen settings), nextId, period. */

/* Before the phone is paired it has no range of record numbers, so what you enter gets temporary numbers counted up from here.
   The moment the phone is paired they are swapped for real numbers from its range, and every link between records is updated to match. */
export const PROVISIONAL_BASE = 9_000_000_000_000;
/* the fields that hold another record's number */
export const LINK_FIELDS = ['vehicleId', 'clientId', 'driverId', 'rentalId', 'billClientId'];

export const EPOCH = '1970-01-01T00:00:00.000Z';   // "very old": the time given to records that came in the first full copy

export const BATCH_SIZE = 200;                      // records per push batch
export const PAGE_SIZE = 200;                       // records per pulled page

export const DEFAULT_PORT = 47600;                  // the desktop's port when only an address is typed
export const DISCOVERY_PORT = 47599;                // UDP: find the computer again when its address changed
export const PING_MS = 15000;                       // keeps the green bar on the desktop
export const HELLO_TIMEOUT_MS = 3000;
export const REQUEST_TIMEOUT_MS = 20000;
export const PAIR_POLL_MS = 1500;
export const PAIR_WAIT_MS = 10 * 60 * 1000;         // how long to wait for the owner to approve on the computer
export const CLOCK_RETRY_MS = 3000;
export const CLOCK_WAIT_MS = 5 * 60 * 1000;         // how long to wait for the owner to answer the clock question

export const DEV_BACKUP_DAYS = 14;
export const DEV_BACKUP_NAME = 'FleetPilot Mobile - developer';
