# FleetPilot Phone: UI_SPEC.md (locked reference: v5 Jirani)

**Reference file (current):** `docs/reference/FleetPilot_Phone_v5_Jirani_Updated-1.html`
SHA-256 `747e69a538ae00e7817e9f69c2f3b4fc253d16b0fcd8893f956ec54ba7747451`. The earlier prototype is kept in
`docs/reference/superseded/` and is no longer the spec. Colours, sizes, splash and display size (default 0.80) are
unchanged in v5; section 12 lists everything v5 adds or changes. Texts the app must show word for word are in
`docs/reference/guidance_texts.json` (30 quick guides and the 5-step tour) and `docs/reference/legal_texts.json`
(Terms of Use and Privacy Policy).

The prototype uses **invented sample data** (cars, clients, amounts). Nothing in it is real. Section 11 says where each
screen's real data comes from.

---------------------------------------------------------------------------------------------------

## 0. Decisions needed before Step 1 (things the brief and the prototype disagree on)

| # | Point | What the prototype does | What the brief says | Needed |
|---|-------|-------------------------|---------------------|--------|
| D1 | Display size default | Default **0.80**. The slider runs 0.60 to 1.00 in steps of 0.02. A saved 0.70 is rewritten to 0.80 on load. The Settings hint says "Default 0.80". | "Display size 0.70" | Confirm 0.80 or 0.70. This spec uses 0.80 until you say. |
| D2 | Money format | Whole shillings in rows and tables (`KSh 3,084,000`), and short forms on cards (`KSh 415K`, `KSh 1.11M`). | The current phone app prints two decimals (`KSh 1,234.50`, `tables.fmt`, "the desktop's own money format"). | Choose: whole shillings (prototype) or two decimals (today). Totals tests compare figures, so this must be fixed once. |
| D3 | Fonts | Final CSS sets the text font to the phone's own system font (Roboto on Android). Numbers use JetBrains Mono. | Not stated. | JetBrains Mono needs a bundled font file and `expo-font`. Choose: bundle it, or use the system monospace. |
| D4 | Tests that describe the old look | `ui.test.js` has tests 'the menu is the desktop's sidebar', 'the colours are the desktop's', 'the status bar uses the desktop's four looks', 'every menu item has a name...' (menu length 15), 'palettes follow...'. They compare the phone to the desktop's `index.html`. | "80 mobile tests must pass at each stage" | Steps 1 and 2 change exactly what these tests check. I will rewrite them to check against this spec instead, in the same stage, and say so in that stage's report. The count stays 80 or higher. They are not in the locked folders. |
| D5 | New native modules arrive before Step 7 | Prototype has a picture picker and an Excel file picker. | "Step 7 needs a fresh install" | Step 4 (image picker) and Step 6 (document picker, sharing) also add native modules, so those builds also need a fresh install over the old app (same signing key, data kept). Confirm that is fine. |
| D6 | New code outside screens, theme, navigation | Not in the prototype. | "I change only screens, theme and navigation" and the locked list (`src/db`, `src/sync`, `src/shared`, `backup.js`, desktop sync files). | Excel import and export, notifications planning, on-phone settings and the phone-only photo store need **new files** (not edits to locked ones). `platform.js` would need small additions for the pickers and notifications. Confirm `platform.js` and `app.js` may be touched, or that I add separate new files only. |
| D7 | Vehicle colour dot | Eight fixed colours tied to eight sample registrations. | Not stated. | Real cars need a colour rule. Proposed: the same 8-colour list in order of vehicle id, repeating. Confirm. |

---------------------------------------------------------------------------------------------------

## 1. Colour (tokens)

Light is the default. Dark follows the phone's setting unless the person picks one in Settings.

