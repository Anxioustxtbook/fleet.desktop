import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Btn, Card, Hint, T } from './kit.js';
import { useSession } from './session.js';
import { useUI } from './look.js';
import PortableFilesPanel from './PortableFilesPanel.js';

const LABELS = {
  vehicles: 'Vehicles', drivers: 'Drivers', clients: 'Clients', bookings: 'Bookings', rentals: 'Rentals',
  expenses: 'Expenses', payments: 'Payments', invoices: 'Invoices', driverAllowances: 'Driver allowances',
  accounts: 'Accounts', loans: 'Loans', insurance: 'Insurance', chama: 'Chama', coops: 'Coop',
  individuals: 'Individuals', fuelAccount: 'Fuel account'
};

function SheetRow({ sheet, selected, onPress }) {
  const { t, s } = useUI();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: !sheet.importable }}
      disabled={!sheet.importable} onPress={onPress}
      style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12), borderBottomWidth: 1, borderBottomColor: t.line, opacity: sheet.importable ? 1 : 0.65 }}>
      <View style={{ width: s(22), height: s(22), borderRadius: s(6), borderWidth: 1.5, borderColor: selected ? t.green : t.line, backgroundColor: selected ? t.greenbg : t.card2, alignItems: 'center', justifyContent: 'center', marginRight: s(10) }}>
        {selected ? <T size={14} weight="700" tone="green">✓</T> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T size={14.5} weight="600">{sheet.name}</T>
        <T size={12.5} tone={sheet.importable ? 'dim' : sheet.recognized ? 'orange' : 'dim'}>
          {sheet.rows} rows · {sheet.importable ? `goes to ${LABELS[sheet.target] || sheet.target}` : sheet.recognized ? `not a backup table (${sheet.target})` : 'not recognised, needs your help'}
        </T>
      </View>
    </Pressable>
  );
}

export default function ExcelRestorePanel() {
  const s = useSession(), { t, s: scale } = useUI();
  const [picked, setPicked] = useState(null), [selected, setSelected] = useState([]), [review, setReview] = useState(null), [busy, setBusy] = useState(false);

  const choose = async () => {
    setBusy(true);
    try {
      const file = await s.app.excelFiles.pick();
      if (!file) return;
      const inspected = await s.app.excelFiles.inspect(file.bytes);
      setPicked({ ...inspected, name: file.name });
      setSelected(inspected.recordSheets);
      setReview(null);
    } catch (error) {
      s.notify(error, 'The Excel file could not be reviewed');
    } finally { setBusy(false); }
  };

  const reviewImport = async mode => {
    if (!picked) return;
    setBusy(true);
    try {
      const result = await s.app.excelFiles.preview(picked, selected, mode);
      setReview({ ...result, mode });
    } catch (error) {
      setReview(null);
      s.notify(error, 'The import could not be reviewed');
    } finally { setBusy(false); }
  };

  const importNow = mode => {
    if (!picked || !review || review.mode !== mode) return;
    const instructions = mode === 'replace'
      ? 'This replaces the phone’s current records. FleetPilot will make a safety backup first. Imported records will reach the computer at the next sync.'
      : 'Records with an existing number are skipped so they are not duplicated. Imported records will reach the computer at the next sync.';
    Alert.alert('Before you import', instructions, [
      { text: 'Go back', style: 'cancel' },
      { text: mode === 'replace' ? 'Back up & replace' : `Import ${review.total} records`, style: mode === 'replace' ? 'destructive' : 'default', onPress: () => saveImport(mode) }
    ]);
  };

  const saveImport = async mode => {
    setBusy(true);
    try {
      const result = await s.app.excelFiles.import(picked, selected, mode, review.expected);
      setPicked(null); setSelected([]); setReview(null);
      s.say(`Excel import saved · ${result.added} added · ${result.skipped} already present`);
      try { await s.refresh(); }
      catch (error) { s.notify(error, 'The import was saved, but the phone view could not be refreshed'); }
    } catch (error) {
      s.notify(error, 'The Excel import was not saved');
    } finally { setBusy(false); }
  };

  const toggle = list => {
    setSelected(current => current.includes(list) ? current.filter(item => item !== list) : [...current, list]);
    setReview(null);
  };
  const marked = selected.length;
  const importableSheets = picked ? picked.sheets.filter(sheet => sheet.importable) : [];

  return (
    <>
      <Card>
        <T size={16.5} weight="700">Import from Excel</T>
        <T size={13.5} tone="dim" style={{ marginTop: scale(4) }}>Choose a FleetPilot Excel backup. The phone reads it once; it is not kept in the app.</T>
        <Btn go label={busy ? 'Reading workbook…' : 'Choose Excel file'} disabled={busy} onPress={choose} style={{ flex: 0, marginTop: scale(12) }} />
      </Card>

      {picked ? (
        <Card>
          <T size={16} weight="700">{picked.name}</T>
          <T size={13} tone="dim" style={{ marginTop: scale(3) }}>{`${picked.sheets.length} sheets found · ${picked.total} records`}</T>
          {!picked.isBackup ? (
            <Hint style={{ marginTop: scale(10) }}>
              This is not a FleetPilot database backup. Original performance workbooks must be reviewed with FleetPilot Desktop’s Import Excel flow; no phone records have been changed.
            </Hint>
          ) : null}
          {picked.isBackup && picked.sheets.length ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scale(12), marginBottom: scale(8) }}>
                <T size={12} weight="600" tone="dim" upper>{`${marked} of ${importableSheets.length} marked`}</T>
                <View style={{ flexDirection: 'row', gap: scale(8) }}>
                  <Btn label="Mark all" onPress={() => { setSelected(picked.recordSheets); setReview(null); }} />
                  <Btn label="Clear" onPress={() => { setSelected([]); setReview(null); }} />
                </View>
              </View>
              <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: scale(16), overflow: 'hidden' }}>
                {picked.sheets.map((sheet, index) => (
                  <SheetRow key={`${sheet.name}-${index}`} sheet={sheet} selected={selected.includes(sheet.target)} onPress={() => toggle(sheet.target)} />
                ))}
              </View>
              <Hint style={{ marginTop: scale(9) }}>Merge adds records that are not on this phone and skips matching record numbers. Replace is offered only for a complete workbook explicitly marked as a full backup.</Hint>
              {review ? (
                <View style={{ marginTop: scale(12), padding: scale(12), borderWidth: 1, borderColor: review.mode === 'replace' ? t.red : t.green, borderRadius: scale(14) }}>
                  <T size={14.5} weight="700">{review.mode === 'merge' ? 'Merge review' : 'Replace review'}</T>
                  <T size={13} tone="dim" style={{ marginTop: scale(4) }}>
                    {`${review.added} new records · ${review.skipped} already present${review.removed ? ` · ${review.removed} current records removed` : ''}`}
                  </T>
                  <Btn go label={busy ? 'Importing…' : review.mode === 'replace' ? 'Review replace' : `Import ${review.total} records`}
                    disabled={busy} onPress={() => importNow(review.mode)} style={{ flex: 0, marginTop: scale(10) }} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
                <Btn label="Review merge" disabled={busy || !marked} onPress={() => reviewImport('merge')} />
                {picked.canReplace ? <Btn label="Review replace" disabled={busy || marked !== importableSheets.length} onPress={() => reviewImport('replace')} /> : null}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
      <PortableFilesPanel showExport={false} />
    </>
  );
}
