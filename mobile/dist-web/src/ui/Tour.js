/* The Home tour: the screen darkens, a gold ring marks the thing being explained, a card says what it is.
   Targets register their View with targetRef(name); the tour measures them on screen. */
import { createRef, useEffect, useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useUI } from './look.js';
import { Btn, T } from './kit.js';
import { TOUR } from './tourSteps.js';

const refs = {};
export const targetRef = name => refs[name] || (refs[name] = createRef());

export default function Tour({ onDone }) {
  const { t, s: sc } = useUI(), { width: W, height: H } = useWindowDimensions();
  const [i, setI] = useState(0), [rect, setRect] = useState(null), st = TOUR[i], last = i === TOUR.length - 1;
  useEffect(() => {
    setRect(null);
    if (!st.target) return undefined;
    const id = setTimeout(() => { const n = targetRef(st.target).current; if (n && n.measureInWindow) n.measureInWindow((x, y, w, h) => { if (w > 0 && h > 0) setRect({ x, y, w, h }); }); }, 150);
    return () => clearTimeout(id);
  }, [i, st.target]);
  const pad = 6, pos = rect ? (rect.y > H / 2 ? { bottom: H - rect.y + pad + 16 } : { top: rect.y + rect.h + pad + 16 }) : { top: H * 0.3 };
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={{ flex: 1 }}>
        <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Defs><Mask id="tourHole"><Rect width={W} height={H} fill="white" />{rect ? <Rect x={rect.x - pad} y={rect.y - pad} width={rect.w + pad * 2} height={rect.h + pad * 2} rx={20} fill="black" /> : null}</Mask></Defs>
          <Rect width={W} height={H} fill="rgba(8,10,14,0.66)" mask="url(#tourHole)" />
          {rect ? <Rect x={rect.x - pad} y={rect.y - pad} width={rect.w + pad * 2} height={rect.h + pad * 2} rx={20} fill="none" stroke={t.gold} strokeWidth={2} /> : null}
        </Svg>
        <View accessibilityViewIsModal style={[{ position: 'absolute', left: sc(16), right: sc(16), backgroundColor: t.card, borderRadius: sc(20), padding: sc(18) }, pos]}>
          <T size={12} weight="600" tone="dim" upper spacing={0.7}>{`Step ${i + 1} of ${TOUR.length}`}</T>
          <T size={19} weight="700" style={{ marginTop: sc(4), marginBottom: sc(4) }}>{st.title}</T>
          <T size={14.5} style={{ marginBottom: sc(14) }}>{st.body}</T>
          <View style={{ flexDirection: 'row', gap: sc(10) }}>
            <Btn label={last ? 'Close' : 'Skip'} onPress={onDone} />
            <Btn go label={last ? 'Try the swipe' : 'Next'} onPress={() => (last ? onDone() : setI(i + 1))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
