/* One record's page (opened from a list row). Photo card for vehicles, drivers and clients (kept on this phone only),
   the details in words, Edit, Record payment on rentals, and Manage this record: Mark as exited / Restore / Delete, each with a confirm sheet. */
import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useSession } from './session.js';
import { useLook, useUI } from './look.js';
import Skeleton from './Skeleton.js';
import { Btn, DetailCard, KV, Sheet, T, useToast } from './kit.js';
import { describeRecord, tableLists } from './tables.js';
import { editBlocked, formIdFor } from './forms.js';
import { confirmText, exitPatch, isExited, isRegister, restorePatch, toastFor, usage, usageText } from './lifecycle.js';
import { deletePhotoFile, pickPhoto, photoKey } from './photos.js';
import { photoUri } from './Thumb.js';

const LISTS_FOR = { vehicles: ['vehicles', 'rentals', 'bookings', 'expenses'], drivers: ['drivers', 'rentals'], clients: ['clients', 'rentals', 'bookings'] };
const needs = list => Array.from(new Set(['vehicles', 'drivers', 'clients', 'rentals', 'bookings', 'payments', ...(LISTS_FOR[list] || []), ...tableLists(list)]));

export function openRecord(S, { list, id, title }) {
  S.openPage({ title: title || 'Record', body: <RecordBody list={list} id={id} /> });
}

export function RecordBody({ list, id }) {
  const S = useSession(), look = useLook(), toast = useToast(), { t, s: sc } = useUI();
  const [data, setData] = useState(null), [confirm, setConfirm] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const d = {}; for (const l of needs(list)) d[l] = await S.app.records.all(l);
    setData(d);
  }, [S.app, list]);
  useEffect(() => { load().catch(e => S.notify(e, 'The record could not be read')); }, [load, S.version]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Skeleton kind="cards" />;

  const rec = (data[list] || []).find(r => String(r.id) === String(id));
  if (!rec) return <T size={15} tone="dim" align="center" style={{ padding: sc(28) }}>This record is no longer here.</T>;

  const reg = isRegister(list), exited = isExited(list, rec), uri = photoUri(look, list, id), key = photoKey(list, id);
  const form = formIdFor(list, rec), blocked = editBlocked(list, rec), items = describeRecord(rec, data).filter(x => x.key !== 'photo');
  const addPhoto = async () => {
    try { const r = await pickPhoto(key); if (!r) return; if (r.ok === false) { toast('Allow photo access in the phone settings to add a picture'); return; } if (uri) deletePhotoFile(uri); await look.setPhoto(key, r.uri); toast('Picture saved on this phone'); }
    catch (e) { S.notify(e, 'The picture could not be added'); }
  };
  const removePhoto = async () => { const old = uri; await look.clearPhoto(key); if (old) deletePhotoFile(old); toast('Picture removed'); };
  const run = async action => {
    setBusy(true);
    try {
      if (action === 'delete') await S.app.records.remove(list, rec.id);
      else await S.app.records.update(list, rec.id, action === 'exit' ? exitPatch(list) : restorePatch(list));
      const msg = toastFor(action, list, rec);
      setConfirm(null); toast(msg);
      if (action === 'delete') { if (uri) { deletePhotoFile(uri); look.clearPhoto(key); } S.closePage(); }
      await S.refresh();
    } catch (e) { S.notify(e, 'That could not be done'); } finally { setBusy(false); }
  };
  const ct = confirm ? confirmText(confirm, list, rec) : null, used = confirm === 'delete' ? usageText(usage(list, rec.id, data)) : '';

  return (
    <View>
      {reg ? (
        <DetailCard title="Picture">
          <View style={{ alignItems: 'center', marginBottom: sc(14) }}>
            <View style={{ width: sc(88), height: sc(88), borderRadius: list === 'vehicles' ? sc(18) : sc(44), backgroundColor: t.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {uri ? <Image source={{ uri }} style={{ width: sc(88), height: sc(88) }} resizeMode="cover" /> : <T size={13} tone="dim">No picture</T>}
            </View>
            <T size={12.5} tone="dim" align="center" style={{ marginTop: sc(8) }}>Kept on this phone only. It is not sent to the computer.</T>
          </View>
          <View style={{ flexDirection: 'row', gap: sc(12) }}><Btn label={uri ? 'Change picture' : 'Add picture'} onPress={addPhoto} />{uri ? <Btn label="Remove" onPress={removePhoto} /> : null}</View>
        </DetailCard>
      ) : null}
      <DetailCard title="Details"><KV items={items.map(x => [x.label, x.value])} /></DetailCard>
      <View style={{ gap: sc(12), marginBottom: sc(12) }}>
        {list === 'rentals' ? <View style={{ flexDirection: 'row' }}><Btn label="Record payment" icon="plus" go onPress={() => S.openForm({ form: 'payments', preset: { values: { rentalId: String(rec.id) } } })} /></View> : null}
        {form && !blocked ? <View style={{ flexDirection: 'row' }}><Btn label="Edit" onPress={() => S.openForm({ form, record: rec })} /></View> : null}
        {blocked ? <T size={13.5} tone="dim">{blocked}</T> : null}
      </View>
      {reg ? (
        <DetailCard title="Manage this record">
          <View style={{ gap: sc(12) }}>
            <View style={{ flexDirection: 'row' }}><Btn label={exited ? 'Restore' : 'Mark as exited'} onPress={() => setConfirm(exited ? 'restore' : 'exit')} /></View>
            <View style={{ flexDirection: 'row' }}><Btn label="Delete" icon="trash" onPress={() => setConfirm('delete')} style={{ backgroundColor: t.redbg }} /></View>
          </View>
        </DetailCard>
      ) : null}
      <Sheet visible={!!confirm} onClose={() => !busy && setConfirm(null)}
        footer={ct ? <><Btn label="Cancel" onPress={() => setConfirm(null)} disabled={busy} /><Btn label={busy ? 'Please wait' : ct.button} go={confirm !== 'delete'} onPress={() => run(confirm)} disabled={busy} /></> : null}>
        {ct ? <><T size={21} weight="700" style={{ marginBottom: sc(8) }}>{ct.title}</T><T size={15} tone="dim">{ct.body}</T>{used ? <T size={15} tone="red" style={{ marginTop: sc(10) }}>{used}</T> : null}</> : null}
      </Sheet>
    </View>
  );
}
