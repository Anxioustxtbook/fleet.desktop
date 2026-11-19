# Mbadavi Fleetpilot

8DcqU86d9FWs7Iqc
Fleet and rental ledger for Mbadavi Investment Limited. It is a Windows desktop app packaged with Electron; the ledger uses the app's local SQLite database.

## Commands

```powershell
npm install
npm run dev                # Vite dev server; ledger data is available only in the desktop app
npm run desktop            # build, then open the desktop app
npm start                  # open the desktop app using the existing dist/ build
npm run desktop:portable   # build release/FleetPilot <version>.exe (single portable file)
npm run desktop:installer  # build release/FleetPilot Setup <version>.exe (NSIS installer)
npm run build              # production web build in dist/
npm run preview            # serve dist/ locally
npm run test:sync          # phone-sync protocol tests with a simulated phone
```

## Project layout

The app source is the current desktop update (see `docs/CHANGES-v22.txt` for historical changes from v3 to v22).
The previous modular version is kept untouched in `backup-before-v22/`.

```
electron/
  main.cjs              Electron main process: window, single-instance lock, link handling
  ledgerFile.cjs        SQLite database in %APPDATA%\FleetPilot (save on every change, one monthly snapshot archive, yearly copies after 12 successful months)
  ledgerPreload.cjs     Preload: gives the page window.fleetDesktop (the only door to that folder)
  phone-sync/           Desktop sync server, merge engine, SQLite tracking and developer backups
index.html              App markup and styles (Vite entry, self-contained)
public/                 Icons copied as-is into the build
build/                  electron-builder resources (app icon)
src/
  main.js               Bootstrap: desktop SQLite bridge, ExcelJS, table tools, keyboard nav, then ledger.js
  ledger.js             The app core: state, screens, save/open, dashboard, reports
  auditCore.js          Read-only Audit calculations for balances and incomplete records
  dbPersist.js          Opens/saves the desktop SQLite database and recovers SQLite safety copies
  phone-sync/           Connect phone UI, pairing help and QR generator
  order.js              Table order: newest record first (inside each month for month-grouped tables)
  importer/             Excel import of the PERFOMANCE workbook (rentals, expenses, invoices, payments, admin sheets)
  calendar.js, holidays.js, today.js, idle.js           Calendar, Kenyan holidays, Today box, idle screen
  performance.js, carPerf.js, balance.js, chips.js      Performance, per-car figures, balance check, filter chips
  fuel*.js, coop.js, subhire*.js, loans.js              Fuel account, Coop, Sub-hire, Loans
  payRoute.js, payUi.js                                 Payments hub (money in / money out)
  pilot*.js, pages.js, ownerSheets.js, fileLayout.js    Admin (Pilot), Pages, Excel save layout
shared/
  billing.js, fuelCore.js, order.js                     Pure helpers shared by desktop and mobile
mobile fleetpilot/
  metro.config.js                                        Lets Metro bundle the shared helpers above
test/                   Node tests (*.test.mjs), phone-sync tests (phone-sync/), and older headless-browser scripts (*.py)
server/                 Old optional SQLite API: no longer used by the app
docs/                   CHANGES-v22.txt, WORKFLOW.md, desktop-database.txt, phone-sync/ and excel/
```

## Desktop UI and functionality

The desktop app is built from the project root. These are the main files to inspect or annotate:

