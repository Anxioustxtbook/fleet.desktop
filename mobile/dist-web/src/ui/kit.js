/* The shared building blocks of the new look, drawn as the prototype draws them (docs/reference/..., UI_SPEC.md
   sections 2 and 3). Every size is the prototype's size times the display size.

   Page pieces: Eyebrow, PageHead, Section, RoundBtn, CircleBtn, Hint
   Cards and rows: Card (flush), Row, StatsStrip, MonthHeader, DetailCard + KV, Progress, GradientBox
   Small marks: Badge, Count, Chip, ChipRow, TickBox, Avatar
   Switches: SegSwitch, ViewBar (Summary / Full list), ViewButton, ToggleRow
   Surfaces: Sheet, FormPage, Toast (ToastProvider, useToast)
   Forms: Field, FieldText, FieldPick, FieldSwitch, FieldRow, ChoiceChips, Btn, FooterButtons
   Data: AlertCard, TableCard, CountText */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon.js';
import { useUI } from './look.js';
import { FIXED, SIZE } from './theme.js';

const shadow = (t, s) => ({ shadowColor: t.shadowColor, shadowOpacity: t.shadowOpacity, shadowRadius: s(10), shadowOffset: { width: 0, height: s(6) }, elevation: 3 });
const em = (px, e) => px * e;

/* ---------------------------------------------------------------- text */
/* the one text piece: size in prototype pixels, weight, tone, number font */
export function T({ children, size = 15, weight = '400', tone = 'ink', mono, upper, spacing, style, numberOfLines, align }) {
  const { t, s, mono: monoFont } = useUI();
  const color = { ink: t.ink, dim: t.dim, gold: t.goldt, green: t.green, red: t.red, orange: t.orange, blue: t.blue, onfab: t.onfab, white: '#FFFFFF' }[tone] || tone;
  const bold = weight === '700' || weight === '800';
  return (
    <Text numberOfLines={numberOfLines} style={[{ color, fontSize: s(size), lineHeight: s(size * 1.35), fontWeight: mono ? undefined : weight, fontFamily: mono ? monoFont(bold) : undefined,
      textTransform: upper ? 'uppercase' : undefined, letterSpacing: spacing ? s(spacing) : undefined, textAlign: align }, style]}>
      {children}
    </Text>
  );
}

export const Eyebrow = ({ children, tone = 'dim', style }) => <T size={11} weight="600" tone={tone} upper spacing={em(11, 0.18)} style={style}>{children}</T>;

/* ---------------------------------------------------------------- cards */
export function Card({ children, style, flush, onPress, accent }) {
  const { t, s } = useUI();
  const box = [{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: s(SIZE.radius.card), overflow: 'hidden', ...shadow(t, s),
    ...(accent ? { borderLeftWidth: s(4), borderLeftColor: accent } : null), ...(flush ? null : { padding: s(16) }) }, style];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={box}>{children}</Pressable> : <View style={box}>{children}</View>;
}

/* the soft detail card (.c2): radius 18, a titled box */
export function DetailCard({ title, children, style }) {
  const { t, s } = useUI();
  return (
    <View style={[{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: s(SIZE.radius.panel), padding: s(18), marginBottom: s(12) }, style]}>
      {title ? <View style={{ paddingBottom: s(12), borderBottomWidth: 1, borderBottomColor: t.line, marginBottom: s(14) }}><T size={17} weight="700">{title}</T></View> : null}
      {children}
    </View>
  );
}

/* two columns of "label above value" (.g2); an item is [label, value, tone?] */
export function KV({ items }) {
  const { s } = useUI();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -s(7) }}>
      {items.map((it, i) => (
        <View key={i} style={{ width: '50%', paddingHorizontal: s(7), marginBottom: s(16) }}>
          <T size={15} weight="700">{it[0]}</T>
          <T size={14.5} tone={it[2] || 'dim'} style={{ marginTop: s(4) }}>{it[1]}</T>
        </View>
      ))}
    </View>
  );
}

