/* The "?" guide: the four ways to put the phone and the computer on the same network.
   The text is the desktop's own connectHelp.json (one source for both), with its few "this window" words turned around. */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useTheme } from './session.js';
import { Card, Txt } from './parts.js';
import { phoneHelp } from './logic.js';
import rawHelp from './connectHelp.json';

const help = phoneHelp(rawHelp);

export default function ConnectHelp() {
  const s = useSession(), t = useTheme(), insets = useSafeAreaInsets();
  const close = () => s.setHelpOpen(false);
  return (
    <Modal visible={s.helpOpen} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomColor: t.line, borderBottomWidth: 1, backgroundColor: t.panel }}>
          <Text style={{ color: t.ink, fontSize: 19, fontWeight: '700', flex: 1 }}>{help.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close the guide" onPress={close} hitSlop={10}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderColor: t.line, borderWidth: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
          <Txt tone="dim" style={{ marginBottom: 12 }}>{help.intro}</Txt>
          {help.ways.map((way, i) => (
            <Card key={way.id}>
              <Txt bold size={16}>{i + 1}. {way.title}</Txt>
              <Txt tone="dim" size={13.5} style={{ marginTop: 2, marginBottom: 8 }}>{way.needs}</Txt>
              {way.steps.map((step, n) => (
                <View key={n} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  <Txt tone="amber" bold style={{ width: 22 }}>{n + 1}.</Txt>
                  <Txt style={{ flex: 1 }}>{step}</Txt>
                </View>
              ))}
              <Txt tone="dim" size={13.5} style={{ marginTop: 6 }}>How you know it worked: {way.worked}</Txt>
            </Card>
          ))}
          <Card>
            <Txt bold size={16} style={{ marginBottom: 6 }}>If something does not work</Txt>
            {help.ifStuck.map((line, n) => (
              <View key={n} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Txt tone="amber" bold style={{ width: 18 }}>•</Txt>
                <Txt style={{ flex: 1 }}>{line}</Txt>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}
