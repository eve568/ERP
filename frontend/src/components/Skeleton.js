import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { colors, radius } from '../theme';

/**
 * Bloque de carga con pulso suave. Sin dependencias externas.
 */
export default function Skeleton({ width = '100%', height = 16, style }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: false,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },
});
