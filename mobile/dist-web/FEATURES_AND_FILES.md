# FleetPilot: what is built, what is tested, and which file to open when something is wrong

Two programs share one protocol: the **desktop** (Electron + SQLite) and the **phone** (React Native / Expo + SQLite). They sync over the local Wi-Fi with no cloud. Message rules: `SYNC_SPEC.md` (desktop project).

## 1. How "tested" is meant here (read this first)
- Desktop: **41 tests pass**. Phone: **79 pass** (`FP_DESKTOP=<desktop project> npm test`).
- The sync tests run the **real phone sync code against the real desktop sync code** in Node, over a real local HTTP connection, using stand-ins for the phone-only parts (SQLite, secure store, camera, UDP). This proves the sync logic: what is sent, applied, held, resolved and checked.
- **Not yet proven** (needs your phone): how screens look and feel, the camera scan, the real Wi-Fi and Windows firewall prompt, UDP rediscovery on your router, and the phone's developer folder. `npm run android` on your phone is the real test.

## 2. Sync: how data is shared safely (the part you asked about)
| What happens | Rule | Phone file | Desktop file |
|---|---|---|---|
| Pairing, once | Phone scans the QR or types address + PIN; wrong PIN says "try again" and never locks; PIN works for one phone, once; owner must press Approve; key kept in the phone's secure store, never in the database | `src/sync/pairing.js` | `electron/syncServer.cjs` |
| First full copy | Everything arrives in pages, parents first, totals compared, no green dots; a second full copy needs a deliberate choice | `src/sync/engine.js` | `electron/syncServer.cjs`, `electron/syncDb.cjs` |
| Normal sync | Phone sends only what changed in small numbered batches, desktop applies them in **one transaction**, then the phone pulls and applies in one transaction, then confirms. Only then is anything marked delivered | `src/sync/engine.js`, `src/sync/client.js` | `electron/syncServer.cjs`, `electron/syncCore.cjs` |
| Dropped connection | Resumes from the last finished batch; nothing doubled | `src/sync/engine.js` | `electron/syncServer.cjs` |
| Record numbers | Desktop 1 to 999,999,999; each phone its own block from 1,000,000,000, never outside it | `src/db/records.js` | `electron/syncServer.cjs` |
| Same record edited on both | Newest edit wins; the other version is kept in the review list | `src/review.js`, `src/ui/screens/Review.js` | `electron/syncCore.cjs` |
| Edit vs delete | The delete stands; the edit goes to review; owner may Restore | same | same |
| Missing parent (e.g. car not there) | Held aside, retried every sync, closes itself when fixed | `src/db/records.js` | `electron/syncCore.cjs` |
| Nothing deleted by sync on its own | Doubles, overlaps and broken links are reported, never changed | n/a | `electron/syncCore.cjs` |
| Totals check | Count and sum of amounts per list compared after each sync; a mismatch is shown and listed for review | `src/sync/engine.js` | `electron/syncServer.cjs` |
| Wrong clock | Owner is asked which clock is right; sync is paused, not blocked | `src/sync/engine.js` | `electron/syncServer.cjs` |
| Old or new app | Told which side to update | `src/sync/client.js` | `electron/syncServer.cjs` |
| Restored old phone backup | Noticed and fully caught up, nothing lost | `src/sync/engine.js` | `electron/syncServer.cjs` |
| Finding the computer again | UDP broadcast when its address changed | `src/platform.js` | `electron/syncServer.cjs` |
| Green connected bar | Phone pings every 15 s; desktop bar green within 45 s | `src/sync/ping.js` | `electron/syncServer.cjs`, `electron/syncMain.cjs` |
| Green dot on arrived records | Shown for the day, never saved in the record | `src/db/records.js` | n/a |

Tests for all of the above: phone `test/sync.test.js`, `test/db.test.js`; desktop `test/sync/sync.test.cjs`.

## 3. Safety of the data on each device
- Every write is one transaction and is **read back and compared**; a mismatch rolls back everything, including the change counter. (`src/db/database.js`, `src/db/records.js`; desktop `electron/ledgerFile.cjs`)
- A damaged or newer database file is refused and **never changed or replaced**. (same files)
- A full phone or disk is reported in plain words and changes nothing.
- Writes run one at a time (twenty at once cause no clashes).
- **Developer backup**, both sides: a `.db` plus a `.json` side by side, refreshed in place every 14 days, never shown on screen, an old good pair kept if a refresh fails. Phone: `src/backup.js`; desktop: `electron/devBackup.cjs`. Open the `.db` in DB Browser for SQLite.

## 4. Desktop features added in this work
- Phone connection runs the whole time the app is open; a bar on every screen (green connected, grey off or no network, amber when waiting for the owner, never red): `electron/syncMain.cjs`, `src/connectPhone.js`, `src/ledger.js`.
- Connect phone window with Disconnect/Connect and New PIN: `src/connectPhone.js`.
- Review list with Restore and Edit for held records: `src/connectPhone.js`, `electron/syncServer.cjs`.
- Hidden change tracking for sync: `electron/syncDb.cjs`.
- Automatic developer backup: `electron/devBackup.cjs`.
- Preload doors the page may use: `electron/ledgerPreload.cjs`.