export function Progress({ pct }) {
  const { t, s } = useUI();
  return <View style={{ height: s(7), borderRadius: s(5), backgroundColor: t.card2, marginTop: s(10), marginBottom: s(8), overflow: 'hidden' }}><View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: s(5), backgroundColor: t.gold }} /></View>;
}

/* a gradient behind children (the + button, the hero card) */
export function GradientBox({ colors, angle = 'v', glow, style, children }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [x2, y2] = angle === 'v' ? ['0', '1'] : ['1', '1'];
  return (
    <View style={style} onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2={x2} y2={y2}>{colors.map((c, i) => <Stop key={i} offset={String(colors.length === 1 ? 0 : i / (colors.length - 1))} stopColor={c} />)}</LinearGradient>
            {glow ? <RadialGradient id="r" cx="85%" cy="70%" rx="45%" ry="55%"><Stop offset="0" stopColor={glow} /><Stop offset="1" stopColor={glow} stopOpacity="0" /></RadialGradient> : null}
          </Defs>
          <Rect width={box.w} height={box.h} fill="url(#g)" />
          {glow ? <Rect width={box.w} height={box.h} fill="url(#r)" /> : null}
        </Svg>
      )}
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- page pieces */
export function PageHead({ eyebrow, title, right }) {
  const { s } = useUI();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: s(16) }}>
      <View style={{ flex: 1, paddingRight: s(10) }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <T size={28} weight="800" spacing={-0.56} style={{ lineHeight: s(31) }}>{title}</T>
      </View>
      {right}
    </View>
  );
}

export function Section({ title, action, onAction, style }) {
  const { s } = useUI();
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s(22), marginBottom: s(10), marginHorizontal: s(4) }, style]}>
      <Eyebrow>{title}</Eyebrow>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}><T size={13} weight="700" tone="gold">{action}</T></Pressable> : null}
    </View>
  );
}

/* the gold round add button (44), or a plain white one with a line round it */
export function RoundBtn({ icon = 'plus', onPress, label = 'Add', plain }) {
  const { t, s, tap } = useUI(), d = tap(SIZE.roundBtn);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [{ width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 },
        plain ? { backgroundColor: t.card, borderColor: t.line, borderWidth: 1 } : { backgroundColor: t.gold, shadowColor: '#F6B94A', shadowOpacity: 0.4, shadowRadius: s(7), shadowOffset: { width: 0, height: s(4) }, elevation: 4 }]}>
      <Icon name={icon} size={22} color={plain ? t.ink : t.onfab} />
    </Pressable>
  );
}

