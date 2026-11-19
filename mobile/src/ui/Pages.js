/* The full pages that open from the Account row: Account, Settings, Support, About, Terms of Use, Privacy Policy,
   and the two that arrive later (Profile, Notifications). They are drawn from the v5 Jirani prototype.
   Open the Account page with openAccount(session). */
import { useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from './session.js';
import { useLook, useUI } from './look.js';
import ExcelRestorePanel from './ExcelRestorePanel.js';
import { pickPhoto, deletePhotoFile } from './photos.js';
import { Avatar, Btn, Card, DetailCard, Eyebrow, FieldText, Hint, KV, NavRow, SegSwitch, Slider, T, ToggleRow, VIEW_OPTIONS, useToast } from './kit.js';
import { DEFAULT_Z, MAX_Z, MIN_Z, STEP_Z, zText } from './scale.js';
import { carsLine } from './nav.js';
import legal from './legalTexts.json';

const LOGO = require('../../assets/logo.png');
const VERSION = (Constants.expoConfig && Constants.expoConfig.version) || '0.1.0';
const PHONE = '+254 115 532 658', EMAIL = 'jiranisystem23@gmail.com';

/* ---------- Account ---------- */
function AccountBody() {
  const s = useSession(), look = useLook(), { s: sc } = useUI();
  const cars = s.status && s.status.counts ? s.status.counts.vehicles : 0;
  const profile = look.prefs.profile, photo = look.prefs.photos.profile;
  const initials = profile.name.trim().split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase() || 'MB';
  const open = (title, body, footer) => () => s.openPage({ title, body, footer });
  return (
    <View style={{ flexGrow: 1 }}>
      <Card style={{ padding: sc(16), marginBottom: sc(12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(14) }}>
          <Avatar size={56} initials={initials} source={photo} />
          <View style={{ flex: 1 }}><T size={18} weight="700">{profile.name}</T><T size={13} tone="dim">{carsLine(cars)}</T></View>
        </View>
      </Card>
      <Card flush>
        <NavRow icon="id" title="Profile" sub="Photo, name, phone, monthly card image" onPress={open('Profile', <ProfileBody />)} />
        <NavRow icon="bell" title="Notifications" sub="Alerts, reminders and quiet hours" onPress={() => s.go('notifs')} />
        <NavRow icon="gear" title="Settings" sub="Display size, theme, forms, records view" onPress={open('Settings', <SettingsBody />)} />
        <NavRow icon="file" title="Import / Restore" sub="Restore records from Excel or a phone archive" onPress={open('Import / Restore', <ExcelRestorePanel />)} />
        <NavRow icon="help" title="Support" sub="Help and report a problem" onPress={open('Support', <SupportBody />)} />
        <NavRow icon="file" title="Terms of Use" sub="Read the app terms" onPress={open('Terms of Use', <LegalBody which="terms" />)} />
        <NavRow icon="shield" title="Privacy Policy" sub="How app data and monitoring are handled" onPress={open('Privacy Policy', <LegalBody which="privacy" />)} />
        <NavRow icon="info" title="About" sub="Mbadavi Investment Limited" onPress={open('About', <AboutBody />)} />
        <NavRow icon="file" title="App version" sub={`FleetPilot ${VERSION}`} last />
      </Card>
      <View style={{ flex: 1, minHeight: sc(24) }} />
      <View style={{ alignItems: 'center', paddingTop: sc(24), paddingBottom: sc(12) }}>
        <T size={22} weight="800" tone="gold" spacing={22 * 0.2}>jirani</T>
        <T size={12.5} tone="dim">jirani system · FleetPilot</T>
      </View>
    </View>
  );
}
export const openAccount = s => s.openPage({ title: 'Account', body: <AccountBody /> });

function ProfileBody() {
  const look = useLook(), session = useSession(), toast = useToast(), { s: scale } = useUI();
  const [draft, setDraft] = useState(look.prefs.profile);
  const profilePhoto = look.prefs.photos.profile;
  const initials = draft.name.trim().split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase() || 'MB';

  useEffect(() => setDraft(look.prefs.profile), [look.prefs.profile.name, look.prefs.profile.phone, look.prefs.profile.email]);

  const choosePhoto = async key => {
    try {
      const result = await pickPhoto(key);
      if (!result) return;
      if (result.ok === false) { toast('Allow photo access in the phone settings to add a picture'); return; }
      const previous = look.prefs.photos[key];
      await look.setPhoto(key, result.uri);
      if (previous && previous !== result.uri) await deletePhotoFile(previous);
      toast('Picture saved on this phone');
    } catch (error) { session.notify(error, 'The picture could not be saved'); }
  };
  const removePhoto = async key => {
    const previous = look.prefs.photos[key];
    try {
      await look.clearPhoto(key);
      if (previous) await deletePhotoFile(previous);
      toast('Picture removed');
    } catch (error) { session.notify(error, 'The picture could not be removed'); }
  };
  const save = async () => {
    try { await look.setProfile({ ...draft, name: draft.name.trim() || 'Mbadavi' }); toast('Profile saved'); }
    catch (error) { session.notify(error, 'The profile could not be saved'); }
  };

  return (
    <View>
      <DetailCard title="Profile photo">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(14) }}>
          <Avatar size={64} initials={initials} source={profilePhoto} />
          <View style={{ flex: 1 }}><T size={18} weight="700">{draft.name || 'Mbadavi'}</T><T size={13} tone="dim">Stored on this phone only</T></View>
        </View>
        <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
          <Btn go label={profilePhoto ? 'Change photo' : 'Add photo'} icon="image" onPress={() => choosePhoto('profile')} />
          {profilePhoto ? <Btn label="Remove" onPress={() => removePhoto('profile')} /> : null}
        </View>
      </DetailCard>
      <DetailCard title="Your details">
        <FieldText label="Name" value={draft.name} onChangeText={name => setDraft(current => ({ ...current, name }))} placeholder="e.g. Mbadavi" autoCapitalize="words" />
        <FieldText label="Phone" value={draft.phone} onChangeText={phone => setDraft(current => ({ ...current, phone }))} placeholder="e.g. 0712 345 678" keyboardType="phone-pad" />
        <FieldText label="Email" value={draft.email} onChangeText={email => setDraft(current => ({ ...current, email }))} placeholder="e.g. name@email.com" keyboardType="email-address" autoCapitalize="none" />
        <Btn go label="Save profile" onPress={save} style={{ flex: 0, marginTop: scale(6) }} />
      </DetailCard>
      <DashboardPictureCard title="Monthly dashboard picture" />
    </View>
  );
}