| Token | Light | Dark |
|-------|-------|------|
| bg | #F4F2ED | #07090D |
| card | #FFFFFF | #0F1319 |
| card2 | #EFEBE3 | #171D26 |
| line | #E4DFD3 | #1F2630 |
| ink | #14181D | #F1F3F5 |
| dim | #6B7280 | #8D97A5 |
| gold | #F6B94A | #F6B94A |
| goldt (gold text) | #A8710A | #F6B94A |
| goldbg | rgba(232,166,42,.16) | rgba(246,185,74,.15) |
| green / greenbg | #1E9B52 / rgba(30,155,82,.12) | #4BCB7C / rgba(75,203,124,.14) |
| red / redbg | #D64541 / rgba(214,69,65,.11) | #EF5350 / rgba(239,83,80,.15) |
| blue / bluebg | #1F86C4 / rgba(31,134,196,.12) | #4DB6F0 / rgba(77,182,240,.14) |
| orange / orangebg | #D9631E / rgba(217,99,30,.12) | #F5873F / rgba(245,135,63,.15) |
| onfab (text on gold) | #1A1305 | #1A1305 |
| warn / warnline (amber card) | #FBF0DC / #EBCB8A | #1D1710 / #4A3719 |
| tab (tab bar) | #FFFFFF | #0B0E13 |
| shadow | 0 6px 20px rgba(60,45,10,.08) | 0 6px 20px rgba(0,0,0,.4) |

Fixed colours: hero card gradient `#222c38 → #0c1016` with a gold glow at 85% / 70%, border `#2a323d`, text on it white,
dim text `#aab3bf`, eyebrow `#F6B94A`. Add button gradient `#FACB6A → #F3AC30`. Toast `#14181D` on white text. Splash `#000`.
Trend chart: revenue `#E8A62A`, expenses `var(--red)`, area fill gold 34% fading to 0.
Car dot colours (sample): #B6D43C, #8B86F0, #12C9C0, #F57C4A, #D470D0, #4BCB7C, #4DB6F0, #F6B94A (see D7).
Badge classes: ok=green, bad=red, am=orange, bl=blue, gd=gold, nt=neutral (card2 / dim).

## 2. Size and type

Display size **Z** (default 0.80, range 0.60 to 1.00, step 0.02) multiplies every size below except the splash.
Sizes are the prototype's values at Z = 1.

| Element | Spec |
|---------|------|
| Page title (h1) | 28, weight 800, letter-spacing -0.02em |
| Eyebrow | 11, weight 600, letter-spacing .18em, UPPERCASE, dim |
| Card | radius 22, 1px line border, shadow token |
| Hero card | radius 26, padding 22, big number mono 40 / 700 |
| Quick action | 4 columns, gap 9, radius 20, icon circle 40 on goldbg |
| Stat card | padding 16, value mono 24, label 14 dim |
| Row | padding 14 16, title 16.5 / 700, sub 14 dim, line between rows |
| Badge | radius 12, padding 4 10, 12.5 / 700 |
| Chip | radius 20, padding 9 16, 14 / 600; selected = gold fill, onfab text |
| Search box | height 48, radius 22; sort button 48 round |
| Round add button | 44 circle, gold |
| Tab bar | 5 slots, icons 26, labels 12 / 600, slot width 68; active = goldt; centre Add button 62 x 62, radius 22, raised 30 |
| Bottom sheet | top radius 28, grab handle 70 x 5, max height 92% |
| Full-page form / page | header 56 high, title 19 / 700 centred, back arrow 24; body padding 16; footer with two 52-high buttons |
| Field | height 52, radius 14, fill card2, 1px line; label 14 dim; required star gold |
| Button | height 52, radius 14; main = gold; secondary = card2 |
| Segmented switch | radius 26, padding 5, buttons 40 high |
| Toggle row | switch on right, row padding 14 16 |
| Tick box | round, tick icon 16, on = gold fill |
| Toast | bottom 110, radius 14, 14 / 600, 2.3 s |
| Detail card (c2) | radius 18, padding 18, title 17 / 700 with a line under |
| Splash | black, logo 200 wide, diagonal reveal then fade, at least 3.15 s, then a circle opens the app and the numbers count up (0.9 s) |
| Motion | page slide-in 0.22 s; tab icon pop 0.35 s; all off when the phone asks for reduced motion |

