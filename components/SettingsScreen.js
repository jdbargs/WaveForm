// SettingsScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const AVAILABLE_COLORS = [
  '#FFFFFF', '#F8F8F8', '#FFCDD2', '#F8BBD0', '#E1BEE7',
  '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB'
];

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.label, { color: theme.colors.text }]}>
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