export function CircleBtn({ icon, onPress, label, size = SIZE.circleBtn }) {
  const { t, s, tap } = useUI(), d = tap(size);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

export const Hint = ({ children, tone = 'dim', center, style }) => { const { s } = useUI(); return <T size={13} tone={tone} align={center ? 'center' : undefined} style={[{ marginTop: s(6) }, style]}>{children}</T>; };

/* ---------------------------------------------------------------- marks */
const BADGE = t => ({ ok: [t.greenbg, t.green], bad: [t.redbg, t.red], am: [t.orangebg, t.orange], bl: [t.bluebg, t.blue], gd: [t.goldbg, t.goldt], nt: [t.card2, t.dim] });

export function Badge({ text, kind = 'nt', icon, onPress, style }) {
  const { t, s } = useUI(), [bg, fg] = BADGE(t)[kind] || BADGE(t).nt;
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: s(5), borderRadius: s(SIZE.radius.badge), paddingHorizontal: s(10), paddingVertical: s(4), backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <T size={12.5} weight="700" tone={fg}>{text}</T>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}

/* the round number badge: red by default, orange or blue (.cnt) */
export function Count({ n, kind = 'bad' }) {
  const { t, s } = useUI(), bg = { bad: t.red, am: t.orange, bl: t.blue }[kind];
  return <View style={{ minWidth: s(26), height: s(26), borderRadius: s(13), backgroundColor: bg, paddingHorizontal: s(7), alignItems: 'center', justifyContent: 'center' }}><T size={13} weight="800" tone="white">{n}</T></View>;
}

export function Chip({ label, on, onPress, count }) {
  const { t, s, tap } = useUI();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={{ minHeight: tap(0), justifyContent: 'center', paddingVertical: s(9), paddingHorizontal: s(16), borderRadius: s(SIZE.radius.chip), backgroundColor: on ? t.gold : t.card, borderColor: on ? t.gold : t.line, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
      <T size={14} weight="600" tone={on ? 'onfab' : 'ink'}>{label}</T>
      {count == null ? null : <T size={14} tone={on ? 'onfab' : 'ink'} style={{ opacity: 0.6 }}>{count}</T>}
    </Pressable>
  );
}

/* a row of chips that scrolls sideways, edge to edge, with a small caption in front */
export function ChipRow({ caption, children }) {
  const { s } = useUI();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -s(16), marginBottom: s(12) }} contentContainerStyle={{ paddingHorizontal: s(16), gap: s(8), alignItems: 'center' }}>
      {caption ? <T size={12} weight="600" tone="dim" upper spacing={em(12, 0.08)}>{caption}</T> : null}
      {children}
    </ScrollView>
  );
}

export function TickBox({ on, onPress, label }) {
  const { t, s } = useUI(), d = s(26);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: !!on }} onPress={onPress} hitSlop={12}
      style={{ width: d, height: d, borderRadius: s(8), borderWidth: 2, borderColor: on ? t.gold : t.line, backgroundColor: on ? t.gold : t.card, alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Icon name="check" size={16} color={t.onfab} /> : null}
    </Pressable>
  );
}

/* a round picture, or the person's initials on gold */
export function Avatar({ initials = 'MB', size = 44, source }) {
  const { t, s } = useUI(), d = s(size);
  return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: t.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{source ? <Image source={typeof source === 'string' ? { uri: source } : source} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Profile photo" /> : <T size={size * 0.4} weight="800" tone="onfab">{initials}</T>}</View>;
}

/* ---------------------------------------------------------------- rows */
/* leading: a dot colour (string) or any element; title may be text or elements; right is any element */
export function Row({ dot, leading, title, sub, extra, right, onPress, last }) {
  const { t, s, tap } = useUI();
  const lead = leading || (dot ? <View style={{ width: s(11), height: s(11), borderRadius: s(6), backgroundColor: dot }} /> : null);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), minHeight: tap(0), paddingVertical: s(14), paddingHorizontal: s(16), borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <T size={16.5} weight="700">{title}</T> : title}
        {sub ? <T size={14} tone="dim" style={{ marginTop: s(2) }}>{sub}</T> : null}
        {extra ? (typeof extra === 'string' ? <T size={12.5} tone="dim" style={{ marginTop: s(2) }}>{extra}</T> : extra) : null}
      </View>
      {right ? <View style={{ alignItems: 'flex-end', gap: s(6) }}>{right}</View> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable> : body;
}

/* the soft round icon at the start of a row (.ci) */
export function IconCircle({ name, tone = 'green', size = 38 }) {
  const { t, s } = useUI(), d = s(size);
  const [bg, fg] = { green: [t.greenbg, t.green], gold: [t.goldbg, t.goldt], red: [t.redbg, t.red], orange: [t.orangebg, t.orange], blue: [t.bluebg, t.blue] }[tone];
  return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={20} color={fg} /></View>;
}

/* the strip of totals under the chips; items are [LABEL, value] */
export function StatsStrip({ items }) {
  const { t, s } = useUI();
  return (
    <Card flush style={{ flexDirection: 'row', paddingVertical: s(14), paddingHorizontal: s(4), marginBottom: s(6) }}>
      {items.map((it, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < items.length - 1 ? 1 : 0, borderRightColor: t.line }}>
          <T size={11} weight="600" tone="dim" upper spacing={em(11, 0.1)}>{it[0]}</T>
          <T size={16} weight="700" mono style={{ marginTop: s(4) }}>{it[1]}</T>
        </View>
      ))}
    </Card>
  );
}

