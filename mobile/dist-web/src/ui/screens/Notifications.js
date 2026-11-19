import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';

function Toggle({ title, line, value, disabled, onChange }) {
  const t = useTheme();
  return (
    <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Txt bold size={14}>{title}</Txt>
        {!!line && <Txt tone="dim" size={12}>{line}</Txt>}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: t.line, true: t.green }} />
    </View>
  );
}

export default function Notifications() {
  const s = useSession(), t = useTheme();
  const settings = s.notificationSettings;
  const [sending, setSending] = useState(false);
  const save = next => s.setNotificationSettings({ ...settings, ...next });
  const test = async () => {
    setSending(true);
    try { await s.testNotification(); s.say('Test notification sent'); }
    catch (error) { Alert.alert('Notification not sent', error.message); }
    finally { setSending(false); }
  };
  const disabled = !settings.enabled || s.app.isWeb;
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <Card>
        <Txt bold size={16}>Allow notifications</Txt>
        <Txt tone="dim" size={12.5} style={{ marginTop: 3 }}>FleetPilot reminders appear in your phone's normal notification tray, even when the app is closed.</Txt>
        <Toggle title="Allow notifications" value={settings.enabled} onChange={enabled => save({ enabled })} />
      </Card>
      <Card>
        <Txt bold size={16}>Tell me when</Txt>
        <View style={{ opacity: disabled ? 0.45 : 1 }}>
          <Toggle title="A car is late" line="When an active rental passes its return time" value={settings.late} disabled={disabled} onChange={late => save({ late })} />
          <Toggle title="A booking is coming up" line="A reminder before the pickup date" value={settings.booking} disabled={disabled} onChange={booking => save({ booking })} />
        </View>
      </Card>
      <Card>
        <Txt bold size={16}>Booking reminder time</Txt>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          {['Evening before', 'Morning of'].map((time, index) => {
            const selected = settings.bookingTime === time;
            return (
              <Pressable key={time} accessibilityRole="button" accessibilityState={{ selected }} disabled={disabled}
                onPress={() => save({ bookingTime: time })}
                style={{ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginRight: index === 0 ? 8 : 0, borderRadius: 18, borderWidth: 1, borderColor: selected ? t.green : t.line, backgroundColor: selected ? t.panel2 : t.panel }}>
                <Txt tone={selected ? 'ok' : 'dim'} bold size={12}>{time}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt tone="dim" size={11.5} style={{ marginTop: 7 }}>Evening before is 18:00. Morning of is 07:30.</Txt>
      </Card>
      <Card>
        <Txt bold size={16}>Sound and vibration</Txt>
        <View style={{ opacity: disabled ? 0.45 : 1 }}>
          <Toggle title="Sound" value={settings.sound} disabled={disabled} onChange={sound => save({ sound })} />
          <Toggle title="Vibrate" value={settings.vibrate} disabled={disabled} onChange={vibrate => save({ vibrate })} />
        </View>
      </Card>
      <Txt tone="dim" size={12} style={{ marginHorizontal: 4, marginBottom: 12 }}>
        Reminders are scheduled on this phone, so they can arrive without a desktop connection. Enable notifications in your phone's system settings if FleetPilot is blocked.
      </Txt>
      <Button label={sending ? 'Sending...' : s.app.isWeb ? 'Test on your phone' : 'Send a test notification'} kind="go" disabled={sending || s.app.isWeb} onPress={test} />
      {s.app.isWeb && <Text style={{ color: t.inkFaint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Native notifications are not available in the browser preview.</Text>}
    </ScrollView>
  );
}
