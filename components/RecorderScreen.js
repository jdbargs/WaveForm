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
import { useTheme } from '../theme';
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
  const [isPublic, setIsPublic] = useState(true);  // true = “To share”

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
      // 🔄 switch back into playback mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      });

      const uri = recording.getURI();
      if (uri) setLastUri(uri);
      setIsRecording(false);
    } catch (err) {
      console.error("Stop recording error:", err);
      alert("Failed to stop recording.");
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

  async function handleTogglePlayback() {
    if (!lastUri) {
      alert("Nothing to play.");
      return;
    }

    // 1) Ensure we're in playback mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      });
    } catch (e) {
      console.warn("Audio mode switch failed:", e);
    }

  // 1) If there’s already a sound loaded, just toggle pause/play
  if (sound) {
    const status = await sound.getStatusAsync();
    if (status.isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;          // stop here, don’t unload
    } else {
      await sound.playAsync();
      setIsPlaying(true);
      return;          // resume playback without reloading
    }
  }

    // 2) Unload any previous sound
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (e) {
        console.warn("Error unloading previous sound:", e);
      }
      setSound(null);
      setIsPlaying(false);
    }

    // 3) Create a new Sound and play it
    try {
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri: lastUri },
        { shouldPlay: true }
      );
      console.log("▶ createAsync status:", status);
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate(playbackStatus => {
        console.log("▶ playback status update:", playbackStatus);
        if (playbackStatus.didJustFinish) {
          newSound.unloadAsync().catch(()=>{});
          setSound(null);
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error("❌ Playback error in handleTogglePlayback:", err);
      alert("Playback failed.");
    }
  }



  async function handleUpload() {
    if (!lastUri) {
      alert("Please record or upload a file first.");
      return;
    }
    if (!postName.trim()) {
      alert("Please enter a post name.");
      return;
    }
    setUploading(true);

    // 1) derive extension and filename
    const ext = lastUri.split('.').pop().toLowerCase();           // e.g. "caf" or "m4a"
    const filename = `${uuidv4()}.${ext}`;                        // <— this must run before you upload
    const contentType =
      ext === 'caf' ? 'audio/x-caf'
      : ext === 'm4a' ? 'audio/m4a'
      : `audio/${ext}`;

    try {
      // new code ↓
      // 1) read the file into a Base64 string
      const b64 = await FileSystem.readAsStringAsync(lastUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      // 2) turn that into a binary Buffer
      const fileBuffer = Buffer.from(b64, 'base64');
      // 3) upload the Buffer instead of a Blob
      const { error: uploadError } = await supabase
        .storage
        .from('audio-posts')
        .upload(filename, fileBuffer, { contentType });
      if (uploadError) throw uploadError;

      // 4) get a truly public URL
      const { data: { publicUrl }, error: urlError } = supabase
        .storage
        .from("audio-posts")
        .getPublicUrl(filename);
      if (urlError) throw urlError;

      console.log("Uploaded → publicUrl:", publicUrl);

      // 5) insert post row
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not authenticated");

      const { error: postError } = await supabase
        .from("posts")
        .insert([{ audio_url: publicUrl, user_id: user.id, name: postName, is_public: isPublic }]);
      if (postError) throw postError;

      alert("Post created successfully!");
      setLastUri(null);
      setPostName("");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Could not post audio.");
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
    },
    toggleRow: {
      position: 'absolute',
      top: -50,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      zIndex: 10,
    },
    toggleBtn: {
      borderWidth: 1,
      borderColor: '#000',
      // you can add padding/margins to taste
    },
    selectedToggle: {
      borderWidth: 3,
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* share toggle */}
        <View style={styles.toggleRow}>
          <Win95Button
            title="To share"
            onPress={() => setIsPublic(true)}
            style={[
              styles.toggleBtn,
              isPublic && styles.selectedToggle
            ]}
          />
          <Win95Button
            title="Not to share"
            onPress={() => setIsPublic(false)}
            style={[
              styles.toggleBtn,
              !isPublic && styles.selectedToggle
            ]}
          />
        </View>
        <Image source={micIcon} style={styles.icon} />
        <Text style={styles.title}>Make a Post!</Text>
        <TextInput
          placeholder="Post name"
          value={postName}
          onChangeText={setPostName}
          style={styles.input}
          placeholderTextColor={t.colors.background}
        />
        <Win95Button
          title={isRecording ? 'Stop' : 'Record'}
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
