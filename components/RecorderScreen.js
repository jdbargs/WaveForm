// components/RecorderScreen.js
// ⚠️ Install expo-document-picker: run `expo install expo-document-picker`

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Buffer } from 'buffer';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

// mic icon asset
const micIcon = require('../assets/images/mic.png');

export default function RecorderScreen() {
  const t = useTheme();
  const [recording, setRecording] = useState(null);
  const [lastUri, setLastUri] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cleanup audio playback
  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  // Start recording audio
  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Start recording error:', err);
      alert('Failed to start recording.');
    }
  }

  // Stop recording audio
  async function stopRecording() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setLastUri(uri);
      }
      setIsRecording(false);
    } catch (err) {
      console.error('Stop recording error:', err);
      alert('Failed to stop recording.');
    }
  }

  // Pick audio file from device
  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.type === 'success' && result.uri) {
        let fileUri = result.uri;
        // Ensure file:// URI
        if (!fileUri.startsWith('file://')) {
          const dest = FileSystem.documentDirectory + result.name;
          await FileSystem.copyAsync({ from: fileUri, to: dest });
          fileUri = dest;
        }
        setLastUri(fileUri);
      }
    } catch (err) {
      console.error('File pick error:', err);
      alert('Failed to pick file.');
    }
  }

  // Play the last recorded or selected file
  async function handlePlay() {
    if (!lastUri) {
      alert('Nothing to play.');
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: lastUri });
      setSound(sound);
      await sound.playAsync();
    } catch (err) {
      console.error('Playback error:', err);
      alert('Playback failed.');
    }
  }

  // Upload audio to Supabase
  async function handleUpload() {
    if (!lastUri) {
      alert('Please record or upload a file first.');
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(lastUri);
      const blob = await response.blob();
      const filename = `${uuidv4()}.m4a`;
      const { error: uploadError } = await supabase.storage
        .from('audio-posts')
        .upload(filename, blob, { contentType: 'audio/m4a', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('audio-posts').getPublicUrl(filename);
      const publicURL = data.publicUrl;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      await supabase.from('posts').insert([{ audio_url: publicURL, user_id: user.id }]);
      alert('Post created successfully!');
      setLastUri(null);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Could not post audio.');
    } finally {
      setUploading(false);
    }
  }

  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: t.spacing.md },
    icon: { width: 160, height: 160, marginBottom: t.spacing.xl },
    title: { color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.header, marginBottom: t.spacing.xl },
    button: { marginVertical: t.spacing.xl, width: '70%' }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image source={micIcon} style={styles.icon} />
        <Text style={styles.title}>Make a Post!</Text>
        <Win95Button
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
          onPress={isRecording ? stopRecording : startRecording}
          style={styles.button}
        />
        <Win95Button
          title="Upload File"
          onPress={pickFile}
          disabled={isRecording || uploading}
          style={styles.button}
        />
        <Win95Button
          title="Play"
          onPress={handlePlay}
          disabled={!lastUri}
          style={styles.button}
        />
        <Win95Button
          title="Post"
          onPress={handleUpload}
          disabled={!lastUri || uploading}
          style={styles.button}
        />
        {uploading && <ActivityIndicator size="large" color={t.colors.text} style={{ marginTop: t.spacing.md }} />}
      </View>
    </SafeAreaView>
  );
}