function DashboardPictureCard({ title = 'Dashboard picture' }) {
  const look = useLook(), session = useSession(), toast = useToast(), { s: scale } = useUI();
  const picture = look.prefs.photos.dashboard;
  const choose = async () => {
    try {
      const result = await pickPhoto('dashboard');
      if (!result) return;
      if (result.ok === false) { toast('Allow photo access in the phone settings to add a picture'); return; }
      await look.setPhoto('dashboard', result.uri);
      if (picture) await deletePhotoFile(picture);
      toast('Picture saved on this phone');
    } catch (error) { session.notify(error, 'The picture could not be saved'); }
  };
  const remove = async () => {
    try {
      await look.clearPhoto('dashboard');
      if (picture) await deletePhotoFile(picture);
      toast('Picture removed');
    } catch (error) { session.notify(error, 'The picture could not be removed'); }
  };
  return (
    <DetailCard title={title}>
      {picture ? <Image source={{ uri: picture }} resizeMode="cover" style={{ width: '100%', height: scale(150), borderRadius: scale(16), marginBottom: scale(10) }} accessibilityLabel="Dashboard picture" /> : null}
      <T size={13.5} tone="dim">This picture appears behind the monthly summary on Home. It stays on this phone and is not synced.</T>
      <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
        <Btn go label={picture ? 'Change picture' : 'Add picture'} icon="image" onPress={choose} />
        {picture ? <Btn label="Remove" onPress={remove} /> : null}
      </View>
    </DetailCard>
  );
}

