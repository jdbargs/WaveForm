import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../lib/supabase';
import ThemedSwitch from './ThemedSwitch';

const AVAILABLE_COLORS = [
  '#0B16B4', '#FFDB58', '#FF6961', '#4B5320', '#800000',
  '#4B0082', '#FFFFFF'
];

export default function SettingsScreen() {
  const { colors, font, setBackgroundColor } = useTheme();

  // Local state for the privacy flag + loading
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dummy, setDummy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) throw userError || new Error('No user in session');

        const { data, error } = await supabase
          .from('users')
          .select('is_private')
          .eq('id', user.id)
          .single();

        if (!error && mounted) {
          setIsPrivate(data.is_private);
        }
      } catch (err) {
        console.error('SettingsScreen fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>        
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>  
      {/* Background-color chooser */}
      <Text style={[styles.label, { color: colors.text, fontFamily: font.family }]}>Choose background color:</Text>
      <View style={styles.swatchRow}>
        {AVAILABLE_COLORS.map(color => {
          const isSelected = color.toLowerCase() === colors.background.toLowerCase();
          return (
            <TouchableOpacity
              key={color}
              onPress={() => setBackgroundColor(color)}
              style={[styles.swatch, { backgroundColor: color }, isSelected && styles.selected]}
            />
          );
        })}
      </View>

      {/* Private-account toggle */}
      <Text style={[styles.label, { color: colors.text, fontFamily: font.family, marginTop: 24 }]}>Private account</Text>
      <ThemedSwitch
        style={styles.switch}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={isPrivate ? colors.primary : colors.border}
        ios_backgroundColor={colors.border}
        value={isPrivate}
        onValueChange={async newVal => {
          try {
            const {
              data: { user },
              error: userError
            } = await supabase.auth.getUser();
            if (userError || !user) throw userError || new Error('No user in session');

            const { error } = await supabase
              .from('users')
              .update({ is_private: newVal })
              .eq('id', user.id);
            if (error) throw error;

            setIsPrivate(newVal);
          } catch (err) {
            console.error('Error setting privacy:', err);
          }
        }}
      />
      {/* DUMMY SWITCH PREVIEW */}
      <Text style={[styles.label, { color: colors.text, fontFamily: font.family, marginTop: 32 }]}>
        Dummy Switch Preview:
      </Text>
      <ThemedSwitch
        value={dummy}
        onValueChange={setDummy}
        trackColor={{ true: '#FF0000', false: '#00FF00' }}
        style={{ alignSelf: 'flex-start', marginTop: 8 }}
      />
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
    marginBottom: 24,
  },
  swatch: {
    width: 40,
    height: 40,
    margin: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 0,
  },
  selected: {
    borderColor: colors => colors.text, // dynamic border
  },
  switch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
    marginTop: 8,
  },
});
