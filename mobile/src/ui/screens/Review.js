/* The review list: what the owner should look at. Nothing here is removed by a sync.
   - held       the computer has not added a record yet (something it points to is missing there): Edit it to fix it
   - replaced   a change made here lost against a newer one on the computer: Restore it, Edit it, or keep theirs
   - totals     the phone and the computer disagree on a count or an amount after a sync */

import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Card, Tag, Txt } from '../parts.js';
import RecordEditor from './RecordEditor.js';
import { useSession } from '../session.js';
import { ACTION_LABEL, KIND_LABEL, itemTitle, reviewActions, totalsLines } from '../logic.js';
import { restoreMine } from '../../review.js';

export default function Review() {
  const s = useSession();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);                                // { item, list, record }
  const count = s.status ? s.status.reviewOpen : 0;

  const load = useCallback(async () => { setItems(await s.app.review.open()); }, [s.app]);
  useEffect(() => { load(); }, [load, count]);

  const act = async (item, action) => {
    try {
      if (action === 'edit') {
        const record = await s.app.records.get(item.list, item.recId);
        if (!record) { Alert.alert('That record is not on the phone any more', 'It may have been deleted. Nothing was changed.'); return; }
        setEditing({ item, list: item.list, record });
        return;
      }
      if (action === 'restore') await restoreMine({ records: s.app.records, review: s.app.review }, item);
      else await s.app.review.resolve(item.id);                                // keep the computer's version, or "I have looked"
      await s.refresh();
      await load();
    } catch (e) { s.notify(e, 'That did not work'); }
  };

  const edited = async () => {
    const { item } = editing;
    setEditing(null);
    if (item.kind === 'replaced') await s.app.review.resolve(item.id);        // a held item closes by itself once the computer has it
    await s.refresh();
    await load();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      {items && items.length === 0 && (
        <Card>
          <Txt bold size={16}>Nothing to look at</Txt>
          <Txt tone="dim" style={{ marginTop: 6 }}>
            Records the computer is holding aside, changes of yours that a newer change replaced, and totals that differ after a sync will appear here.
          </Txt>
        </Card>
      )}
      {(items || []).map(item => (
        <Card key={item.id}>
          <Tag text={KIND_LABEL[item.kind] || item.kind} />
          <Txt>{itemTitle(item)}</Txt>
          {item.kind === 'totals' && totalsLines(item.payload).map((line, i) => <Txt key={i} tone="dim" size={13.5} style={{ marginTop: 3 }}>{line}</Txt>)}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {reviewActions(item).map((action, i) => (
              <Button key={action} label={ACTION_LABEL[action]} kind={i === 0 ? 'go' : 'normal'} onPress={() => act(item, action)} />
            ))}
          </View>
        </Card>
      ))}
      <RecordEditor editing={editing} onClose={() => setEditing(null)} onSaved={edited} />
    </ScrollView>
  );
}
