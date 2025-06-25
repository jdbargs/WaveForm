// SettingsScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const AVAILABLE_COLORS = [
  '#0B16B4', '#FFDB58', ' #FF6961', '#4B5320', '#800000',
  '#4B0082', '#FFFFFF'
];

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontFamily: theme.font.family,    // ← here’s the font
          },
        ]}
      >
        Choose background color:
      </Text>
      <View style={styles.swatchRow}>
        {AVAILABLE_COLORS.map(color => {
          const isSelected = color.toLowerCase() === theme.colors.background.toLowerCase();
          return (
            <TouchableOpacity
              key={color}
              onPress={() => theme.setBackgroundColor(color.trim())}
              style={[
                styles.swatch,
                { backgroundColor: color.trim() },
                isSelected && styles.selected,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 12,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatch: {
    width: 40,
    height: 40,
    margin: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: '#000000',
  },
});
