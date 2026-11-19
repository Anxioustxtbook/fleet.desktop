/* The frame around every screen, in the new navigation (UI_SPEC section 4):
   - the screen, with a gold "Back" link on every screen except Home, and swipes between Home, Rentals and Calendar
   - the 5-slot tab bar: Home, Rentals, the round + button, Calendar, Menu
   - the "Add new" sheet (opens as a circle from the + button) and the grouped Menu sheet
   - full pages that slide in from the right (Account, Settings, ...), closed by the back arrow or a swipe right
   - a small strip at the top while the phone is connecting, copying or syncing (the old bottom bar is gone) */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StatusBar, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useTheme } from './session.js';
import { useLook, useUI } from './look.js';
import { AppReady } from './ready.js';
import Tour, { targetRef } from './Tour.js';
import Icon from './Icon.js';
import { Avatar, GradientBox, NumBadge, Sheet, T, Eyebrow, useReducedMotion } from './kit.js';
import { ADD_TILES, LABELS, MENU_GROUPS, MOTION, TABS, carsLine, isSwipe, swipeAction, swipeDirection } from './nav.js';
import { FIXED, SIZE } from './theme.js';
import { openAccount } from './Pages.js';
import EntryForm from './screens/EntryForm.js';

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

/* ---------- a swipe, for a View ---------- */
function useSwipe(onSwipe) {
  const cb = useRef(onSwipe); cb.current = onSwipe;
  const t0 = useRef(0);
  return useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderGrant: () => { t0.current = Date.now(); },
    onPanResponderRelease: (e, g) => { if (isSwipe(g.dx, g.dy, Date.now() - t0.current + 120)) cb.current(swipeDirection(g.dx)); }
  }).panHandlers, []);
}

/* ---------- a screen coming in: fades in and rises 8 over 0.26 s ---------- */
function ScreenIn({ children }) {
  const reduce = useReducedMotion(), v = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (reduce) { v.setValue(1); return; } v.setValue(0); Animated.timing(v, { toValue: 1, duration: MOTION.screenIn, easing: EASE, useNativeDriver: true }).start(); }, [v, reduce]);
  return <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [MOTION.screenRise, 0] }) }] }}>{children}</Animated.View>;
}

/* ---------- the gold Back link ---------- */
function BackLink() {
  const s = useSession(), { t, s: sc, tap } = useUI();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={s.goBack} hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: sc(4), minHeight: tap(0), marginLeft: sc(10), marginTop: sc(4), paddingRight: sc(10) }}>
      <Icon name="l" size={20} color={t.goldt} /><T size={15} weight="700" tone="gold">Back</T>
    </Pressable>
  );
}

/* ---------- the tab bar ---------- */
function TabIcon({ name, on, color }) {
  const reduce = useReducedMotion(), v = useRef(new Animated.Value(1)).current, was = useRef(on);
  useEffect(() => {
    if (on && !was.current && !reduce) { v.setValue(0.7); Animated.timing(v, { toValue: 1, duration: MOTION.tabPop, easing: Easing.bezier(0.3, 1.6, 0.5, 1), useNativeDriver: true }).start(); }
    was.current = on;
  }, [on, reduce, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}><Icon name={name} size={26} color={color} /></Animated.View>;
}

function TabBar() {
  const s = useSession(), { t, s: sc, tap } = useUI(), insets = useSafeAreaInsets();
  const tab = tb => {
    const on = s.screen === tb.id, color = t.name === 'dark' ? '#FFFFFF' : '#000000';
    return (
      <Pressable key={tb.id} ref={targetRef(tb.id)} accessibilityRole="tab" accessibilityLabel={tb.label} accessibilityState={{ selected: on }} onPress={() => s.go(tb.id)}
        style={{ width: sc(68), minHeight: tap(0), alignItems: 'center', justifyContent: 'center', gap: sc(4) }}>
        <TabIcon name={tb.icon} on={on} color={color} />
        <T size={12} weight="600" tone={color}>{tb.label}</T>
      </Pressable>
    );
  };
  const fab = sc(SIZE.fab);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: t.tab, borderTopWidth: 1, borderTopColor: t.line, paddingTop: sc(10), paddingHorizontal: sc(6), paddingBottom: sc(10) + insets.bottom }}>
      {tab(TABS[0])}{tab(TABS[1])}
      <Pressable ref={targetRef('fab')} accessibilityRole="button" accessibilityLabel="Add" onPress={() => s.openSheet('add')} style={{ marginTop: -sc(SIZE.fabRaise), width: Math.max(fab, 48), height: Math.max(fab, 48) }}>
        <GradientBox colors={[FIXED.fab.from, FIXED.fab.to]} style={{ flex: 1, borderRadius: sc(22), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#F6B94A', shadowOpacity: 0.5, shadowRadius: sc(11), shadowOffset: { width: 0, height: sc(8) }, elevation: 8 }}>
          <T size={42} weight="700" tone="onfab" style={{ lineHeight: sc(46), marginTop: -sc(4) }}>+</T>
        </GradientBox>
      </Pressable>
      {tab(TABS[2])}
      <Pressable ref={targetRef('menu')} accessibilityRole="button" accessibilityLabel="Menu" onPress={() => s.openSheet('menu')} style={{ width: sc(68), minHeight: tap(0), alignItems: 'center', justifyContent: 'center', gap: sc(4) }}>
        <Icon name="menu" size={26} color={t.name === 'dark' ? '#FFFFFF' : '#000000'} /><T size={12} weight="600" tone={t.name === 'dark' ? '#FFFFFF' : '#000000'}>Menu</T>
      </Pressable>
    </View>
  );
}

