/* The small picture at the start of a register row: the phone-only photo if there is one, otherwise a car outline (vehicles) or a person outline. */
import { Image, View } from 'react-native';
import { useLook, useUI } from './look.js';
import Icon from './Icon.js';
import { photoKey } from './photos.js';

export const THUMB_ICON = { vehicles: 'car', drivers: 'id', clients: 'users' };
export function photoUri(look, list, id) { const p = look && look.prefs && look.prefs.photos; return p ? p[photoKey(list, id)] || '' : ''; }

export default function Thumb({ list, id, size = 44 }) {
  const look = useLook(), { t, s } = useUI(), d = s(size), uri = photoUri(look, list, id), round = list !== 'vehicles';
  return (
    <View accessibilityElementsHidden style={{ width: d, height: d, borderRadius: round ? d / 2 : s(12), backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: d, height: d }} resizeMode="cover" /> : <Icon name={THUMB_ICON[list] || 'car'} size={size * 0.5} color={t.dim} />}
    </View>
  );
}
