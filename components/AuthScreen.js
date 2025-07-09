// components/AuthScreen.js
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';

export default function AuthScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign In Error', error.message);
    }
  };

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else {
      Alert.alert('Almost there!', 'Check your email to confirm signup.');
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.background
    },
    container: {
      flex: 1,
      padding: t.spacing.md,
      justifyContent: 'center',
      alignItems: 'center'
    },
    boombox: {
      width: 120,
      height: 120,
      resizeMode: 'contain',
      marginBottom: t.spacing.lg
    },
    title: {
      fontFamily: t.font.family,
      fontSize: t.font.sizes.header,
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: t.spacing.lg
    },
    input: {
      height: t.dimensions.buttonHeight,
      borderWidth: t.border.width,
      borderColor: t.colors.buttonShadow,
      backgroundColor: t.colors.buttonFace,
      color: t.colors.text,
      marginBottom: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      width: '100%'
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: t.spacing.md,
      width: '100%'
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image source={require('../assets/images/boombox.png')} style={styles.boombox} />
        <Text style={styles.title}>Welcome to WaveForm</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={t.colors.background}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={t.colors.background}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <View style={styles.buttonContainer}>
          <Win95Button title="Sign In" onPress={handleSignIn} />
          <Win95Button title="Sign Up" onPress={handleSignUp} />
        </View>
      </View>
    </SafeAreaView>
  );
}