export function MonthHeader({ name, count }) {
  const { s } = useUI();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: s(20), marginBottom: s(8), marginHorizontal: s(6) }}>
      <T size={15} weight="700" tone="dim">{name}</T>
      <T size={13} tone="dim">{count}</T>
    </View>
  );
}

/* ---------------------------------------------------------------- switches */
export function SegSwitch({ options, value, onChange, small, style }) {
  const { t, s, tap } = useUI();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: t.card2, borderRadius: s(SIZE.radius.seg), padding: s(5) }, style]}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={String(o.id)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)}
            style={[{ flex: 1, height: tap(small ? 36 : 40), borderRadius: s(small ? 18 : 21), alignItems: 'center', justifyContent: 'center' },
              on ? { backgroundColor: t.gold, shadowColor: '#F6B94A', shadowOpacity: 0.4, shadowRadius: s(6), shadowOffset: { width: 0, height: s(3) }, elevation: 3 } : null]}>
            <T size={15} weight="600" tone={on ? 'onfab' : 'dim'}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export const VIEW_OPTIONS = [{ id: 'sum', label: 'Summary' }, { id: 'desk', label: 'Full list' }];

/* "VIEW  [Summary | Full list]" (.vs) */
export function ViewBar({ value, onChange }) {
  const { s } = useUI();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginBottom: s(12) }}>
      <Eyebrow>View</Eyebrow>
      <View style={{ flex: 1 }}><SegSwitch small options={VIEW_OPTIONS} value={value} onChange={onChange} /></View>
    </View>
  );
}

/* the small pill button that flips between Summary and Full list (.vbtn) */
export function ViewButton({ value, onChange }) {
  const { t, s, tap } = useUI(), desk = value === 'desk';
  return (
    <Pressable accessibilityRole="button" onPress={() => onChange(desk ? 'sum' : 'desk')}
      style={{ height: tap(44), paddingHorizontal: s(14), borderRadius: s(22), backgroundColor: t.card, borderColor: t.line, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      <Icon name={desk ? 'chart' : 'list'} size={18} />
      <T size={13.5} weight="700">{desk ? 'Summary' : 'Full list'}</T>
    </Pressable>
  );
}

/* the on / off switch: 50 x 30, green when on */
export function Switch({ on, onChange, label }) {
  const { t, s } = useUI();
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(x, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: false }).start(); }, [on, x]);
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: !!on }} onPress={() => onChange && onChange(!on)}
      style={{ width: s(50), height: s(30), borderRadius: s(15), backgroundColor: on ? t.green : t.line, justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', left: s(3), width: s(24), height: s(24), borderRadius: s(12), backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.27, shadowRadius: s(2), elevation: 2,
        transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, s(20)] }) }] }} />
    </Pressable>
  );
}

/* a row with a title, a line of help and the switch (.srow) */
export function ToggleRow({ title, sub, icon, on, onChange, last }) {
  const { t, s, tap } = useUI();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!on }} onPress={() => onChange(!on)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), minHeight: tap(0), paddingVertical: s(14), paddingHorizontal: s(16), borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      {icon ? <IconCircle name={icon} tone="gold" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15.5} weight="600">{title}</T>
        {sub ? <T size={13} tone="dim" style={{ marginTop: s(2) }}>{sub}</T> : null}
      </View>
      <Switch on={on} onChange={onChange} label={title} />
    </Pressable>
  );
}