## 5. Phone screens (menu, in the desktop's order)
| Screen | What it does | Screen file | Rules file (no React) |
|---|---|---|---|
| Frame, header, three-line menu, status bar | Same names and order as the desktop sidebar, desktop colours and four status looks | `src/ui/Shell.js`, `src/ui/theme.js`, `src/ui/logic.js` | `src/ui/logic/` |
| Dashboard | Connection at a glance, audit line, rent alert | `screens/Dashboard.js` | `src/ui/audit.js` |
| Connect to desktop | Scan or type, PIN, Sync, Disconnect, guide | `screens/Connect.js`, `screens/connect/`, `src/ui/ConnectHelp.js` | `src/ui/connectHelp.json` |
| Review | Conflicts, held items, totals mismatches with Restore | `screens/Review.js` | `src/review.js` |
| Tables: Vehicles, Drivers, Clients, Bookings, Rentals, Payments, Expenses, Fuel, Coop, Sub-hire | Search (ignores spaces/case), filter chips, sort, month headers, totals bar, green dot, tap to read a record | `screens/Table.js`, `screens/RecordView.js` | `src/ui/tables/` |
| Entry forms | Enter jumps to the next field, pickers move on by themselves, dates/times typed loosely (`1011`, `930`), Save and add another, suggestions while typing, rental amount from the car's rate | `screens/EntryForm.js` | `src/ui/forms/` |
| Pilot | Overview only, no PIN | `screens/Pilot.js` | `src/ui/overview.js` |
| Audit (in Analysis's menu place) | Who has not paid us, sub-hire not paid, fuel account, rent missing, incomplete records, with one-tap fixes; Analysis reached from here | `screens/Audit.js`, `screens/Analysis.js`, `RentAlert.js` | `src/ui/audit.js`, `src/ui/analysis.js` |
| Calendar | Month grid, coloured line per car, Free/Booked, holidays, Book for this day | `screens/Calendar.js` | `src/ui/calendarView.js` |
| Performance | Every rental with net, filters, totals, By car | `screens/Performance.js` | `src/ui/performanceView.js` |
| Reports | Day/Week/Month/Year/custom, cards, revenue by car, cars out, car statement | `screens/Reports.js` | `src/ui/reportsView.js` |
| Plain editor (fallback) | Edit lists with no form | `screens/RecordEditor.js` | `src/ui/logic/` |

Figures use the **desktop's own code**, copied unchanged into `src/shared/` (`billing.js`, `fuelCore.js`, `fuelAccount.js`, `subhireCore.js`, `summary.js`, `order.js`, `holidays.js`, `calendarCore.js`), so a rental's amount, net, and monthly figures match the computer. A test compares these files byte for byte with the desktop's.

## 6. Entry-form rules kept from the desktop (`src/ui/forms/`, tested in `test/forms.test.js`)
- A payment cannot exceed what the rental still owes; picking the rental fills the amount.
- A new rental needs a client, works its amount out, makes the car Rented, writes the fuel line.
- Double bookings are warned about, not refused.
- Duplicate car, client or driver is refused, and the existing one is offered.
- Several records saved together are all-or-nothing (`saveBatch`, `src/db/records.js`).
- A rental's written fuel line cannot be edited on its own.

## 7. Where each kind of problem lives
| Symptom | Open this |
|---|---|
| Cannot pair, wrong PIN, address | `src/sync/pairing.js`, `src/ui/screens/Connect.js`, desktop `electron/syncServer.cjs` |
| Sync stops or repeats | `src/sync/engine.js`, desktop `electron/syncServer.cjs` |
| Records land wrong, held, conflict | `src/db/records.js`, `src/review.js`, desktop `electron/syncCore.cjs` |
| Database will not open, backup | `src/db/database.js`, `src/backup.js` |
| Phone-only APIs (camera, secure store, UDP, files) | `src/platform.js` (the only file that touches them) |
| A table shows wrong rows or totals | `src/ui/tables/` |
| A form refuses or saves wrong | `src/ui/forms/` |
| A report/performance/calendar figure | `reportsView.js`, `performanceView.js`, `calendarView.js`, or the matching `src/shared/` file |
| Colours, menu, status bar | `src/ui/theme.js`, `src/ui/logic/`, `src/ui/Shell.js`, `src/ui/shell/` |
| Wrong screen for a menu item | `App.js` |

## 8. Known limits
- Standing rent (a desktop setting) is not synced; the phone shows an alert for months without a Rent entry and the rent form starts from the last rent entered.
- Phone Performance has a fixed set of figures; printing, archive files and Idd date corrections are desktop-only.
- Phone Reports are worked out from the records on the phone, so they equal the computer's only after a sync.
- Not yet tried on a real phone; the desktop changes (Audit for Analysis, typing suggestions, rate hint) are not in the desktop app yet.
