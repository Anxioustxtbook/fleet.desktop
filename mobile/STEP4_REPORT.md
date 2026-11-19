# Step 4 report: lists, records and forms

**Changed:** screens, theme and navigation only. `src/db`, `src/sync`, `src/shared`, `src/backup.js` and the desktop sync files were not touched.
**Tests:** mobile 131 / 131 pass, desktop 41 / 41 pass.

## Built
- New list screen for all ten lists (search, sort, chips, totals, month cards, new-today dot).
- Record page with photo, details, Edit, Record payment, Exit / Restore / Delete with confirm sheets and toasts.
- Forms restyled to full pages with the existing save logic and the new save feedback.
- Overdue payments page with Record payment.
- Prototype wording for form checks; whole shillings in rows and tables.
- Photos on the phone only (vehicles, drivers, clients).

## Things you must know
1. **New native modules** (`expo-image-picker`, `expo-image-manipulator`): install this build fresh over the old app, with the same signing key. Data is kept.
2. **Not bundled:** there is no network here, so Metro was not run. JSX was syntax-checked with `tsc` and the logic is covered by tests. Please run it on the phone.
3. **Also built (second pass):** Fuel month ledger screen, Coop screen with VAT view and 16-column Full list, Coop line forms (from a coop rental / not yet in Rentals), own Full-list columns for Rentals and Sub-hire. **Only the Coop Excel button is a placeholder** (it shows a notice); saving the file is Step 6.
4. Inside a form, the page no longer auto-scrolls to the first error (errors show under each field).
5. Client Exit adds an optional `status` field to client records; it syncs as part of the whole record.

## Next
Step 5: Insights. Waiting for your approval.
