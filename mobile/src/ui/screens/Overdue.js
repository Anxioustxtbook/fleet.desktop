/* Overdue payments (UI_SPEC 5.x): rentals past their return date that are not paid up, worst first, each with Record payment. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSession } from '../session.js';
import { useUI } from '../look.js';
import Icon from '../Icon.js';
import Skeleton from '../Skeleton.js';
import { Badge, Btn, Card, Chip, ChipRow, Field, PageHead, Row, Sheet, StatsStrip, T, useToast } from '../kit.js';
import { blankValues, checkForm, planSave, todayISO, parseDate } from '../forms.js';
import { METHODS_LIST } from '../forms.js';
import { amountMessage, buildOverdue, isDuplicate, quickAmount } from '../overdueView.js';
import { ksh0, kshShort } from '../money.js';
import { dsh, plural } from '../dates.js';
import { openRecord } from '../RecordPage.js';

export default function Overdue() {
  const S = useSession(), { t, s: sc, tap } = useUI(), toast = useToast(), today = useMemo(() => todayISO(), []);
  const [data, setData] = useState(null), [search, setSearch] = useState(''), [band, setBand] = useState('all');
  const [pay, setPay] = useState(null), [amount, setAmount] = useState(''), [date, setDate] = useState(today), [method, setMethod] = useState('Cash'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const stamp = S.status ? `${S.status.lastSyncAt || ''}|${S.version}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of ['rentals', 'payments', 'vehicles', 'clients', 'drivers']) d[l] = await S.app.records.all(l); setData(d); }, [S.app]);
  useEffect(() => { load().catch(e => S.notify(e, 'The overdue list could not be read')); }, [load, stamp]);
  const v = useMemo(() => (data ? buildOverdue(data, today, { search, band }) : null), [data, today, search, band]);
  if (!v) return <Skeleton kind="list" />;

  const openPay = r => { setPay(r); setAmount(quickAmount('full', r.owed)); setDate(today); setMethod('Cash'); setErr(''); };
  const msg = pay ? amountMessage(amount, pay.owed) : { text: '', tone: 'dim' };
  const save = async (force = false) => {
    if (busy || !pay) return;
    const vals = { ...blankValues('payments', { data, today, existing: null, preset: null }), rentalId: pay.id, amount, date, method, note: '' };
    const ctx = { data, today, existing: null, preset: null }, chk = checkForm('payments', vals, ctx);
    if (!chk.ok) { setErr(chk.errors.amount || chk.errors.date || chk.errors.rentalId || 'Check the payment.'); return; }
    if (!force && isDuplicate(data.payments, pay.id, Number(amount), parseDate(date, today))) { Alert.alert('Same payment already recorded', 'A payment with this amount and date is already on this rental.', [{ text: 'Go back', style: 'cancel' }, { text: 'Record anyway', onPress: () => save(true) }]); return; }
    setBusy(true);
    try { await S.app.records.saveBatch(planSave('payments', vals, ctx).ops); setPay(null); toast(`✓ ${ksh0(Number(amount))} recorded`); await S.refresh(); }
    catch (e) { S.notify(e, 'The payment was not saved'); } finally { setBusy(false); }
  };

  const header = (
    <View>
      <PageHead eyebrow={`${v.total} UNPAID`} title="Overdue payments" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(10), height: tap(48), borderRadius: sc(22), backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingHorizontal: sc(16), marginBottom: sc(12) }}>
        <Icon name="search" size={20} color={t.dim} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search car, client or contract" placeholderTextColor={t.dim} autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search overdue payments" style={{ flex: 1, color: t.ink, fontSize: sc(16), padding: 0 }} />
      </View>
      <ChipRow caption="Late by">{v.bands.map(b => <Chip key={b.id} label={b.label} count={b.count} on={band === b.id} onPress={() => setBand(b.id)} />)}</ChipRow>
      <StatsStrip items={[['OWED', kshShort(v.owed)], ['RENTALS', String(v.rows.length)], ['OLDEST', v.rows.length ? plural(v.oldest, 'day') : '0 days']]} />
    </View>
  );
  return (
    <>
      <FlatList data={v.rows} keyExtractor={r => String(r.id)} contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }} keyboardShouldPersistTaps="handled" ListHeaderComponent={header}
        ListEmptyComponent={<T size={14.5} tone="dim" align="center" style={{ padding: sc(28) }}>{v.total ? 'No records match.' : 'Nothing is overdue. Every returned rental is paid up.'}</T>}
        renderItem={({ item: r }) => (
          <Card style={{ marginBottom: sc(10) }}>
            <Row last onPress={() => openRecord(S, { list: 'rentals', id: r.id, title: `${r.reg} · ${r.client}` })} title={`${r.reg} · ${r.client}`} sub={`Due ${dsh(r.due)}${r.contract ? ` · ${r.contract}` : ''}`}
              right={<><T size={15} weight="700" mono tone="red">{ksh0(r.owed)}</T><Badge text={`${plural(r.late, 'day')} late`} kind="bad" /></>} />
            <View style={{ flexDirection: 'row', paddingTop: sc(8) }}><Btn go label="Record payment" icon="plus" onPress={() => openPay(r)} /></View>
          </Card>
        )} />
      <Sheet visible={!!pay} onClose={() => !busy && setPay(null)} footer={<><Btn label="Cancel" onPress={() => setPay(null)} disabled={busy} /><Btn go label={busy ? 'Saving' : 'Save payment'} disabled={busy} onPress={() => save(false)} /></>}>
        {pay ? (
          <View>
            <T size={21} weight="700">Record payment</T>
            <T size={14} tone="dim" style={{ marginTop: sc(4), marginBottom: sc(14) }}>{pay.reg} · {pay.client}. Still owed {ksh0(pay.owed)}.</T>
            <Field label="Amount received (KSh)" required grow={false}>
              <View style={{ height: tap(52), borderRadius: sc(14), backgroundColor: t.card2, borderWidth: 1, borderColor: msg.tone === 'red' || err ? t.red : t.line, paddingHorizontal: sc(16), justifyContent: 'center' }}>
                <TextInput value={amount} onChangeText={x => { setAmount(x); setErr(''); }} keyboardType="decimal-pad" accessibilityLabel="Amount received" style={{ color: t.ink, fontSize: sc(16), padding: 0 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: sc(8), marginTop: sc(8) }}><Chip label="Full" on={amount === quickAmount('full', pay.owed)} onPress={() => setAmount(quickAmount('full', pay.owed))} /><Chip label="Half" on={amount === quickAmount('half', pay.owed)} onPress={() => setAmount(quickAmount('half', pay.owed))} /></View>
              {err || msg.text ? <T size={13.5} tone={err ? 'red' : msg.tone} style={{ marginTop: sc(6) }}>{err || msg.text}</T> : null}
            </Field>
            <Field label="Date" grow={false}>
              <View style={{ height: tap(52), borderRadius: sc(14), backgroundColor: t.card2, borderWidth: 1, borderColor: t.line, paddingHorizontal: sc(16), justifyContent: 'center' }}>
                <TextInput value={date} onChangeText={x => { setDate(x); setErr(''); }} onBlur={() => { const d = parseDate(date, today); if (d) setDate(d); }} accessibilityLabel="Date" autoCorrect={false} style={{ color: t.ink, fontSize: sc(16), padding: 0 }} />
              </View>
            </Field>
            <Field label="Method" grow={false}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sc(8) }}>{METHODS_LIST.map(m => <Chip key={m} label={m} on={method === m} onPress={() => setMethod(m)} />)}</View></Field>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
