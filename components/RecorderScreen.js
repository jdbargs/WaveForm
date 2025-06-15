import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
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
  const [postName, setPostName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Cleanup audio playback
  useEffect(() => {
    return () => sound?.unloadAsync();
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
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
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
      if (uri) setLastUri(uri);
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
      let sourceUri, name;
      if (result.assets && result.assets.length > 0) {
        sourceUri = result.assets[0].uri;
        name = result.assets[0].name;
      } else if (result.type === 'success' && result.uri) {
        sourceUri = result.uri;
        name = result.name;
      } else {
        return;
      }
      const destUri = FileSystem.documentDirectory + name;
      let newUri;
      if (sourceUri.startsWith('file://')) {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        newUri = destUri;
      } else {
        const { uri } = await FileSystem.downloadAsync(sourceUri, destUri);
        newUri = uri;
      }
      setLastUri(newUri);
    } catch (err) {
      console.error('File pick error:', err);
      alert('Failed to pick file.');
    }
  }

  // Play the last recorded or selected file
  // Toggle playback: play, pause, or resume
  async function handleTogglePlayback() {
    if (!lastUri) {
      alert('Nothing to play.');
      return;
    }

    let uriToPlay = lastUri;

    // If it's a remote URL, download to local first
    if (lastUri.startsWith('http')) {
      const filename = lastUri.split('/').pop();
      const localUri = FileSystem.documentDirectory + filename;

      try {
        // only download if not already cached
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
          await FileSystem.downloadAsync(lastUri, localUri);
        }
        uriToPlay = localUri;
      } catch (err) {
        console.error('Download for playback failed:', err);
        alert('Could not download file for playback.');
        return;
      }
    }

    // Now toggle play/pause on the local file
    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await sound.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: uriToPlay },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
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
  if (!postName.trim()) {
    alert('Please enter a post name.');
    return;
  }
  setUploading(true);
  try {
    // fetch the local file as a blob to preserve binary integrity
    const response = await fetch(lastUri);
    const blob = await response.blob();

    const filename = `${uuidv4()}.m4a`;
    const { error: uploadError } = await supabase.storage
      .from('audio-posts')
      .upload(filename, blob, { contentType: 'audio/m4a' });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('audio-posts').getPublicUrl(filename);
    const publicURL = data.publicUrl;

    // get user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    // insert post row
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert([{ audio_url: publicURL, user_id: user.id, name: postName }])
      .select();
    if (postError) throw postError;

    alert('Post created successfully!');
    setLastUri(null);
    setPostName('');
  } catch (err) {
    console.error('Upload failed:', err);
    alert('Could not post audio.');
  } finally {
    setUploading(false);
  }
}


  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginTop: '25%',
      padding: t.spacing.md
    },
    icon: { width: 160, height: 160, marginBottom: t.spacing.xl },
    title: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.header * 1.5,
      marginBottom: t.spacing.lg
    },
    input: {
      width: '70%',
      height: 48,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: t.colors.primary,
      paddingHorizontal: t.spacing.sm,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.base,
      color: t.colors.primary,
      marginBottom: t.spacing.xl
    },
    button: { marginVertical: t.spacing.xl, width: '70%' },
    uriText: {
      marginTop: t.spacing.md,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.base,
      color: t.colors.text
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image source={micIcon} style={styles.icon} />
        <Text style={styles.title}>Make a Post!</Text>
        <TextInput
          placeholder="Post name"
          value={postName}
          onChangeText={setPostName}
          style={styles.input}
          placeholderTextColor={t.colors.primary}
        />
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
            title={isPlaying ? 'Pause' : 'Play'}
            onPress={handleTogglePlayback}
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
        {/* URI display for fun */}
        {lastUri && <Text style={styles.uriText}>URI: {lastUri}</Text>}
      </View>
    </SafeAreaView>
  );
}