/* ---------- tiles (4 across) ---------- */
function Tile({ icon, label, on, cur, badge, onPress }) {
  const { t, s: sc, tap } = useUI();
  const bg = on ? t.gold : cur ? t.goldbg : t.card2, fg = on ? t.onfab : cur ? t.goldt : t.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge}` : label} onPress={onPress}
      style={{ width: '24%', backgroundColor: bg, borderRadius: sc(18), paddingTop: sc(14), paddingBottom: sc(11), paddingHorizontal: sc(2), alignItems: 'center', gap: sc(8), minHeight: Math.max(sc(62), tap(0)) }}>
      <Icon name={icon} size={26} color={fg} />
      <T size={12.5} weight="600" tone={fg} align="center" numberOfLines={1}>{label}</T>
      {badge ? <NumBadge n={badge} style={{ top: sc(4), right: sc(4), borderColor: bg }} /> : null}
    </Pressable>
  );
}
const TileGrid = ({ children }) => { const { s: sc } = useUI(); return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: sc(9) }}>{children}</View>; };

/* ---------- the Menu sheet ---------- */
function MenuSheet() {
  const s = useSession(), look = useLook(), { t, s: sc } = useUI();
  const cars = s.status && s.status.counts ? s.status.counts.vehicles : 0, review = s.status ? s.status.reviewOpen : 0;
  const profile = look.prefs.profile, photo = look.prefs.photos.profile;
  const initials = profile.name.trim().split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase() || 'MB';
  return (
    <Sheet visible={s.sheet === 'menu'} onClose={s.closeSheet} draggable>
      <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => { s.closeSheet(); openAccount(s); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: sc(14), backgroundColor: t.card2, borderRadius: sc(24), padding: sc(14), marginBottom: sc(6) }}>
        <Avatar size={56} initials={initials} source={photo} />
        <View><T size={20} weight="700">{profile.name}</T><T size={15} tone="dim">{carsLine(cars)}</T></View>
      </Pressable>
      {MENU_GROUPS.map(g => (
        <View key={g.title}>
          <Eyebrow style={{ marginTop: sc(18), marginHorizontal: sc(4), marginBottom: sc(8) }}>{g.title}</Eyebrow>
          <TileGrid>{g.items.map(([icon, label, id]) => <Tile key={label} icon={icon} label={label} cur={s.screen === id} badge={id === 'review' ? review : 0} onPress={() => s.go(id)} />)}</TileGrid>
        </View>
      ))}
    </Sheet>
  );
}

/* ---------- the Add sheet: a circle opens from the + button, the sheet rises ---------- */
function AddSheet() {
  const s = useSession(), look = useLook(), { t, s: sc } = useUI(), { width: W, height: H } = useWindowDimensions(), insets = useSafeAreaInsets();
  const reduce = useReducedMotion(), [r, setR] = useState(0), [expanded, setExpanded] = useState(false), up = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current, progressValue = useRef(0), startProgress = useRef(0);
  const open = s.sheet === 'add';
  useEffect(() => {
    if (!open) return undefined;
    setExpanded(false); progress.setValue(0); progressValue.current = 0;
    if (reduce) { setR(1100); up.setValue(1); return undefined; }
    setR(0); up.setValue(0);
    const v = new Animated.Value(0), id = v.addListener(({ value }) => setR(1100 * Easing.bezier(0.45, 0.05, 0.35, 1)(value)));
    Animated.timing(v, { toValue: 1, duration: MOTION.addReveal, easing: Easing.linear, useNativeDriver: false }).start();
    Animated.timing(up, { toValue: 1, duration: MOTION.sheetUp, easing: Easing.bezier(0.2, 0.9, 0.25, 1), useNativeDriver: true }).start();
    return () => v.removeListener(id);
  }, [open, reduce, up, progress]);
  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValue.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);
  const snap = value => {
    setExpanded(value === 1);
    Animated.spring(progress, { toValue: value, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.8 }).start();
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { startProgress.current = progressValue.current; },
    onPanResponderMove: (event, gesture) => progress.setValue(Math.max(0, Math.min(1, startProgress.current - gesture.dy / Math.max(1, H * 0.3)))),
    onPanResponderRelease: (event, gesture) => {
      const next = Math.max(0, Math.min(1, startProgress.current - gesture.dy / Math.max(1, H * 0.3)));
      if (startProgress.current < 0.1 && gesture.dy > H * 0.16) { s.closeSheet(); return; }
      snap(next >= 0.5 ? 1 : 0);
    },
    onPanResponderTerminate: () => snap(startProgress.current >= 0.5 ? 1 : 0)
  }), [H, progress, s.closeSheet]);
  const sheetHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [H * 0.57, H * 0.91], extrapolate: 'clamp' });
  if (!open) return null;
  const cy = H - insets.bottom - sc(10) - sc(SIZE.fab) * 0.6;       // about where the + button sits
  return (
    <Modal visible transparent animationType="none" onRequestClose={s.closeSheet} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Defs><Mask id="scrim"><Rect width={W} height={H} fill="black" /><Circle cx={W / 2} cy={cy} r={r} fill="white" /></Mask></Defs>
          <Rect width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#scrim)" />
        </Svg>
        <Pressable accessibilityLabel="Close" onPress={s.closeSheet} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={{ height: sheetHeight, maxHeight: H * 0.94, transform: [{ translateY: up.interpolate({ inputRange: [0, 1], outputRange: [H * 0.5, 0] }) }], backgroundColor: t.card,
            borderTopLeftRadius: sc(SIZE.radius.sheet), borderTopRightRadius: sc(SIZE.radius.sheet), borderTopWidth: 1, borderTopColor: t.line, overflow: 'hidden' }}>
            <Pressable onPress={() => {}} style={{ flex: 1, paddingBottom: insets.bottom }}>
              <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Add sheet. Swipe up to reveal quick notes, swipe down to collapse."
                style={{ minHeight: sc(30), alignItems: 'center', justifyContent: 'center', paddingTop: sc(10), paddingBottom: sc(6) }}>
                <View style={{ width: sc(70), height: sc(5), borderRadius: sc(3), backgroundColor: t.line }} />
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: sc(18), paddingTop: sc(8), paddingBottom: sc(18) }} keyboardShouldPersistTaps="handled">
                <View style={{ paddingBottom: sc(18) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(8), marginTop: sc(6), marginBottom: sc(14) }}>
                    <Icon name="plus" size={20} color={t.goldt} />
                    <T size={21} weight="700">Add new</T>
                  </View>
                  <TileGrid>{ADD_TILES.map((x, i) => <Tile key={x.label} icon={x.icon} label={x.label} on={i === 0} onPress={() => s.openForm(x.request)} />)}</TileGrid>
                  {expanded ? (
                    <View style={{ marginTop: sc(20) }}>
                      <T size={16} weight="700">Quick notes</T>
                      <T size={12.5} tone="dim" style={{ marginTop: sc(3), marginBottom: sc(8) }}>Saved on this phone only.</T>
                      <TextInput value={look.prefs.notes || ''} onChangeText={look.setNotes} multiline maxLength={2000}
                        accessibilityLabel="Quick notes" placeholder="Write a note…" placeholderTextColor={t.dim}
                        style={{ minHeight: sc(112), borderWidth: 1, borderColor: t.line, borderRadius: sc(16), padding: sc(12), backgroundColor: t.card2, color: t.ink, fontSize: sc(15), textAlignVertical: 'top' }} />
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

/* ---------- full pages: slide in from the right (36, 0.22 s), out in 0.15 s ---------- */
function PageHost() {
  const s = useSession(), { t, s: sc, tap } = useUI(), insets = useSafeAreaInsets(), reduce = useReducedMotion();
  const top = s.pages.length ? s.pages[s.pages.length - 1] : null;
  const [view, setView] = useState(null), x = useRef(new Animated.Value(0)).current, key = useRef(0);
  const swipe = useSwipe(dir => { if (dir === 'r') s.closePage(); });
  useEffect(() => {
    if (top) {
      key.current += 1; setView(top);
      if (reduce) { x.setValue(1); return; }
      x.setValue(0); Animated.timing(x, { toValue: 1, duration: MOTION.pageIn, easing: EASE, useNativeDriver: true }).start();
    } else if (view) {
      if (reduce) { setView(null); return; }
      Animated.timing(x, { toValue: 0, duration: MOTION.pageOut, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setView(null));
    }
  }, [top]);                                                       // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return null;
  return (
    <Animated.View {...swipe} pointerEvents={top ? 'auto' : 'none'}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30, backgroundColor: t.bg, paddingTop: insets.top, opacity: x, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [MOTION.pageSlide, 0] }) }] }}>
      <View style={{ height: sc(SIZE.pageHead), flexDirection: 'row', alignItems: 'center', paddingHorizontal: sc(10) }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={s.closePage} style={{ width: tap(44), height: tap(44), alignItems: 'center', justifyContent: 'center' }}><Icon name="l" size={24} /></Pressable>
        <View style={{ flex: 1, marginRight: tap(44) }}><T size={19} weight="700" align="center" numberOfLines={1}>{view.title}</T></View>
      </View>
      <ScrollView key={key.current} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: sc(16), paddingTop: sc(4), paddingBottom: sc(20) + (view.footer ? 0 : insets.bottom) }} keyboardShouldPersistTaps="handled">{view.body}</ScrollView>
      {view.footer ? <View style={{ flexDirection: 'row', gap: sc(12), paddingHorizontal: sc(16), paddingTop: sc(12), paddingBottom: sc(14) + insets.bottom, backgroundColor: t.bg }}>{view.footer}</View> : null}
    </Animated.View>
  );
}

/* ---------- a strip while the phone is connecting, copying or syncing (the old bottom bar showed this) ---------- */
function BusyStrip() {
  const s = useSession(), { t, s: sc } = useUI(), insets = useSafeAreaInsets();
  const on = s.bar.tone === 'sy' || s.bar.tone === 'ask';
  if (!on) return null;
  const ask = s.bar.tone === 'ask';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + sc(6), left: sc(12), right: sc(12), zIndex: 70, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(8), backgroundColor: ask ? t.orangebg : t.card, borderColor: ask ? t.orange : t.line, borderWidth: 1, borderRadius: sc(20), paddingVertical: sc(7), paddingHorizontal: sc(14) }}>
        <View style={{ width: sc(8), height: sc(8), borderRadius: sc(4), backgroundColor: ask ? t.orange : t.gold }} />
        <T size={13} weight="700" tone={ask ? 'orange' : 'ink'} numberOfLines={1}>{s.bar.text}</T>
      </View>
    </View>
  );
}

/* ---------- the frame ---------- */
export default function Shell({ children }) {
  const s = useSession(), t = useTheme(), look = useLook(), appReady = useContext(AppReady);
  const tourDone = !!(look && look.prefs && look.prefs.tourDone), guidanceEnabled = !!(look && look.prefs && look.prefs.guidanceEnabled);
  const idle = s.screen === 'home' && !s.pages.length && !s.sheet && !s.formRequest;
  /* the Home tour starts by itself the first time Home is free (after the splash), once */
  useEffect(() => {
    if (!appReady || !look || !look.ready || !guidanceEnabled || tourDone || s.tourOn || !idle) return undefined;
    const id = setTimeout(s.startTour, 700);
    return () => clearTimeout(id);
  }, [appReady, look, tourDone, guidanceEnabled, s.tourOn, idle, s.startTour]);
  const endTour = () => { s.setTourOn(false); if (look) look.setTourDone(true); };
  const swipe = useSwipe(dir => {
    const a = swipeAction(s.screen, dir, { pageOpen: s.pages.length > 0, sheetOpen: !!s.sheet });
    if (a.type === 'go') s.go(a.id, a.noHistory); else if (a.type === 'menu') s.openSheet('menu'); else if (a.type === 'back') s.goBack();
  });
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.name === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeTop />
      <View style={{ flex: 1 }} {...swipe}>
        <ScreenIn key={s.screen}>
          {s.screen !== 'home' && <BackLink />}
          <View style={{ flex: 1 }}>{children}</View>
        </ScreenIn>
      </View>
      <TabBar />
      <PageHost />
      <MenuSheet />
      <AddSheet />
      <BusyStrip />
      {s.tourOn ? <Tour onDone={endTour} /> : null}
      {!!s.formRequest && <EntryForm request={s.formRequest} onClose={s.closeForm} onSaved={async (r, more) => { if (!more) s.closeForm(); await s.refresh(); }} />}
    </View>
  );
}

function SafeTop() { const insets = useSafeAreaInsets(); return <View style={{ height: insets.top }} />; }
