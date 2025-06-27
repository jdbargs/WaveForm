import React from 'react';
import { StyleSheet, Switch } from 'react-native';
import { useTheme } from '../theme';

/**
 * A themed, reusable Switch component.
 *
 * Props:
 *  - value: boolean
 *  - onValueChange: (newVal: boolean) => void
 *  - style?: any (additional container styles)
 *  - trackColor?: { false?: string; true?: string }
 *  - thumbColor?: string
 *  - iosBackgroundColor?: string
 *  - any other Switch props
 */
export default function ThemedSwitch({
  value,
  onValueChange,
  style,
  trackColor = {},
  thumbColor,
  iosBackgroundColor,
  ...rest
}) {
  const { colors } = useTheme();

  const computedTrackColor = {
    false: trackColor.false ?? colors.border,
    true:  trackColor.true  ?? colors.primary,
  };

  const computedThumbColor = thumbColor ?? (value ? colors.primary : colors.border);
  const computedIosBackground = iosBackgroundColor ?? colors.border;

  return (
    <Switch
      style={[styles.switch, style]}
      trackColor={computedTrackColor}
      thumbColor={computedThumbColor}
      ios_backgroundColor={computedIosBackground}
      value={value}
      onValueChange={onValueChange}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  switch: {
    transform: [
      { scaleX: 1.2 },
      { scaleY: 1.2 }
    ],
  },
});
