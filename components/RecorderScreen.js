// components/RecorderScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

export default function RecorderScreen() {
  const t = useTheme();
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Start recording error:', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stored at:', uri);
      await handleUpload(uri);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const handleUpload = async (uri) => {
    setUploading(true);
    const filename = `${uuidv4()}.m4a`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error("File doesn't exist");

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error: uploadError } = await supabase.storage
        .from('audio-posts')
        .upload(filename, Buffer.from(base64, 'base64'), { contentType: 'audio/m4a', upsert: true });
      if (uploadError) throw uploadError;

      const publicURL = supabase.storage.from('audio-posts').getPublicUrl(filename).data.publicUrl;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      const userId = user.id;
      const { error: dbError } = await supabase.from('posts').insert([{ audio_url: publicURL, user_id: userId }]);
      if (dbError) throw dbError;
      console.log('Insert successful');
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      setRecording(null);
    }
  };

  const playLastRecording = async () => {
    if (!recording) return;
    try {
      const { sound } = await recording.createNewLoadedSoundAsync();
      setSound(sound);
      await sound.playAsync();
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: t.spacing.md
    },
    title: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.header,
      marginBottom: t.spacing.lg
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>🎙 Record Audio</Text>
        {isRecording ? (
          <Win95Button title="Stop Recording" onPress={stopRecording} />
        ) : (
          <Win95Button title="Start Recording" onPress={startRecording} />
        )}
        <View style={{ height: t.spacing.md }} />
        <Win95Button title="Play Last Recording" onPress={playLastRecording} disabled={!recording} />
        <View style={{ height: t.spacing.md }} />
        {uploading && <ActivityIndicator size="large" color={t.colors.text} />}
      </View>
    </SafeAreaView>
  );
}
