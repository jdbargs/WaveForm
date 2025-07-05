// ThemedSwitch.js
import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback, Animated } from 'react-native';
import { useTheme } from '../theme';

/**
 * A custom switch component with hard corners.
 *
 * Props:
 * - value: boolean
 * - onValueChange: (newVal: boolean) => void
 * - width?: number (default 50)
 * - height?: number (default 30)
 * - activeTrackColor?: string
 * - inactiveTrackColor?: string
 * - thumbColor?: string
 * - animationDuration?: number (ms) default 200
 * - disabled?: boolean
 * - style?: any (container style override)
 * - ...rest: any other touchable props
 */
export default function ThemedSwitch({
  value,
  onValueChange,
  width = 50,
  height = 30,
  activeTrackColor,
  inactiveTrackColor,
  thumbColor,
  animationDuration = 200,
  disabled = false,
  style,
  ...rest
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: animationDuration,
      useNativeDriver: false,
    }).start();
  }, [value, animationDuration, anim]);

  const thumbSize = height - 4;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, width - thumbSize - 2],
  });

  // Track background colors with theme fallback
  const trackBg = value
    ? activeTrackColor ?? colors.primary ?? '#4cd137'
    : inactiveTrackColor ?? colors.border ?? '#ccc';
  // Thumb background fixed light gray or theme background
  const thumbBg = thumbColor ?? '#CCCCCC';

  return (
    <TouchableWithoutFeedback
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      {...rest}
    >
      <View
        style={[
          styles.track,
          { width, height, backgroundColor: trackBg, borderColor: colors.border },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              backgroundColor: thumbBg,
              transform: [{ translateX }],
              // 3D shaded border like buttons
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderBottomWidth: 2,
              borderRightWidth: 2,
              borderTopColor: colors.background,
              borderLeftColor: colors.background,
              borderBottomColor: colors.border,
              borderRightColor: colors.border,
            },
          ]}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
  },
  thumb: {
    position: 'absolute',
    top: 1,
    left: 0,
    borderRadius: 0,
  },
});
