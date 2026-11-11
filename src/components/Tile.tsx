import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { tileColor, type Theme } from '../theme';
import type { TileShape } from '../types';

interface Props {
  size: number;
  shape: TileShape;
  color: string;
  /** 0 = nothing logged, 1 = full colour. */
  strength: number;
  theme: Theme;
  current?: boolean;
  future?: boolean;
  /** A missed period that keeps the streak: a planned rest day (faded) or a streak freeze (ice blue). */
  excused?: 'rest' | 'freeze' | null;
  onPress?: () => void;
}

function TileImpl({ size, shape, color, strength, theme, current, future, excused, onPress }: Props) {
  const fill = future
    ? 'transparent'
    : excused === 'freeze'
      ? theme.freezeBg
      : excused === 'rest' && strength <= 0
        ? 'transparent'
        : tileColor(color, strength, theme.empty);
  // Rest days show as an outline; freezes get a border in the freeze colour (and a snowflake when large enough).
  const outline = excused === 'freeze' ? theme.freeze : excused === 'rest' && strength <= 0 ? theme.empty : null;
  const ring = current ? theme.text : future ? theme.empty : (outline ?? 'transparent');

  const body =
    shape === 'star' ? (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size / 2,
          borderWidth: current ? 1 : 0,
          borderColor: ring,
        }}
      >
        <Ionicons
          name={future || excused === 'rest' ? 'star-outline' : excused === 'freeze' ? 'snow' : 'star'}
          size={current ? size - 3 : size + 1}
          color={future ? theme.empty : excused === 'freeze' ? theme.freeze : excused === 'rest' ? theme.empty : fill}
        />
      </View>
    ) : (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: fill,
          borderRadius: shape === 'circle' ? size / 2 : Math.max(2, size / 5),
          borderWidth: current || future || outline ? 1 : 0,
          borderColor: ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {excused === 'freeze' && size >= 16 ? <Ionicons name="snow" size={size - 6} color={theme.freeze} /> : null}
      </View>
    );

  if (!onPress || future) return body;
  return (
    <Pressable onPress={onPress} hitSlop={2} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}

export const Tile = memo(TileImpl);