| Area | File | What it controls |
|---|---|---|
| Main layout and styling | [`index.html`](./index.html) | Desktop markup, navigation, panels, dialogs and most CSS |
| App behavior and screens | [`ledger.js`](./src/ledger.js) | Screen state, dashboard, opening/saving data and report behavior |
| Startup and app wiring | [`main.js`](./src/main.js) | Initializes desktop services and connects them to the UI |
| Admin, Pilot and Pages | [`pilot.js`](./src/pilot.js), [`pages.js`](./src/pages.js) | Admin/Pilot navigation and Pages features |
| Audit calculations | [`auditCore.js`](./src/auditCore.js), [`balance.js`](./src/balance.js) | Audit findings, balances and performance balance checks |
| Payments and money in/out | [`payRoute.js`](./src/payRoute.js), [`payUi.js`](./src/payUi.js) | Payments hub and money-in/money-out workflows |
| Performance and reports | [`performance.js`](./src/performance.js), [`carPerf.js`](./src/carPerf.js) | Performance views and per-car figures |
| Calendar and Today | [`calendar.js`](./src/calendar.js), [`today.js`](./src/today.js) | Calendar and daily information |
| Fuel, Coop, Sub-hire and Loans | [`fuelCore.js`](./src/fuelCore.js), [`coop.js`](./src/coop.js), [`loans.js`](./src/loans.js) | These feature calculations and flows; related files include `fuel*.js` and `subhire*.js` |
| Excel import | [`importer/`](./src/importer/) | Workbook import, review and record mapping |
| Database and recovery | [`ledgerFile.cjs`](./electron/ledgerFile.cjs), [`dbPersist.js`](./src/dbPersist.js) | SQLite storage, persistence and recovery copies |
| Phone connection and sync | [`phone-sync/`](./src/phone-sync/), [`syncServer.cjs`](./electron/syncServer.cjs) | Desktop pairing UI and the phone sync server |

Use the desktop app for real ledger data. The browser development page (`npm run dev`) does not open the desktop
database; use `npm run desktop` to run the installed-style desktop app.

## Mobile UI and functionality

The mobile app is in [`mobile fleetpilot/`](<./mobile fleetpilot/>). Use the local preview at
`http://localhost:8081/` to review it. These are the main files to inspect or annotate:

| Area | File | What it controls |
|---|---|---|
| Dashboard | [`Dashboard.js`](<./mobile fleetpilot/src/ui/screens/Dashboard.js>) | Summary cards, quick actions, Money In/Out, trend, active rentals, bookings |
| Today and alerts | [`DailyInfo.js`](<./mobile fleetpilot/src/ui/screens/DailyInfo.js>) | Daily totals, active rentals, upcoming bookings and alerts |
| Search | [`Search.js`](<./mobile fleetpilot/src/ui/screens/Search.js>) | Search input and record results |
| Settings and files | [`Files.js`](<./mobile fleetpilot/src/ui/screens/Files.js>), [`PortableFilesPanel.js`](<./mobile fleetpilot/src/ui/PortableFilesPanel.js>) | Appearance, connect/sync entry point, CSV, archive import/export and backup |
| Connection and first copy | [`Connect.js`](<./mobile fleetpilot/src/ui/screens/Connect.js>), [`FirstCopy.js`](<./mobile fleetpilot/src/ui/screens/connect/FirstCopy.js>) | Pairing, initial computer copy, and merging phone records |
| Data entry | [`EntryForm.js`](<./mobile fleetpilot/src/ui/screens/EntryForm.js>) and [`forms/`](<./mobile fleetpilot/src/ui/forms/>) | Add/edit forms and their validation |
| Tables and records | [`Table.js`](<./mobile fleetpilot/src/ui/screens/Table.js>), [`tables/`](<./mobile fleetpilot/src/ui/tables/>) | Table rows, search, filters and record details |
| Audit and reports | [`Audit.js`](<./mobile fleetpilot/src/ui/screens/Audit.js>), [`Reports.js`](<./mobile fleetpilot/src/ui/screens/Reports.js>) | Balances, missing items and reporting views |
| Navigation and styling | [`Shell.js`](<./mobile fleetpilot/src/ui/Shell.js>), [`theme.js`](<./mobile fleetpilot/src/ui/theme.js>), [`tabs.js`](<./mobile fleetpilot/src/ui/logic/tabs.js>) | Screen frame, navigation, colors and appearance |
| Sync behavior | [`session.js`](<./mobile fleetpilot/src/ui/session.js>), [`engine.js`](<./mobile fleetpilot/src/sync/engine.js>), [`records.js`](<./mobile fleetpilot/src/db/records.js>) | App actions, first copy, sync, local records and safe imports |

