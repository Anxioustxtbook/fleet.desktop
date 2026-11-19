/* Skeleton loading: grey shapes that pulse where the content will be, instead of a blank screen.
   <Skeleton kind="list" /> | "cards" | "calendar" | "report". Shapes live in skeletonShapes.js.
   Shows only if loading takes longer than a moment, so quick loads do not flicker. The pulse stops when the phone asks for less motion. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { useTheme } from './session.js';
import { RADIUS } from './theme.js';
import { SHAPES, SKELETON_DELAY_MS } from './skeletonShapes.js';

function usePulse() {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop, off = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (off || reduce) return;
      loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: true }), Animated.timing(v, { toValue: 0.55, duration: 750, useNativeDriver: true })]));
      loop.start();
    }).catch(() => {});
    return () => { off = true; if (loop) loop.stop(); };
  }, [v]);
  return v;
}

export default function Skeleton({ kind = 'list' }) {
  const t = useTheme(), pulse = usePulse(), [show, setShow] = useState(false), shape = SHAPES[kind] || SHAPES.list;
  useEffect(() => { const id = setTimeout(() => setShow(true), SKELETON_DELAY_MS); return () => clearTimeout(id); }, []);
  if (!show) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const bar = (b, k) => <Animated.View key={k} style={{ width: `${b.w}%`, height: b.h, borderRadius: 6, backgroundColor: t.panel3, opacity: pulse }} />;
  const line = (cells, k) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>{cells.map((c, i) => bar(c, i))}</View>;
  const rows = n => Array.from({ length: n }, (_, i) => (
    <View key={i} style={{ marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: t.panel, borderRadius: RADIUS.card, borderWidth: 1, borderColor: t.line }}>{shape.row.map((cells, j) => line(cells, j))}</View>));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ flex: 1, backgroundColor: t.bg, padding: shape.grid || shape.tiles ? 10 : 0, paddingTop: 12 }}>
      {shape.header.length > 0 && <View style={{ marginHorizontal: shape.grid || shape.tiles ? 0 : 12, marginBottom: 4 }}>{shape.header.map((b, i) => bar(b, i))}</View>}
      {shape.grid && Array.from({ length: shape.grid.rows }, (_, r) => <View key={r} style={{ flexDirection: 'row', marginTop: 4 }}>{Array.from({ length: shape.grid.cols }, (_, c) => <Animated.View key={c} style={{ flex: 1, height: shape.grid.h, margin: 1, backgroundColor: t.panel, borderRadius: 4, opacity: pulse }} />)}</View>)}
      {shape.tiles && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -4 }}>{Array.from({ length: shape.tiles }, (_, i) => <View key={i} style={{ width: '50%', padding: 4 }}><Animated.View style={{ height: 62, borderRadius: 12, backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, opacity: pulse }} /></View>)}</View>}
      {shape.row && rows(shape.rows)}
    </View>
  );
}