/* ---------- Settings ---------- */
function SettingsBody() {
  const look = useLook(), { s, t } = useUI(), S = useSession();
  const dark = t.name === 'dark';
  return (
    <View>
      <DetailCard title="Appearance">
        <SegSwitch options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} value={dark ? 'dark' : 'light'} onChange={look.setTheme} />
        {look.themeChoice !== 'auto' ? <Btn label="Use the phone's setting" onPress={() => look.setTheme('auto')} style={{ flex: 0, marginTop: s(10) }} /> : <Hint>Follows the phone's light or dark setting until you choose.</Hint>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: s(14) }}>
          <T size={15} weight="700">Display size</T><T size={15} mono>{zText(look.z)}</T>
        </View>
        <Slider min={MIN_Z} max={MAX_Z} step={STEP_Z} value={look.z} onChange={look.previewZoom} onCommit={look.setZoom} label="Display size" />
        <Hint>Smaller shows more on the screen. Larger is easier to read. Default 0.80.</Hint>
        <Btn label="Reset to default" onPress={() => look.setZoom(DEFAULT_Z)} style={{ flex: 0, marginTop: s(12) }} />
      </DetailCard>
      <DetailCard title="Tips">
        <Card flush style={{ shadowOpacity: 0, elevation: 0 }}>
          <ToggleRow icon="bulb" title="First-use tips" sub="Show the Home quick tour automatically" on={look.prefs.guidanceEnabled} onChange={look.setGuidanceEnabled} />
          <NavRow icon="bulb" title="Show every tip again" sub="Start the Home tour over" onPress={() => { look.setTourDone(false); S.go('home'); setTimeout(S.startTour, 500); }} />
          <NavRow icon="hand" title="Replay the quick tour" sub="Five short steps on Home" last onPress={() => { S.go('home'); setTimeout(S.startTour, 500); }} />
        </Card>
      </DetailCard>
      <DetailCard title="Records view">
        <SegSwitch options={VIEW_OPTIONS} value={look.recordsView} onChange={look.setRecordsView} />
        <Hint>The view Rentals, Performance, Reports and Fuel open in. You can still switch on each screen. Default: Summary.</Hint>
      </DetailCard>
      <DetailCard title="Forms">
        <ToggleRow icon="plus" title="Floating Add button" sub="Show a movable Add button on entry forms" on={look.prefs.floatingAddEnabled} onChange={look.setFloatingAddEnabled} last />
        <Hint>Long-press the button to move it to a corner or remove it. Turn it back on here.</Hint>
      </DetailCard>
      <DashboardPictureCard />
      <DetailCard title="Data & sync">
        <Card flush style={{ shadowOpacity: 0, elevation: 0 }}>
          <NavRow icon="file" title="File & Backup" sub="Export, archive, safety backup and desktop sync" last onPress={() => S.go('files')} />
        </Card>
      </DetailCard>
    </View>
  );
}

/* ---------- Support ---------- */
function SupportBody() {
  const s = useSession(), toast = useToast(), { s: sc } = useUI();
  return (
    <View>
      <Card flush style={{ marginBottom: sc(12) }}>
        <NavRow icon="wifi" title="Connecting to the computer" sub="Step-by-step guide" onPress={() => { s.go('connect'); s.setHelpOpen(true); }} />
        <NavRow icon="list" title="Review list" sub="Items that need your check" onPress={() => s.go('review')} last />
      </Card>
      <DetailCard title="Contact support">
        <Card flush style={{ shadowOpacity: 0, elevation: 0 }}>
          <NavRow icon="phone" title="Call" sub={PHONE} onPress={() => Linking.openURL('tel:+254115532658').catch(() => toast('Could not open the phone app'))} />
          <NavRow icon="mail" title="Email" sub={EMAIL} onPress={() => Linking.openURL(`mailto:${EMAIL}`).catch(() => toast('Could not open the email app'))} last />
        </Card>
      </DetailCard>
      <DetailCard title="Report a problem">
        <T size={14.5} tone="dim">This opens an email to Jirani Systems. Say what went wrong and your phone number if you want a call back.</T>
        <Btn go label="Email a report" onPress={() => Linking.openURL(`mailto:${EMAIL}?subject=${encodeURIComponent('FleetPilot problem report')}`).catch(() => toast('Could not open the email app'))} style={{ flex: 0, marginTop: sc(12) }} />
      </DetailCard>
      <Hint center style={{ marginTop: sc(14) }}>Developed by jiranisystem</Hint>
    </View>
  );
}

/* ---------- About ---------- */
function AboutBody() {
  const { s } = useUI();
  return (
    <View>
      <DetailCard>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: '70%', maxWidth: s(260), backgroundColor: '#000', borderRadius: s(16), padding: s(12), alignItems: 'center' }}>
            <Image source={LOGO} style={{ width: '100%', aspectRatio: 284 / 281 }} resizeMode="contain" accessibilityLabel="Mbadavi Investment Limited" />
          </View>
        </View>
      </DetailCard>
      <DetailCard title="FleetPilot">
        <KV items={[['Version', VERSION], ['Works with', 'FleetPilot desktop'], ['Company', 'Mbadavi Investment Limited'], ['Developed by', 'jiranisystem']]} />
      </DetailCard>
    </View>
  );
}

/* ---------- Terms of Use, Privacy Policy (the prototype's text, word for word) ---------- */
function LegalBody({ which }) {
  const doc = legal[which];
  return (
    <View>
      {doc.sections.map((sec, i) => (
        <DetailCard key={i}>
          {sec.eyebrow ? <Eyebrow>{sec.eyebrow}</Eyebrow> : null}
          {sec.title ? <T size={17} weight="700" style={{ marginTop: 6, marginBottom: 8 }}>{sec.title}</T> : null}
          <T size={14.5}>{sec.text}</T>
        </DetailCard>
      ))}
      <Hint>{doc.note}</Hint>
    </View>
  );
}
