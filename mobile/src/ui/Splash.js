/* The black logo splash, as the prototype has it: the logo is drawn on a diagonal (corner to corner), a shine sweeps
   across it, the wordmark rises, and when the app is ready (and at least 2.15 s have passed) a circle opens from the
   bottom centre to show the app. Everything is drawn in one SVG so the circle opens the logo and the words too.
   With "reduce motion" the logo simply shows, then fades. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Mask, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FIXED } from './theme.js';
import { SPLASH, exitRadius, logoFrame, polygonPoints, shineFrame, wordFrame } from './splashMotion.js';

const LOGO = require('../../assets/logo.png');
const RATIO = 281 / 284;

export default function Splash({ ready, onDone }) {
  const { width: W, height: H } = useWindowDimensions(), insets = useSafeAreaInsets();
  const [k, setK] = useState({ logo: 0, word: 0, out: 0 }), [reduce, setReduce] = useState(null);
  const started = useRef(Date.now()), finished = useRef(false), exiting = useRef(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => setReduce(false)); }, []);

  /* the intro */
  useEffect(() => {
    if (reduce === null) return undefined;
    if (reduce) { setK({ logo: 1, word: 1, out: 0 }); return undefined; }
    const v = new Animated.Value(0), id = v.addListener(({ value }) => {
      const ms = value;
      setK(prev => ({ ...prev, logo: Math.min(1, Math.max(0, (ms - SPLASH.logoDelay) / SPLASH.logoMs)), word: Math.min(1, Math.max(0, (ms - SPLASH.wordDelay) / SPLASH.wordMs)) }));
    });
    Animated.timing(v, { toValue: SPLASH.wordDelay + SPLASH.wordMs, duration: SPLASH.wordDelay + SPLASH.wordMs, easing: Easing.linear, useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [reduce]);

  /* the exit: when the app is ready and the minimum time has passed */
  useEffect(() => {
    if (!ready || reduce === null || exiting.current) return undefined;
    let timer;
    const go = () => {
      exiting.current = true;
      const v = new Animated.Value(0), id = v.addListener(({ value }) => setK(prev => ({ ...prev, out: value })));
      Animated.timing(v, { toValue: 1, duration: reduce ? 200 : SPLASH.exitMs, easing: Easing.linear, useNativeDriver: false }).start(() => { v.removeListener(id); if (!finished.current) { finished.current = true; onDone && onDone(); } });
    };
    const wait = Math.max(0, SPLASH.minMs - (Date.now() - started.current));
    timer = setTimeout(go, wait);
    return () => clearTimeout(timer);
  }, [ready, reduce, onDone]);

  const LW = SPLASH.logoWidth, LH = LW * RATIO, x0 = (W - LW) / 2, y0 = (H - LH) / 2;
  const lf = logoFrame(k.logo), sh = shineFrame(k.logo), wf = wordFrame(k.word);
  const shineOn = k.logo > 0 && k.logo < 1, r = exitRadius(k.out);
  const baseY = H - 44 - insets.bottom;

  return (
    <View pointerEvents={k.out > 0.98 ? 'none' : 'auto'} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <Svg width={W} height={H}>
        <Defs>
          <Mask id="open" x="0" y="0" width={W} height={H}><Rect x="0" y="0" width={W} height={H} fill="white" /><Circle cx={W / 2} cy={H * 0.9} r={r} fill="black" /></Mask>
          <ClipPath id="reveal"><Polygon points={polygonPoints(lf.points, LW, LH)} /></ClipPath>
          <ClipPath id="band"><Polygon points={polygonPoints(sh, LW, LH)} /></ClipPath>
          <Mask id="logoShape" x="0" y="0" width={LW} height={LH}><SvgImage x="0" y="0" width={LW} height={LH} href={LOGO} preserveAspectRatio="none" /></Mask>
        </Defs>
        <G mask="url(#open)">
          <Rect x="0" y="0" width={W} height={H} fill={FIXED.splash.bg} />
          <G transform={`translate(${x0 + LW / 2} ${y0 + LH / 2}) scale(${lf.scale}) translate(${-LW / 2} ${-LH / 2})`}>
            <SvgImage x="0" y="0" width={LW} height={LH} href={LOGO} preserveAspectRatio="none" clipPath="url(#reveal)" />
            {shineOn ? <G mask="url(#logoShape)"><Rect x="0" y="0" width={LW} height={LH} fill="#FFFFFF" fillOpacity={0.55} clipPath="url(#band)" /></G> : null}
          </G>
          <G opacity={wf.opacity} transform={`translate(0 ${wf.rise})`}>
            <SvgText x={W / 2} y={baseY - 4 - 15 - 6 - 3} fill={FIXED.splash.gold} fontSize="13" fontWeight="700" letterSpacing="1.3" textAnchor="middle">MBADAVI INVESTMENT LIMITED</SvgText>
            <SvgText x={W / 2} y={baseY - 4} fill={FIXED.splash.text} fillOpacity={0.75} fontSize="15" letterSpacing="2.4" textAnchor="middle">jirani</SvgText>
          </G>
        </G>
      </Svg>
    </View>
  );
}
