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
  onPress?: () => void;
}

function TileImpl({ size, shape, color, strength, theme, current, future, onPress }: Props) {
  const fill = future ? 'transparent' : tileColor(color, strength, theme.empty);
  const ring = current ? theme.text : future ? theme.empty : 'transparent';

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
          name={future ? 'star-outline' : 'star'}
          size={current ? size - 3 : size + 1}
          color={future ? theme.empty : fill}
        />
      </View>
    ) : (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: fill,
          borderRadius: shape === 'circle' ? size / 2 : Math.max(2, size / 5),
          borderWidth: current || future ? 1 : 0,
          borderColor: ring,
        }}
      />
    );

  if (!onPress || future) return body;
  return (
    <Pressable onPress={onPress} hitSlop={2} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}

export const Tile = memo(TileImpl);