/* ---------------------------------------------------------------- surfaces */
/* the bottom sheet: top corners 28, a 70 x 5 grab bar, up to 92% of the screen */
export function Sheet({ visible, onClose, children, footer, draggable = false }) {
  const { t, s } = useUI(), insets = useSafeAreaInsets(), { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current, progressValue = useRef(0), startProgress = useRef(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (visible && draggable) {
      progress.setValue(0); progressValue.current = 0; setExpanded(false);
    }
  }, [visible, draggable, progress]);
  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValue.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);
  const snap = value => {
    setExpanded(value === 1);
    Animated.spring(progress, { toValue: value, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.8 }).start();
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => draggable && Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { startProgress.current = progressValue.current; },
    onPanResponderMove: (event, gesture) => {
      const next = Math.max(0, Math.min(1, startProgress.current - gesture.dy / Math.max(1, height * 0.24)));
      progress.setValue(next);
    },
    onPanResponderRelease: (event, gesture) => {
      const next = Math.max(0, Math.min(1, startProgress.current - gesture.dy / Math.max(1, height * 0.24)));
      if (startProgress.current < 0.1 && gesture.dy > height * 0.16) { onClose(); return; }
      snap(next >= 0.5 ? 1 : 0);
    },
    onPanResponderTerminate: () => snap(startProgress.current >= 0.5 ? 1 : 0)
  }), [draggable, height, onClose, progress]);
  const sheetHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.68, height * 0.92], extrapolate: 'clamp' });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Animated.View style={[{ maxHeight: '92%', backgroundColor: t.card, borderTopLeftRadius: s(SIZE.radius.sheet), borderTopRightRadius: s(SIZE.radius.sheet), borderTopWidth: 1, borderTopColor: t.line, overflow: 'hidden' }, draggable ? { height: sheetHeight } : null]}>
          <Pressable onPress={() => {}} style={draggable ? { flex: 1 } : { maxHeight: '100%' }}>
            <View {...(draggable ? pan.panHandlers : {})} accessible={draggable} accessibilityRole={draggable ? 'adjustable' : undefined}
              accessibilityLabel={draggable ? 'Menu sheet. Swipe up to expand and down to collapse.' : undefined}>
              <View style={{ width: s(70), height: s(5), borderRadius: s(3), backgroundColor: t.line, alignSelf: 'center', marginTop: s(12), marginBottom: s(6) }} />
            </View>
            <ScrollView style={draggable ? { flex: 1 } : { flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: s(18), paddingTop: s(8), paddingBottom: footer ? s(18) : s(18) + insets.bottom }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={{ flexDirection: 'row', gap: s(12), paddingHorizontal: s(18), paddingTop: s(14), paddingBottom: s(14) + insets.bottom, borderTopWidth: 1, borderTopColor: t.line }}>{footer}</View> : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/* a full page that slides in: a back arrow, a centred title, the body, and a footer of buttons (.ph .pb .pf) */
export function FormPage({ visible, title, onBack, children, footer, floatingAction, overlay }) {
  const { t, s, tap } = useUI(), insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onBack} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <View style={{ height: s(SIZE.pageHead), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(10) }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ width: tap(44), height: tap(44), alignItems: 'center', justifyContent: 'center' }}><Icon name="l" size={24} /></Pressable>
          <View style={{ flex: 1, marginRight: tap(44) }}><T size={19} weight="700" align="center">{title}</T></View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(4), paddingBottom: s(20) }}>{children}</ScrollView>
        {footer ? <View style={{ flexDirection: 'row', gap: s(12), paddingHorizontal: s(16), paddingTop: s(12), paddingBottom: s(14) + insets.bottom, backgroundColor: t.bg }}>{footer}</View> : null}
        {floatingAction}
        {overlay}
      </View>
    </Modal>
  );
}