Fonts: text = phone system font; numbers = mono (see D3).

## 3. Shared building blocks (Step 1)

Card, Row (dot or picture, title, sub, optional extra line, amount and badge on the right), Badge, Chip row with a small
caption, Stats strip (3 or 2 columns), Month header (name left, count right), Summary / Full list switch, Toggle row,
Bottom sheet, Full-page form with footer, Toast, Tick box, Segmented switch, Skeleton (existing, kept), Alert card
(coloured, pulsing dot, count badge), Table card (sideways scroll, sticky look, right-aligned numbers, bold total row).

## 4. Navigation (Step 2)

* **Tab bar, 5 slots:** Home, Rentals, **+** (Add), Calendar, Menu.
* **+ sheet "Add new"**, 4 columns: New rental, Payment, Booking, Expense, Client, Vehicle, Driver, Fuel fill, Fuel top-up.
* **Menu sheet**, with the account card on top (initials, "Mbadavi", "8 cars · Admin") and 4-column tiles in 5 groups:
  Fleet (Vehicles, Drivers, Clients) · Operations (Bookings, Calendar, Rentals, Sub-hire) · Money (Payments, Expenses,
  Fuel, Coop) · Insights (Performance, Reports, Audit with red count badge, Pilot) · Office computer (Connect,
  Review list, File & backup). The current screen's tile is marked.
* Both sheets can be expanded or collapsed with a vertical drag. Expanding Add new reveals a standalone quick-notes scratchpad
  saved only in the phone's local preferences; it is not part of desktop sync or record backups.
* **Back:** a "Back" link at the top of every screen except Home (history up to 30). Swipe right = back or previous;
  Home swipe right opens the full dashboard, swipe left opens Rentals; Rentals left opens Calendar.
* **Home header:** account picture and greeting (opens Account), bell with unread badge, "Synced" pill (opens Connect).
  The pill uses today's connection logic (`barState`, `canSync`, ping), not a new one.
* Replaced: the three-line drawer and the bottom status bar.

## 5. Screens

### 5.1 Home (Step 3)
Greeting + name · bell · Synced pill → **Hero card** (month name, billed total, "billed from N rentals", tap opens the full
dashboard) → **Quick actions** Rental, Payment, Booking, Expense → **Stat cards** (2 x 2): Fleet in use (x of N out, bar,
"N available now") · Owed to us (red) · Fuel spent this month · Fuel-account balance (red when negative) → **Red/amber
"need attention" card** (count, top 3 items, tap opens Needs attention) → **Out now · returning** (car, client, badge
Late / Today / date, "owes KSh") → **Next 7 days** (horizontal cards: date, car, client, status) → **Latest payments** →
**By car · month** with Summary / Full list (Full list = table with Vehicle, Rentals, Days, Billed, Fuel, Other, Net and
an All-cars total row).

### 5.2 Lists (Step 4)
Common layout: eyebrow with record count, title, round Add button · search · sort button (sheet: Newest first, Oldest
first, Highest amount, Clear search) · chip filter with a caption · stats strip · month-grouped rows · "No records match."
Tap a row = detail page. Details: Edit and, on rentals, Record payment.

