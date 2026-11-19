/* The view-only screens (Calendar, Performance, Reports) keep their menu place; their content comes after the entry forms. */

import { ScrollView } from 'react-native';
import { Card, Txt } from '../parts.js';
import { MENU, MENU_ADMIN } from '../logic.js';
import { ARRIVES, LABELS } from '../nav.js';
import { useSession } from '../session.js';

export default function Placeholder() {
  const s = useSession();
  const item = [...MENU, ...MENU_ADMIN].find(m => m.id === s.screen);
  const count = item && item.list && s.status && s.status.counts ? s.status.counts[item.list] || 0 : undefined;
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Txt bold size={17}>{item ? item.label : (LABELS[s.screen] || '')}</Txt>
        {count != null && <Txt tone="dim" style={{ marginTop: 4 }}>{count} on this phone</Txt>}
        <Txt tone="dim" style={{ marginTop: 10 }}>
          {item && item.viewOnly
            ? 'This screen will show the same figures as the computer, for looking only. '
            : (ARRIVES[s.screen] ? `This screen arrives in ${ARRIVES[s.screen]} of the rebuild.` : 'This screen is not on the phone yet.')}
        </Txt>
      </Card>
    </ScrollView>
  );
}