Add your requested desktop or mobile changes below or annotate the relevant file names. You do not need to edit
source code; once you bring back this edited list, we can implement the chosen changes and keep the existing
ledger and sync rules.

### Changes I want

For each change, copy and fill this block:

```text
Screen or file:
What I want changed:
What should happen after the change:
What must stay the same:
Priority:
```

### Tests

Run focused tests from the project root, e.g. `node --test test\reporting-year.test.mjs`.

The desktop Audit and global **+ Add** menu follow the compatible mobile workflows without adding new record types: payments, rentals, expenses, vehicles, drivers, clients, and bookings continue to use the existing SQLite records and phone-sync protocol. Mobile-only Support remains on the phone.

## Troubleshooting

- **`EPERM: operation not permitted, rename ...win-unpacked.tmp` when packaging.** Something is locking new folders inside the project, usually Windows Defender's Controlled Folder Access or antivirus scanning the freshly extracted `electron.exe`. Allow Node/electron-builder in that tool, or build to another folder, e.g. `npx electron-builder --win portable --config.directories.output=C:\fleetpilot-release`.
- **The app starts as plain Node from a VS Code terminal.** VS Code sets `ELECTRON_RUN_AS_NODE`. Run `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) first.

## Data

In the desktop app the ledger is a SQLite database: `%APPDATA%\FleetPilot\databases\<name>.db`, using the `node:sqlite` module built into Electron (nothing to install). Each record is a row in the `records` table. Every save is one transaction, about half a second after each change and again when the window closes. Monthly full-database snapshots are stored together in `%APPDATA%\FleetPilot\copies\FleetPilot monthly backups.db`; the current month's entry is refreshed after each successful save. If the main ledger is missing or damaged, startup tries to restore the newest valid monthly snapshot, then a yearly copy. Yearly copies are automatic after 12 distinct months with successful saves. Installing a newer version never touches this folder. Pilot > Database chooses which database opens at start.

On the first start of this version, any `.fpdb.json` database from v21 or earlier is moved into SQLite once. The old file is kept, unchanged, in `old-files\`. Existing monthly safety copies are consolidated into the single archive when they can be validated.

The browser development page does not load or save ledger data; it displays a message requiring the installed desktop app. No IndexedDB or localStorage ledger fallback is used.

SQLite autosaves ledger changes. Excel is only used when you ask: File & backup > Save Excel backup / Open Excel backup / Import.

CSV export is optional and disabled by default. Enable it in Settings to expose CSV and Excel + CSV in Save Excel backup. CSV exports include rental income and expenses for the selected date scope; payments are not duplicated as income. Currency and tax treatment are configurable, including category overrides, and affect only the generated CSV—not the ledger or Excel backup. The initial tax treatment is "No tax calculation"; choose and review the rates and inclusive/exclusive rules that fit your workflow before relying on the resulting figures.

The mobile app also offers the same CSV columns and export-only tax calculations under File & backup. CSV settings on the phone are stored locally and do not sync with desktop settings.

Settings > Customize controls light/dark appearance, feature tips, and the reporting year. Yearly report filters follow the selected calendar or custom financial year; a non-blocking dashboard reminder offers an Excel copy after year-end. SQLite remains the active ledger whether or not a copy is exported. Recovery and developer contact are available in Settings.

The Admin area and record actions are no longer PIN-protected. Keep the desktop's automatic SQLite snapshots and Excel backups available for recovery.

## Roadmap

1. Validate workbook import/export against real ledger files.
2. Add secure sign-in for the Mbadavi owner account and a hosted database.
3. Build and test the FleetPilot mobile app against docs/phone-sync/SYNC_SPEC.md.
4. Add encrypted transport before pairing on untrusted networks or using sync with production data.
