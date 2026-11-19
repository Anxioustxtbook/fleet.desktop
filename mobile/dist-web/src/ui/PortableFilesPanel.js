import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Txt } from './parts.js';
import { useSession } from './session.js';

function reviewText(review, mode) {
  if (!review) return '';
  return mode === 'merge'
    ? `Merge adds ${review.added} new records and skips ${review.skipped} already present.`
    : `Replace adds ${review.added}, updates ${review.updated}, and removes ${review.removed} current records not in this file.`;
}

export default function PortableFilesPanel({ showExport = true, showImport = true }) {
  const s = useSession();
  const [picked, setPicked] = useState(null), [review, setReview] = useState(null), [undo, setUndo] = useState(null), [busy, setBusy] = useState(false), [confirmReplace, setConfirmReplace] = useState(false), [confirmUndo, setConfirmUndo] = useState(false);
  const refreshUndo = useCallback(async () => setUndo(await s.app.portableFiles.undoState()), [s.app]);
  useEffect(() => {
    if (showImport) refreshUndo().catch(error => s.notify(error, 'Import status could not be checked'));
  }, [showImport, refreshUndo, s.notify]);

  const exportArchive = async () => {
    setBusy(true);
    try {
      const result = await s.app.portableFiles.export();
      s.say(`Archive ready to save or share · ${result.total} records`);
    } catch (error) { s.notify(error, 'The phone archive could not be saved'); }
    finally { setBusy(false); }
  };
  const chooseFile = async () => {
    setBusy(true);
    try {
      const file = await s.app.portableFiles.pick();
      if (!file) return;
      const parsed = await s.app.portableFiles.inspect(file.text);
      setPicked({ ...file, total: parsed.total, counts: parsed.counts });
      setReview(null);
      setConfirmReplace(false);
    } catch (error) { s.notify(error, 'The selected archive could not be reviewed'); }
    finally { setBusy(false); }
  };
  const reviewImport = async mode => {
    if (!picked) return;
    setBusy(true);
    try { setReview({ ...(await s.app.portableFiles.preview(picked.text, mode)), mode }); setConfirmReplace(false); }
    catch (error) { setReview(null); s.notify(error, 'The import could not be reviewed'); }
    finally { setBusy(false); }
  };
  const saveImport = async mode => {
    if (!picked || !review || review.mode !== mode) return;
    if (mode === 'replace' && !confirmReplace) { setConfirmReplace(true); return; }
    setBusy(true);
    try {
      const result = await s.app.portableFiles.import(picked.text, mode, review.expected);
      setPicked(null);
      setReview(null);
      setConfirmReplace(false);
      s.say(`Import saved: added ${result.added}, updated ${result.updated}, removed ${result.removed}, skipped ${result.skipped}`);
      try { await s.refresh(); }
      catch (error) { s.notify(error, 'The import was saved, but the phone view could not be refreshed'); }
      try { await refreshUndo(); }
      catch (error) { s.notify(error, 'The import was saved, but undo status could not be checked'); }
    } catch (error) { s.notify(error, 'The import was not saved'); }
    finally { setBusy(false); }
  };
  const undoImport = async () => {
    setBusy(true);
    try {
      await s.app.portableFiles.undo();
      setConfirmUndo(false);
      s.say('The last file import was undone');
      try { await s.refresh(); }
      catch (error) { s.notify(error, 'The import was undone, but the phone view could not be refreshed'); }
      try { await refreshUndo(); }
      catch (error) { s.notify(error, 'The import was undone, but undo status could not be checked'); }
    } catch (error) { s.notify(error, 'The import could not be undone'); }
    finally { setBusy(false); }
  };
  const counts = picked && Object.entries(picked.counts).filter(([, count]) => count > 0).map(([list, count]) => `${list}: ${count}`).join(' · ');

  return (
    <>
      {(showExport || showImport) && <Card>
        <Txt bold size={16.5}>{showExport ? 'Phone archive' : 'Restore from phone archive'}</Txt>
        <Txt tone="dim" size={13} style={{ marginTop: 3 }}>{showExport
          ? showImport ? 'Save or restore this phone’s full record file. Archives are tied to the phone that created them; use Connect &amp; Sync to transfer between devices.'
            : 'Save this phone’s full record file. Archives are tied to the phone that created them; use Connect &amp; Sync to transfer between devices.'
          : 'Choose a phone archive, review the records, then merge them or replace this phone’s records. Archives are tied to the phone that created them.'}</Txt>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {showExport && <Button label="Save archive" kind="go" disabled={busy} onPress={exportArchive} style={{ flex: 1, marginRight: showImport ? 7 : 0 }} />}
          {showImport && <Button label="Choose file" disabled={busy} onPress={chooseFile} style={{ flex: 1 }} />}
        </View>
        {showImport && !!picked && <>
          <Txt bold size={13.5} style={{ marginTop: 12 }}>{picked.name} · {picked.total} records</Txt>
          {!!counts && <Txt tone="dim" size={12} style={{ marginTop: 3 }}>{counts}</Txt>}
          <Txt tone="faint" size={12} style={{ marginTop: 5 }}>Review what will change before saving. Replace makes a safety copy first.</Txt>
          <View style={{ flexDirection: 'row', marginTop: 9 }}>
            <Button label="Review merge" disabled={busy} onPress={() => reviewImport('merge')} style={{ flex: 1, marginRight: 7 }} />
            <Button label="Review replace" kind="warn" disabled={busy} onPress={() => reviewImport('replace')} style={{ flex: 1 }} />
          </View>
        </>}
        {!!review && <View style={{ marginTop: 12, padding: 11, borderWidth: 1, borderColor: review.mode === 'replace' ? '#BA453D' : '#21834A', borderRadius: 9 }}>
          <Txt bold size={14}>{review.mode === 'merge' ? 'Merge review' : 'Replace review'}</Txt>
          <Txt tone="dim" size={13} style={{ marginTop: 3 }}>{reviewText(review, review.mode)}</Txt>
          {review.mode === 'replace' && confirmReplace && <Txt tone="bad" bold size={13} style={{ marginTop: 8 }}>This replaces the phone’s current records. Confirm only if the list above is correct.</Txt>}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {confirmReplace && <Button label="Cancel" disabled={busy} onPress={() => setConfirmReplace(false)} style={{ flex: 1, marginRight: 7 }} />}
            <Button label={confirmReplace ? 'Back up & replace' : review.mode === 'merge' ? 'Save merge' : 'Continue to replace'} kind={review.mode === 'merge' ? 'go' : 'warn'} disabled={busy} onPress={() => saveImport(review.mode)} style={{ flex: 1 }} />
          </View>
        </View>}
      </Card>}
      {showImport && <Card>
        <Txt bold size={16}>Undo last import</Txt>
        <Txt tone="dim" size={13} style={{ marginTop: 3 }}>{undo ? undo.message : 'Checking import history...'}</Txt>
        {undo && <Button label={confirmUndo ? 'Confirm undo' : 'Undo import'} kind="warn" disabled={busy || !undo.available} onPress={() => confirmUndo ? undoImport() : setConfirmUndo(true)} style={{ marginTop: 10 }} />}
        {confirmUndo && <Txt tone="bad" size={12.5} style={{ marginTop: 6 }}>This restores the phone to the data from before the last import.</Txt>}
      </Card>}
    </>
  );
}
