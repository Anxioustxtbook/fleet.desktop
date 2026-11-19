# FleetPilot Mobile

The phone side of FleetPilot.

- The app uses Expo and React Native, with its own SQLite database, desktop pairing, first-copy, two-way sync,
  review list, and safety backup.
- **CSV export:** File & backup offers the optional tax-ready CSV export for rentals and expenses. It uses the
  desktop CSV columns and export-only tax calculations; phone CSV settings are stored locally because settings
  are not part of ledger sync.
- **Prototype UI:** the current screens are based on
  `docs/reference/FleetPilot_Phone_v5_Jirani_Updated-1.html`. They use the v5 light/dark palettes, Home/Rentals/Add/
  Calendar/Menu navigation, live SQLite-backed records, list/detail pages, and the prototype entry forms. Prototype
  sample records are never copied into the phone database.
- **Account and settings:** the Home greeting opens Account, which links to Settings, Notifications, Support, Terms,
  and Privacy. Display size defaults to `0.80`; phone-only display, tour, photo, and form floating-Add preferences are kept locally.
- **Phone reminders:** Android and iOS use native local reminders for late rentals and upcoming bookings. They are
  scheduled on the phone and do not require a desktop connection; they are not remote push notifications from
  Desktop. Browser preview does not support native notifications.
- File & Backup retains CSV export, portable phone archives, undo for imports, and the phone-local safety backup.
  Some later-stage prototype pages (including Profile) remain placeholders.

## Folder map

```
App.js / index.js          app entry, route map, and screen shell
app.json / package.json    Expo native plugins and dependencies
src/app.js                 current database, sync, CSV, archive, and backup services
src/db, src/sync           SQLite ledger, pairing, sync, and review data
src/shared                 shared billing and record rules
src/ui                     v5 Jirani screens, forms, lists, navigation, themes, and reminders
src/localPrefs*.js         phone-only appearance, tour, and photo preferences
docs/reference             current prototype and its tour/legal source text
test/                      database, sync, export, UI, and Step 4 regression tests
```

## Run

```
npm install
npm run android             # development build on a phone or emulator; needs Android Studio's tools
```

## Web preview

```
npm run preview:web
```

Open `http://localhost:8081/` on this computer. To preview from a phone on the same Wi-Fi, open
`http://<computer-LAN-IP>:8081/` instead; Windows Firewall may ask to allow the preview server on the private
network. The server exports the web app and serves it with the cross-origin isolation headers required by
expo-sqlite's browser database. The browser preview supports local JSON archive downloads and file selection;
native notifications, photos, and phone-to-desktop pairing need a development build on a phone.

The Home dashboard reads actual SQLite records for billing, payments, expenses, active rentals, bookings, fuel,
and audit alerts. Pull down to refresh. The center Add button opens native entry forms; Rentals and Calendar are
the other primary tabs, and Menu keeps File & Backup, desktop connection, support, and all tables available.
The phone's first-copy screen can merge both ledgers: it preserves local phone edits, copies the computer snapshot,
then sends the phone's unsent records back through normal sync.

File & Backup can export or review a full JSON archive. Archives can only be restored to the phone that created
them; use Connect & Sync to move records between devices. Merge adds records not already present and skips
existing/deleted IDs. Replace shows the changes, makes the existing safety backup first, and can be undone until
the phone is edited or synced again.

## Tests and verification

```
npm test
FP_DESKTOP=/path/to/desktop/project npm test       # enables desktop-dependent integration checks
```

The UI tests cover navigation, Home, appearance, lists, forms, photos, Fuel, Coop, calendar, performance, and reports.
The database, CSV, backup, and sync suites are run with them. On the current workspace, `npm test` passed 103 tests
and skipped 28 checks that require the desktop project. `npx expo install --check` reports compatible Expo
dependencies, and the web export was opened at `http://localhost:8081/`. Native device behavior has not been
verified on a physical phone.

## Desktop change needed (one line)

The restored-phone test is marked TODO because it found a gap in the desktop. When a phone comes back from an old
backup the desktop correctly asks for a catch-up, but it still skips the phone's *own* records when sending
everything back, so records the phone made after its backup are not returned to it. The totals check does flag
the difference, so nothing is silent, but the phone cannot recover those records.

In `electron/syncServer.cjs`, function `pullPage`, change

```js
if(r.arrived_from === d.device_id && r.device === d.device_id) return;
```
to
```js
if(!catchup && r.arrived_from === d.device_id && r.device === d.device_id) return;
```

With that change the TODO test passes and the desktop's own 41 tests still pass.

Also in the desktop's `SYNC_SPEC.md`: line 27 says the desktop makes a safety copy before first pairing, line 96 says it
no longer does, and the code makes none. Line 27 should be deleted.

## Native verification still needed

- Install a fresh Android/iOS development build for the new Expo modules, then check the photo picker and local
  reminder permissions on the device.
- Test desktop pairing, first-copy, and two-way sync against the desktop app on the same Wi-Fi network. The
  desktop-dependent automated checks are skipped unless `FP_DESKTOP` points to the desktop project.

## Rules the code keeps

