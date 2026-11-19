/* The logo, at any size: the picture in logo.js, or a drawn mark until there is one. */
import { Image, Text, View } from 'react-native';
import { useTheme } from './session.js';
import { LOGO } from './logoAsset.js';

export default function Logo({ size = 120 }) {
  const t = useTheme();
  if (LOGO) return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.22 }} resizeMode="contain" accessibilityLabel="FleetPilot logo" />;
  return (
    <View accessibilityLabel="FleetPilot logo" style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size / 14, borderColor: t.amber, alignItems: 'center', justifyContent: 'center', backgroundColor: t.panel }}>
      <Text style={{ color: t.amber, fontSize: size * 0.5, fontWeight: '800' }}>F</Text>
    </View>
  );
}