| List | Filter chips | Stats strip | Row |
|------|--------------|-------------|-----|
| Rentals (+ Summary / Full list) | Status: All, Active, Cancelled, Returned | Billed, Paid, Owed | car dot, "REG · client", dates and days, amount, status badge, "Paid / Owed" line |
| Bookings | Status: All, Confirmed, Pending, Cancelled | Bookings, Confirmed, Pending | split "Next 3 days" and "Later"; red badge when pickup is today or tomorrow, amber within 3 days; red alert card on top |
| Vehicles | Status: All, Available, Rented, Service | Vehicles, Available, Out | car picture (or dot), reg, make/model/year, daily rate, badge, "Sub-hire" tag |
| Drivers | Status: All, Active, Off | Drivers, Active | name, phone and car, daily allowance, badge |
| Clients | Status: All, Active, Off | Clients, Active | as Drivers |
| Payments | Method: All, M-Pesa, Cash, Bank | Received, Entries | |
| Expenses | Category: All, Car wash, Fuel, Insurance, Parking, Rent | Spent, Entries | negative amounts |
| Fuel (+ Summary / Full list) | own screen: Month (previous / next arrows, All months) and Show: All, Ola, Outside, Untagged, Top-ups | 4 coloured-edge cards: Ola balance (red when owed), Paid in, Taken (Ola), Outside cash; then opening / closing balance and untagged fills; amber "possible repeat" card | fill or top-up icon, car or "Top-up", date and rental or note, amount, account badge (Ola gold, Outside blue, Untagged grey); Full list = Date, Type, Car, Rental / note, Account, Amount, Balance |
| Coop (+ Summary / Full list) | own screen: month chips (this month, last month, All months); line chips (All lines, To complete, In Rentals); "VAT view" switch (display only, 16%, amounts kept without VAT) | Days, KMs, Charge; Fuel, Driver, Allowance; big TOTAL card | name, branch and vehicle, dates, days, contract, total, badge In Rentals / To complete; tap = Coop line detail with "Open its rental" or "Finish in Rentals"; Add = "From a coop rental" or "Not yet in Rentals"; small Excel button beside search (saves the schedule); Full list = 16-column table |
| Sub-hire (+ Summary / Full list) | Status: All, Not paid, Paid, Running | Owners' share, Not paid | "Mark paid" button on unpaid rows |

Forms (full page, "Save & add another" and "Save"): Rental, Booking, Payment, Expense, Client, Driver, Vehicle, Fuel fill,
Fuel top-up, Coop line and "Add from a coop rental". Field lists are in the prototype's `FS` block and match today's entry-form rules (`forms.js`). Save keeps
the existing save logic, the existing checks (payment cannot exceed owed, billing from `billing.js`, double-booking
warning, fronted fuel also becomes a Fuel expense, no duplicate car/client/driver) and `saveBatch`.
Related fields use the prototype's two-column rows where they fit; dynamic visibility, Enter/focus order, validation,
suggestions and save behavior stay tied to `forms.js`. Empty fields show example values; pickers show an example until
an item is selected. New expenses show a horizontally scrollable set of standard categories plus each category already
present in expense records, and accept a newly typed category without a fixed item limit. Required-field stars remain
beside their labels. Unsaved-form confirmation works in the app
on web and native. Date fields keep the loose typing rules; time fields as today.
A movable floating Add button appears only on entry forms. Long-press and drag it to one of the four corners; long-press
also exposes a remove control. The Forms setting can hide or restore it. Its visibility and corner are phone-only settings.

**Photos (Step 4):** any image field (vehicle picture, profile picture, dashboard picture) opens the phone's picker. The
image is shrunk (long side 720, JPEG 0.8), stored **on the phone only**, and never written to a synced list.
Vehicle picture shows in the Vehicles row, the vehicle detail and as a banner on rental and booking details.

### 5.3 Insights (Step 5)
* **Performance:** period (30 days, 90 days, All time, Dates), search, filter chips (Car, Client type, Fuel source,
  Own / Sub-hire, each with live counts), 6 cards (Billed, Net with margin, Net/day, Fuel, Other costs, Owed with paid),
  "Performance by car · best net first" with rank, share bar and cost breakdown, Fuel used per car, Latest rentals.
  Full list: Every rental (latest 40, totals all), Performance by car, Fuel per car, with a bold total row.
* **Reports:** Day / Week / Month / Year / Dates, previous and next arrows; figures: Billed, Received, Spent, Owed,
  Net; Revenue by car; Cars out now (late marked). Full list shows these as tables.