/* the big button (52 high, radius 14): go = gold, plain = soft */
export function Btn({ label, icon, go, onPress, disabled, style }) {
  const { t, s, tap } = useUI();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ flex: 1, height: tap(SIZE.button), borderRadius: s(SIZE.radius.button), backgroundColor: go ? t.gold : t.card2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {icon ? <Icon name={icon} size={20} color={go ? t.onfab : t.ink} /> : null}
      <T size={16} weight="700" tone={go ? 'onfab' : 'ink'}>{label}</T>
    </Pressable>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

/* a short message near the bottom for 2.3 seconds: wrap the app in <ToastProvider> */
export function ToastProvider({ children }) {
  const { s } = useUI(), [msg, setMsg] = useState(''), op = useRef(new Animated.Value(0)).current, timer = useRef(null);
  const show = useCallback(m => {
    setMsg(m); clearTimeout(timer.current);
    Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 180, useNativeDriver: true }).start(), 2300);
  }, [op]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: s(110), alignItems: 'center', opacity: op }}>
        <View style={{ backgroundColor: FIXED.toast.bg, borderRadius: s(14), paddingVertical: s(12), paddingHorizontal: s(18), maxWidth: '88%' }}><T size={14} weight="600" tone="white">{msg}</T></View>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- forms */
export function Field({ label, required, children, style, grow = true }) {
  const { t, s } = useUI();
  return (
    <View style={[{ marginBottom: s(14), flex: grow ? 1 : undefined }, style]}>
      <View style={{ flexDirection: 'row', marginBottom: s(7) }}>
        <T size={14} tone="dim">{label}</T>{required ? <Text style={{ color: t.gold, fontSize: s(14) }}> *</Text> : null}
      </View>
      {children}
    </View>
  );
}

const box = (t, s, tap) => ({ height: tap(SIZE.field), borderRadius: s(SIZE.radius.field), backgroundColor: t.card2, borderColor: t.line, borderWidth: 1, paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' });

export function FieldText({ label, required, value, onChangeText, placeholder, numeric, error, hint, ...rest }) {
  const { t, s, tap } = useUI();
  return (
    <Field label={label} required={required}>
      <View style={box(t, s, tap)}>
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.dim} keyboardType={numeric ? 'decimal-pad' : 'default'} accessibilityLabel={label}
          style={{ flex: 1, color: t.ink, fontSize: s(16), padding: 0 }} {...rest} />
      </View>
      {error ? <T size={13.5} tone="red" style={{ marginTop: s(6) }}>{error}</T> : hint ? <Hint>{hint}</Hint> : null}
    </Field>
  );
}

/* a field that opens a pick list: shows the choice (or a dim "Choose…") and a chevron */
export function FieldPick({ label, required, value, placeholder = 'Choose…', onPress }) {
  const { t, s, tap } = useUI();
  return (
    <Field label={label} required={required}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={box(t, s, tap)}>
        <T size={16} tone={value ? 'ink' : 'dim'} style={{ flex: 1 }} numberOfLines={1}>{value || placeholder}</T>
        <Icon name="chev" size={20} />
      </Pressable>
    </Field>
  );
}

/* a field that is an On / Off switch: the label and a small On or Off badge */
export function FieldSwitch({ label, on, onChange }) {
  const { t, s, tap } = useUI();
  return (
    <Field label="" style={{ marginBottom: s(14) }}>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!on }} onPress={() => onChange(!on)} style={box(t, s, tap)}>
        <T size={16} style={{ flex: 1 }}>{label}</T><Badge text={on ? 'On' : 'Off'} kind={on ? 'ok' : 'nt'} />
      </Pressable>
    </Field>
  );
}

export const FieldRow = ({ children }) => { const { s } = useUI(); return <View style={{ flexDirection: 'row', gap: s(12) }}>{children}</View>; };

/* a label and a row of chips that wrap: pick one */
export function ChoiceChips({ label, options, value, onChange }) {
  const { s } = useUI();
  return (
    <Field label={label} grow={false}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>{options.map(o => <Chip key={o} label={o} on={o === value} onPress={() => onChange(o)} />)}</View>
    </Field>
  );
}