- The database file is checked when it opens; a damaged or newer file is never changed or replaced.
- Every write is one transaction, one at a time, and is read back before it is committed.
- Record numbers come from the range the desktop gave this phone. Before the phone is paired it has no range, so what you enter gets temporary numbers; the moment it is paired they are swapped for real ones (in the order entered) and every link between records is updated. They are then sent on the next sync.
- Nothing is deleted by sync without a marker, and a delete stays a delete unless Restore is chosen on the computer.
- The phone's change counter moves only after the desktop confirms it has the changes.
- The key from pairing lives in the phone's secure store and never in the database or a backup.

## Historical implementation notes (before the v5 Jirani UI)

The following sections record earlier migration stages. The current UI/reference is the v5 Jirani prototype above.

### Step 2C: tables and Pilot Overview
- Menu tables (Vehicles, Drivers, Clients, Bookings, Rentals, Payments, Expenses, Fuel, Coop, Sub-hire) open a table screen: search, filter chips, sort button, month headers, green dot for records that arrived today, totals bar. Tap a row to read the record; Edit opens the plain editor (proper entry forms: Step 2D).
- Pilot shows the Overview only (monthly cards, newest first, no PIN), worked out by the desktop's own `summary.js`.
- Limits: standing rent (a desktop setting) is not synced, so Rent can be lower than on the computer. Calendar, Performance, Reports and Analysis are still placeholders. Nothing has been run on a real phone yet.
- Tests: 62 pass with `FP_DESKTOP=<desktop project> npm test`.

### Step 2D: entry forms, Audit, rent alert
- **Entry forms** (`src/ui/forms.js` rules, `screens/EntryForm.js` screen): a green ＋ button on each table (Vehicles, Drivers, Clients, Bookings, Rentals, Payments, Expenses, Fuel fill / Top-up) and Edit on a record. Enter moves to the next field; picking from a list or tapping a choice moves on by itself; dates and times are typed loosely (`1011`, `10/11`, `930`) and shown back in full; the last Enter saves; "Save and add another" for batches. The desktop's rules are kept: a payment cannot exceed what is owed, a rental's amount comes from `billing.js`, fronted fuel also becomes a Fuel expense, a new rental makes the car Rented, double bookings are warned about, and changing a record from an earlier month asks first. Several records are saved as one unit (`records.saveBatch`): all or none.
- **Audit** (`screens/Audit.js`, rules in `audit.js`) and **Analysis** both appear in the phone menu in the desktop's order. Audit has a fluency percentage that reaches 100% only when nothing is left, then: who has not paid us (by client, with *Record payment*), sub-hire cars not paid for and sub-hire drivers not paid (by owner / driver, with *Mark paid*), the fuel account if behind (*Record a top-up*), rent not entered, and records with something missing (*Fix it*). Buttons for **Analysis** and **Payments**; the Payments table and the Dashboard also link to the Audit.
- **Rent**: no standing rent on the phone. Instead an alert on the Dashboard, Pilot Overview and Audit names the months with activity but no Rent entry, and one tap opens the Expense form set to Rent for that month, starting from the last rent entered.
- The mobile Analysis uses the records held on the phone; sync first for figures that match the desktop.
- Tests: 72 pass with `FP_DESKTOP=<desktop project> npm test` (44 pass and 28 wait for the desktop without it). Not run on a phone.
- **Suggestions while typing** (no duplicates): registration, client name, driver name and a rental's "new client" show matching records as you type (spaces, dashes and case ignored: `kbr670` finds `KBR 670E`). An existing car, client or driver is offered with "tap to open it"; saving a duplicate is refused. In a rental, tapping a matching client uses it. Owner and driver names complete from names already used. Pick lists and table search ignore spaces and case too, and a car's pick row shows its daily rate. In a rental, the car's daily rate fills in, a note says where it came from, and it stays editable. Tests: 75 pass with the desktop folder set.

### Step 2E: Calendar, Performance, Reports (every menu screen is now built)
- **Calendar** (`screens/Calendar.js`, rules `calendarView.js`, desktop `calendar.js`/`holidays.js` reused): month grid, a coloured line per car, car picker with Free or Booked, Kenyan holidays (Idd dates "to be confirmed"; they are corrected on the computer only), tap a day to see what is on it and **Book for this day**. A Calendar button sits on the Bookings table.
- **Performance** (`screens/Performance.js`, `performanceView.js`): every rental with its net (amount less fuel, allowance, sub-hire and driver pay), filters (dates, car, client type, search), totals and a **By car** tab. A fixed set of figures; there is no column picker.
- **Reports** (`screens/Reports.js`, `reportsView.js`): Day, Week, Month, Year or custom dates; cards (billed, received, spent, billed less spent, still owed, rentals); revenue by car; cars out now (late ones marked); a one-car view with its statement. Printing and archive files stay on the computer.
- Limits: written from the records on the phone, so the figures equal the computer's only when the same records are held (sync first). Not run on a real phone or built with Expo here.
- See BUILD_ANDROID.md for building and installing.
- Tests: 79 pass with `FP_DESKTOP=<desktop project> npm test`.
