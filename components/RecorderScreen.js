import React, { useState, useEffect, useRef } from 'react';
import { View, Button, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function RecorderScreen() {
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Microphone permission is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

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

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-posts')
        .upload(filename, Buffer.from(base64, 'base64'), {
          contentType: 'audio/m4a',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const publicURL = supabase.storage
        .from('audio-posts')
        .getPublicUrl(filename).data.publicUrl;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      console.log('Insert payload:', {
        audio_url: publicURL,
        user_id: userId,
      });

      const { error: dbError } = await supabase.from('posts').insert([
        {
          audio_url: publicURL,
          user_id: userId,
        },
      ]);

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎙 Record Audio</Text>
      {isRecording ? (
        <Button title="Stop Recording" onPress={stopRecording} color="red" />
      ) : (
        <Button title="Start Recording" onPress={startRecording} />
      )}
      <View style={styles.space} />
      <Button title="Play Last Recording" onPress={playLastRecording} disabled={!recording} />
      <View style={styles.space} />
      {uploading && <ActivityIndicator size="large" color="#fff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    marginBottom: 20,
  },
  space: {
    height: 20,
  },
});