/* ---------------------------------------------------------------- alerts, tables, counting */
/* the coloured "need attention" card (.alc): a rounded square icon with a number badge, a title, one line, an arrow */
export function AlertCard({ count, title, sub, onPress, level = 'r', pulse = true }) {
  const { t, s } = useUI(), ring = useRef(new Animated.Value(0)).current;
  const col = { r: t.red, o: t.orange, b: t.blue }[level], bg = { r: t.redbg, o: t.orangebg, b: t.bluebg }[level];
  useEffect(() => {
    if (!pulse) return undefined;
    let loop, off = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => { if (off || reduce) return; loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true })); loop.start(); }).catch(() => {});
    return () => { off = true; if (loop) loop.stop(); };
  }, [pulse, ring]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${count} ${title}`} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(14), marginTop: s(14), padding: s(16), borderRadius: s(SIZE.radius.card), backgroundColor: bg, borderWidth: 1, borderColor: level === 'r' ? FIXED.alertBorder : col }}>
      <View style={{ width: s(48), height: s(48) }}>
        {pulse ? <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: s(16), borderWidth: s(5), borderColor: FIXED.pulse, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] }} /> : null}
        <View style={{ flex: 1, borderRadius: s(16), backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}><Icon name="warn9" size={26} color="#FFFFFF" /></View>
        <View style={{ position: 'absolute', top: -s(9), right: -s(9), minWidth: s(24), height: s(24), borderRadius: s(12), paddingHorizontal: s(5), backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: col, alignItems: 'center', justifyContent: 'center' }}><T size={11.5} weight="800" tone={col}>{count}</T></View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}><T size={17} weight="700">{title}</T><T size={13.5} tone="dim" numberOfLines={1}>{sub}</T></View>
      <Icon name="r" size={22} />
    </Pressable>
  );
}

/* the red number badge on a bell or a menu tile (.nb9) */
export function NumBadge({ n, style }) {
  const { t, s } = useUI();
  if (!n) return null;
  return <View style={[{ position: 'absolute', top: -s(5), right: -s(5), minWidth: s(20), height: s(20), paddingHorizontal: s(5), borderRadius: s(10), backgroundColor: t.red, borderWidth: 2, borderColor: t.bg, alignItems: 'center', justifyContent: 'center' }, style]}><T size={11.5} weight="800" tone="white">{n}</T></View>;
}

/* a table that scrolls sideways. head = [[label, isNumber]], rows = arrays of text, total = true makes the last row bold with a line above */
export function TableCard({ head, rows, total, onRow }) {
  const { t, s, mono } = useUI();
  const widths = head.map((h, c) => Math.max(s(56), s(Math.min(220, 28 + 8.2 * Math.max(String(h[0]).length, ...rows.map(r => String(r[c] == null ? '' : r[c]).length))))));
  const sum = widths.reduce((a, b) => a + b, 0), minW = s(620);
  const cell = (c, content, i, isHead, isTotal) => (
    <View key={c} style={{ width: sum < minW ? widths[c] * (minW / sum) : widths[c], paddingHorizontal: s(12), paddingVertical: s(12), justifyContent: 'center' }}>
      <Text numberOfLines={1} style={{ color: isHead ? t.dim : t.ink, fontSize: s(isHead ? 11 : 13.5), fontWeight: isHead ? '400' : isTotal ? '800' : '400', textTransform: isHead ? 'uppercase' : undefined,
        letterSpacing: isHead ? s(11 * 0.08) : undefined, textAlign: head[c][1] ? 'right' : 'left', fontFamily: !isHead && head[c][1] ? mono(isTotal) : undefined }}>{content}</Text>
    </View>
  );
  return (
    <Card flush>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: t.card2, borderBottomWidth: 1, borderBottomColor: t.line }}>{head.map((h, c) => cell(c, h[0], 0, true))}</View>
          {rows.map((r, i) => {
            const isTotal = total && i === rows.length - 1;
            return (
              <Pressable key={i} disabled={!onRow || isTotal} onPress={() => onRow && onRow(i)}
                style={{ flexDirection: 'row', borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: t.line, ...(isTotal ? { backgroundColor: t.card2, borderTopWidth: 2, borderTopColor: t.line } : null) }}>
                {head.map((h, c) => cell(c, r[c] == null ? '' : r[c], i, false, isTotal))}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Card>
  );
}

/* a number that counts up from 0 over 0.9 seconds when the screen opens (skipped when the phone asks for less motion) */
export function CountText({ value, format = n => String(Math.round(n)), delay = 0, ...textProps }) {
  const [shown, setShown] = useState(null), done = useRef(false);
  useEffect(() => {
    let raf, off = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (off || reduce || done.current || !(Number(value) >= 2)) { setShown(value); return; }
      const t0 = Date.now() + delay, D = 900;
      const step = () => { const k = Math.max(0, Math.min(1, (Date.now() - t0) / D)), e = 1 - Math.pow(1 - k, 3); setShown(value * e); if (k < 1 && !off) raf = requestAnimationFrame(step); else done.current = true; };
      step();
    }).catch(() => setShown(value));
    return () => { off = true; if (raf) cancelAnimationFrame(raf); };
  }, [value, delay]);
  return <T {...textProps}>{format(shown == null ? 0 : shown)}</T>;
}


/* ---------------------------------------------------------------- more pieces used by the pages */
/* true when the phone asks for less motion */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { let off = false; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (!off) setReduce(!!v); }).catch(() => {}); return () => { off = true; }; }, []);
  return reduce;
}

/* a row that opens something (.row with a gold round icon, a name, a line under it and an arrow) */
export function NavRow({ icon, title, sub, onPress, last, badge }) {
  const { s, tap } = useUI();
  return (
    <Row last={last} onPress={onPress} leading={<IconCircle name={icon} tone="gold" />} title={<T size={16.5} weight="600">{title}</T>} sub={sub}
      right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), minHeight: tap(0) / 2 }}>{badge ? <Count n={badge} /> : null}{onPress ? <Icon name="r" size={20} /> : null}</View>} />
  );
}

/* the slider for Display size: a track, a gold fill and a round thumb. onChange runs while dragging, onCommit when the finger lifts */
export function Slider({ min, max, step, value, onChange, onCommit, label }) {
  const { t, s, tap } = useUI(), [w, setW] = useState(0);
  const val = useRef(value); val.current = value;
  const width = useRef(0); width.current = w;
  const to = x => { const k = Math.min(1, Math.max(0, x / Math.max(1, width.current))); const raw = min + k * (max - min); return Math.round(Math.min(max, Math.max(min, Math.round(raw / step) * step)) * 100) / 100; };
  const start = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => { start.current = e.nativeEvent.locationX; onChange(to(start.current)); },
    onPanResponderMove: (e, g) => onChange(to(start.current + g.dx)),
    onPanResponderRelease: (e, g) => { const v = to(start.current + g.dx); onChange(v); onCommit && onCommit(v); }
  })).current;
  const k = (value - min) / (max - min), thumb = s(28);
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => { const v = Math.round(Math.min(max, Math.max(min, val.current + (e.nativeEvent.actionName === 'increment' ? step : -step))) * 100) / 100; onChange(v); onCommit && onCommit(v); }}
      onLayout={e => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}
      style={{ height: tap(0), justifyContent: 'center', marginVertical: s(4) }}>
      <View style={{ height: s(6), borderRadius: s(3), backgroundColor: t.line }} />
      <View style={{ position: 'absolute', left: 0, width: k * w, height: s(6), borderRadius: s(3), backgroundColor: t.gold }} />
      <View style={{ position: 'absolute', left: Math.max(0, Math.min(w - thumb, k * w - thumb / 2)), width: thumb, height: thumb, borderRadius: thumb / 2, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: t.gold, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: s(3), elevation: 3 }} />
    </View>
  );
}
