// components/SettingsScreen.js
import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';

export default function SettingsScreen() {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
      <Text style={[styles.title, { color: t.colors.text }]}>Settings</Text>
      {/* …your settings UI here… */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
