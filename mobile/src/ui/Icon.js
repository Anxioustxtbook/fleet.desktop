/* One of the prototype's icons, drawn with react-native-svg: the 24 x 24 grid, 1.7 round strokes, in the colour given. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { parseIcon } from './iconParse.js';
import { useTheme, useZ } from './look.js';

const TAGS = { rect: Rect, circle: Circle, path: Path };

/* size is the prototype's size; it is multiplied by the display size unless fixed is true */
export default function Icon({ name, size = 22, color, fixed }) {
  const t = useTheme(), z = useZ(), px = fixed ? size : size * z;
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={color || t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {parseIcon(name).map((sh, i) => { const Tag = TAGS[sh.tag]; return <Tag key={i} {...sh.props} />; })}
    </Svg>
  );
}