* **Calendar:** live month grid with a coloured line per car, holiday marker, month navigation, a car filter, selected-day
  availability and record details, and booking creation for a free car on the selected day.
* **Audit:** red icon with the number of checks, headline, who has not paid, sub-hire not paid, fuel account, rent not
  entered, records with something missing; badge on the Menu tile.
* **Pilot / Overview:** Billed, Spent, Net cards, then month cards, newest first.
* **Full dashboard** (from the Home hero or Home swipe-right): live 2-column coloured-edge totals, outstanding payments,
  revenue/expense trend, By car, current rentals and upcoming bookings. The `deskdash` route opens this screen (not a Step 5 placeholder).
* **Trend card:** 6 or 12 months, revenue and expenses lines, tap a month for Revenue / Expenses / Net, dashed line for
  the month to date, totals row with net margin. **The prototype's numbers are made up. The real chart uses the
  real monthly totals.**

### 5.4 Files, Excel, backup (Step 6)
* **File & backup:** hero card "Backup on this phone" (status, last backup, refreshed every 14 days), Back up now, Sync now,
  Save as Excel (This month, Last month, Whole year). Import and restore actions are in Account → Import / Restore.
  Restyle only for backup.
* **Review import** page: file name and sheet count, "N of M marked", Mark all, Clear, tick-box rows (sheet name, row
  count, "goes to <table>" or "not recognised, needs your help" in orange), footer Cancel / "Import N sheets".
  Pop-up "Before you import" (orange shield) lists the advice: open unrecognised sheets first; existing records are
  matched, not duplicated; the Excel file is read once and not kept; imported rows reach the computer at the next sync.
  Sheet-to-table map: Rentals (rental / car perf / performance), Fuel, Coop, Sub-hire, and the others in the prototype's `XM`.
* **Review list, Connect:** restyled only.

### 5.5 Notifications (Step 7)
Two kinds only, titled **Mbadavi**: "Late return" (red) and "Booking tomorrow" (orange).
* **Pop-up** at the top: small "Mbadavi · now" line, title, detail, tag; tap opens the item; hides after about 5 s.
* **Inbox** (bell): "N unread" / "All caught up", Mark all as read, Today and Earlier groups, bold when unread, read state kept on the phone.
* **Needs attention** page: groups Urgent (red), Coming up (orange), Worth a check (blue); each row has icon, text, count
  and an arrow; hint "Fix the record and it leaves this list by itself."; button Open the full audit.
* **Settings:** Allow notifications · A car is late · A booking is tomorrow · Booking reminder time (Evening before 18:00 /
  Morning of 07:30) · Sound · Vibrate · "Send a test notification".
  The text in the prototype: "Reminders are set on the phone, so they still arrive with no connection."

### 5.6 Account, Settings, Connect (Step 8)
* **Account:** profile card; Profile, Notifications, Settings, Import / Restore, Support, Terms of Use, Privacy Policy,
  About and App version.
