/* The few building blocks the screens that have not been restyled yet still use (Card, Txt, Button, Tag).
   They now draw in the new look and follow the display size, so those screens change with the rest of the app.
   The full set of new building blocks is in kit.js. */

import { Pressable, Text, View } from 'react-native';
import { useUI } from './look.js';
import { SIZE } from './theme.js';
import { Card as KitCard } from './kit.js';

export function Card({ children, style }) {
  const { s } = useUI();
  return <KitCard style={[{ padding: s(14), marginBottom: s(12) }, style]}>{children}</KitCard>;
}

/* tone: 'normal' | 'dim' | 'faint' | 'bad' | 'ok' | 'amber'; size in points; bold */
export function Txt({ children, tone = 'normal', size = 15, bold, mono, style, ...rest }) {
  const { t, s, mono: monoFont } = useUI();
  const color = { normal: t.ink, dim: t.dim, faint: t.dim, bad: t.red, ok: t.green, amber: t.goldt }[tone];
  return (
    <Text style={[{ color, fontSize: s(size), lineHeight: Math.round(s(size) * 1.4), fontWeight: mono ? undefined : (bold ? '700' : '400'), fontFamily: mono ? monoFont(!!bold) : undefined }, style]} {...rest}>
      {children}
    </Text>
  );
}

/* kind: 'normal' | 'go' (the main action, gold) | 'warn' */
export function Button({ label, onPress, kind = 'normal', disabled, style }) {
  const { t, s, tap } = useUI();
  const look = {
    normal: { bg: t.card2, border: t.line, text: t.ink },
    go: { bg: t.gold, border: t.gold, text: t.onfab },
    warn: { bg: t.card, border: t.orange, text: t.orange }
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: look.bg, borderColor: look.border, borderWidth: 1, borderRadius: s(SIZE.radius.button),
        paddingVertical: s(12), paddingHorizontal: s(16), alignItems: 'center', justifyContent: 'center', minHeight: tap(SIZE.button),
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1
      }, style]}>
      <Text style={{ color: look.text, fontSize: s(16), fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ text }) {
  const { t, s } = useUI();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: t.card2, borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: s(2), marginBottom: s(6) }}>
      <Text style={{ color: t.dim, fontSize: s(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: s(0.4) }}>{text}</Text>
    </View>
  );
}