* **Profile:** editable name, phone and email; phone-only profile photo and monthly dashboard picture.
* **Settings:** Appearance (Light / Dark; the phone's setting is the default), Display size slider with value and
  "Reset to default", Records view (Summary / Full list), Forms (floating Add visibility), Dashboard picture (choose, remove), Tips switch and tour actions.
* **Support:** Connecting to the computer guide, Review list, Report a problem (what went wrong, phone number),
  "Developed by jiranisystem".
* **About:** black logo panel, Version, Works with FleetPilot desktop, Company Mbadavi Investment Limited, Developed by jiranisystem.
* **Connect:** hero card with computer name, address, last sync, Sync now, Disconnect. Pairing, PIN and sync unchanged.

## 6. Splash
Black screen, logo reveals on a diagonal, fades, then numbers on the first screen count up. Skeleton loading stays.

## 7. Settings kept on the phone only (never synced)
Theme, Display size, Records view, floating Add visibility and corner, dashboard and vehicle pictures, notification settings, read notifications, the planned reminders.

## 8. Accessibility the prototype already has
Buttons and rows have roles and labels, 44 px minimum touch size, visible focus ring, reduced-motion switch.

## 9. Not in the prototype (so not specified here)
Real fonts files, the app icon, the Android notification icon and channel, tablet layout.

## 10. Stage map
Step 1 §1–3 · Step 2 §4 · Step 3 §5.1 · Step 4 §5.2 · Step 5 §5.3 · Step 6 §5.4 · Step 7 §5.5 · Step 8 §5.6.

## 11. Which data each screen reads (real app)

Lists are the phone database's lists (`records.all(list)`): vehicles, drivers, clients, bookings, rentals, payments,
expenses, fuelAccount, coops, insurance. Existing rule files do the sums; nothing new is calculated in a screen.

| Screen | Lists read | Rules used |
|--------|------------|------------|
| Home hero, stats | rentals, payments, vehicles, expenses, fuelAccount | `overview.js` / `summary.js`, `billing.js`, `fuelAccount.js` |
| Out now, Next 7 days | rentals, bookings, vehicles, clients | `calendarCore.js`, `reportsView.js` (cars out) |
| Need attention card, Needs attention | rentals, bookings, payments, expenses, fuelAccount, vehicles, clients, drivers, insurance | `audit.js` (`buildAudit`, `rentMissing`), booking rule today / tomorrow |
| Latest payments | payments, rentals, vehicles, clients | `tables.js` (`buildTable`) |
| By car (Home, dashboard) | rentals, expenses, vehicles, drivers | `performanceView.js` (`rentalNet`) |
| Rentals, Bookings, Vehicles, Drivers, Clients, Payments, Expenses, Fuel, Coop, Sub-hire | per `tables.js` `NEEDS`: vehicles; drivers+vehicles; clients; bookings+vehicles+clients; rentals+vehicles+clients+payments+expenses; payments+rentals+vehicles+clients; expenses+vehicles; expenses+fuelAccount+vehicles+rentals+clients; coops+rentals+clients; rentals+vehicles+clients+drivers+expenses | `tables.js`, `subhireCore.js`, `fuelCore.js` |
| Forms | the list being edited, plus vehicles, clients, drivers, rentals for pick lists | `forms.js`, `records.create/update/saveBatch` |
| Performance | rentals, vehicles, clients, drivers, payments, expenses | `performanceView.js` |
| Reports | same | `reportsView.js` |
| Calendar | bookings, rentals, vehicles, clients | `calendarView.js`, `calendarCore.js`, `holidays.js` |
| Audit | rentals, payments, expenses, vehicles, clients, drivers, fuelAccount, insurance | `audit.js` |
| Trend card | rentals (billed per month), expenses (per month) | month totals from the same functions as Pilot's Overview |
| Pilot Overview | rentals, expenses, payments | `overview.js` |
| Review list | review table | `review.js` |
| Connect, Synced pill | sync meta | `pairing`, `ping`, `barState` |
| File & backup | meta | `backup.js` |
| Notifications | rentals (due back), bookings (pickup) | the same rules as the red alerts; phone-only plan |
| Account, Settings, Support, About | phone-only settings | none |

Not available on the phone: the desktop's standing rent setting (existing limit, unchanged; the rent alert stays).

---------------------------------------------------------------------------------------------------

## 12. What v5 (Jirani) adds or changes

| # | Change | Where it lands |
|---|--------|----------------|
| 1 | **Tap targets are at least 48 on the screen at any display size.** Text and spacing shrink with Display size; buttons, chips, rows and fields never go below 48. | Step 1 (done: `tapSize`, used by every block) |
| 2 | The Light / Dark button is gone. Theme is chosen only in Settings. | Step 8 |
| 3 | **Record pictures:** vehicle photo, or one neutral car outline; people get a round person outline. Sizes 44 in rows, 40, 28 (Next 7 days), 88 on a detail page. Photos stay on the phone only. | Steps 3 and 4 |
| 4 | **Vehicles, Drivers, Clients** are their own register screens: chips include **Exited**; exited rows are hidden until that chip; stats strips; empty text "No ... yet. Tap + to add the first one."; footer hint "These records stay here every month and every year. They only go when you exit or delete them." | Step 4 |
| 5 | **Record detail:** photo card (Add / Change / Remove), details grid, "Manage this record" with **Mark as exited / Restore** and a red **Delete** (each with a confirm sheet; toast "KDK 482T marked as exited", "restored", "deleted"). Edit pre-fills the form. | Step 4 |
| 6 | **Form checks with the prototype's wording:** needed fields ("This is needed."), duplicate registration or name, duplicate client phone, return before pickup, car in the garage, car already out on those dates, amount above 0, payment not above what is owed, no future dates, duplicate fuel fill (save again to confirm). The phone keeps its existing rules; these messages are used where the existing rule fires. | Step 4 |
| 7 | **Home order:** hero, quick actions, stats, red alert, **Overdue payments card** (amount, "N rentals unpaid · oldest N days", View), Out now, **Next 7 days** (178 wide cards with Pickup / Return badge), **Latest payments** (green wallet for money in, red receipt for money out), By car. | Step 3 |
| 8 | **Overdue payments page:** search, "Late by" chips (All, 1-7, 8-14, Over 14 days), OWED / RENTALS / OLDEST, rows with a **Record payment** button; the full-page payment form shows what is still owed, Full / Half chips, live message (more than owed, full, part), date not after today, method chips, duplicate guard; a paid row collapses away. | Step 3 and 4 |
| 9 | **Sync status:** the Home pill reads **Synced** or **Not synced** with a small red dot (records waiting, or a week without a sync). No big card on Home. Connect shows "Before you sync" with counts; File & backup shows "N records not on the computer yet". One reminder after a week; setting under Notifications. | Steps 3, 6, 7 |
| 10 | **Quick guides:** a compact "Quick guide · tap to open" card the first time a screen opens (open, Done, x); it leaves when the screen is used; "Hide all tips" and a Tips switch in Settings. Two swipe tips. **Home tour** on first launch, 5 steps. | Steps 2, 3, 8 |
| 11 | **Save feedback:** the Save button shows a spinner and "Saving", then a green check and "Saved" for about 0.65 s, toast "Saved" with a tick, then the page closes after about 0.42 s. | Step 4 |
| 12 | **Motion:** search and chip filtering ease rows in and out; Summary / Full list fades in with an 8 rise over 0.26 s; the toast slides up; reduced motion turns it all off. | Steps 1 and 4 |
| 13 | **Account:** Settings, Support, **Terms of Use**, **Privacy Policy**, About; the Jirani footer sits at the foot of the page. | Step 8 |
| 14 | A rental detail always opens the Rental form, a booking detail the Booking form. | Step 4 |

### 12.1 Questions v5 raises about the real data (answers needed at the step named)

* **Exited (Step 4):** the real vehicle and driver status already has **Inactive**, and the app may not add a field to locked tables. Proposal: "Mark as exited" sets Inactive and "Restore" sets the previous status. Clients have no status in the existing rules, so I will check and ask before Step 4.
* **Records waiting (Steps 3, 6):** the phone has no ready-made "records not yet sent" count. I will read it from the existing change log without editing the sync code, and tell you if that is not possible.
* **Delete (Step 4):** uses the existing remove, so a deleted record is removed on the computer at the next sync as today.
* **Legal texts (Step 8):** the prototype marks both as drafts. They are copied word for word.

### 12.2 Navigation as built in Step 2 (and where it differs from the prototype)

* Tab bar, + sheet (opens as a growing circle), grouped Menu, Account page, page slide-in, Back link and swipes follow section 4 and the v5 file.
* **Account rows** include Profile, Notifications, Settings, Import / Restore, Support, Terms of Use, Privacy Policy, About, App version, and the "jirani / jirani system · FleetPilot" footer.
* **Splash:** the app opens after at least **3.15 s** in v5 (it was 2.15 s in the first prototype).
* Profile fields, profile photo, and the monthly dashboard picture are editable; photos remain phone-only. Settings includes the dashboard-picture picker and tour preferences.
* Support's "Send report" cannot send anything in the prototype. On the phone it opens an email to jiranisystem23@gmail.com instead.
* The old bottom bar's Sync button and result line are gone. Results show as a toast, progress shows in a small strip at the top while connecting, copying or syncing, and Sync now stays on the Connect screen. The "N to check" button is now a count badge on the Review list tile.
* Home and the Full dashboard are now implemented from live phone records; `deskdash` routes to the Full dashboard instead
  of the old Step 5 placeholder.

### 12.3 Home as built in Step 3

* Follows 5.1 and 12 #7 and #9. **Quick guides are removed** (your instruction); the Home introduction highlights Home, Rentals, Add, Calendar and Menu, then explains the right-swipe to Full dashboard. It can be replayed from Settings.
* The bell has no unread number until Step 7. The Synced pill shows Not synced + red dot for records waiting, a week without a sync, or never synced.
* Money on Home: short forms on cards, whole shillings in rows (D2 still open for the other screens).

### 12.4 Lists, records and forms as built in Step 4

* **List screen** (`ListScreen.js`) replaces the old table for Rentals, Bookings, Vehicles, Drivers, Clients, Payments, Expenses, Fuel, Coop and Sub-hire: record count above the title, round + button, 48-high search, Sort sheet, chip filters with a caption, totals strips (three to a strip), rows grouped by month, "No records match.", green dot for records that arrived from the computer today.
* **Exit / Restore / Delete** on Vehicles, Drivers and Clients. Vehicles and drivers use `status: Inactive`; clients use an optional `status: Exited` (a record field, so it syncs as part of the whole record). An Exited chip shows exited records. Delete shows how many records use it.
* **Record page** (`RecordPage.js`): photo card, details, Edit, Record payment on rentals, Manage this record.
* **Photos** are kept on the phone only (`localPrefs`), resized to a 720 px long side, never synced. They need the new picker modules, so the app must be installed fresh over the old one (same signing key, data kept).
* **Forms** are full pages in the kit look with save feedback (spinner and Saving, then a tick and Saved, a toast, then the page closes). Blank text, numeric, date, time and picker fields show examples; required-field stars stay beside their labels. A phone-only floating Add button can be long-pressed to move or remove, then restored from Settings. All rules stay in `forms.js`; wording follows the prototype ("This is needed.", "Enter an amount above 0.", future dates refused, over-owed payments refused, car in the garage refused).
* **Overdue payments** page with Late-by chips, OWED / RENTALS / OLDEST, and Record payment (Full / Half, live message, duplicate guard).
* **Money** is whole shillings in rows and tables.
* **Fuel** is its own screen: month arrows (All months), Show chips, four coloured-edge cards (Ola balance red when owed, Paid in, Taken, Outside cash), opening / closing, untagged fills, the possible-repeat card, ledger rows, and a Full list with the running balance.
* **Coop** is its own screen: month and line chips, the VAT view switch (display only, 16%), totals strips and the TOTAL card, a line detail (Open its rental / Finish in Rentals), Add (From a coop rental / Not yet in Rentals) and a 16-column Full list. Fuel, driver and allowance are read from the rental.
* **Full lists:** Rentals and Sub-hire have their own columns and a bold total row; the others use the generic columns.
* **Excel backup:** File & Backup exports scoped Excel workbooks. Account → Import / Restore reviews Excel workbooks and phone archives; replace requires a full backup marker, every data sheet, and a fresh safety backup.
