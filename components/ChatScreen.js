// components/ChatScreen.js
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  SafeAreaView,
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';
import { v4 as uuidv4 } from 'uuid';

export default function ChatScreen({ route, navigation }) {
  const t = useTheme();
  const { chatId } = route.params;
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(null);
  const [uploading, setUploading] = useState(false);
  const recordingRef = useRef(null);

  const defaultTabBarStyle = {
    position: 'absolute',
    bottom: t.spacing.sm,
    left: t.spacing.sm,
    right: t.spacing.sm,
    backgroundColor: t.colors.buttonFace,
    borderTopWidth: theme.border.width,
    borderTopColor: t.colors.buttonShadow,
    height: theme.dimensions.buttonHeight * 3,
  };

  useFocusEffect(
    useCallback(() => {
      const tabNav = navigation.getParent();
      tabNav?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => tabNav?.setOptions({ tabBarStyle: defaultTabBarStyle });
    }, [navigation, defaultTabBarStyle])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Win95Button
          title="Back"
          onPress={() => navigation.goBack()}
          style={{ marginLeft: t.spacing.sm }}
        />
      ),
    });
  }, [navigation, t]);

  useEffect(() => {
    supabase.removeAllChannels();
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, users(username)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error && data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        payload => setMessages(prev => [...prev, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chatId]);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      setRecording(recording);
      recordingRef.current = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setUploading(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const blob = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const buf = Buffer.from(blob, 'base64');
      const filename = `${uuidv4()}.caf`;
      const { error: uploadError } = await supabase.storage
        .from('audio-posts')
        .upload(`chats/${chatId}/${filename}`, buf, { upsert: false, contentType: 'audio/caf' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl }, error: urlError } = supabase.storage
        .from('audio-posts')
        .getPublicUrl(`chats/${chatId}/${filename}`);
      if (urlError) throw urlError;
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error('No user');
      await supabase.from('chat_messages').insert([
        { chat_id: chatId, user_id: user.id, content: publicUrl }
      ]);
    } catch (err) {
      console.error('Upload error', err);
    } finally {
      setUploading(false);
      setRecording(null);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.messageRow}>
      <Text style={{
        fontFamily: t.font.family,
        fontSize: t.font.sizes.xl,
        fontWeight: 'bold',
        color: t.colors.text,
        marginRight: t.spacing.sm
      }}>
        {item.users?.username}:
      </Text>
      <Win95Button
        title="▶ Play"
        onPress={async () => {
          const { sound } = await Audio.Sound.createAsync({ uri: item.content });
          await sound.playAsync();
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: t.colors.background }]}> 
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      <View style={[styles.controls, { borderColor: t.colors.buttonShadow }]}> 
        {uploading && <ActivityIndicator size="small" color={t.colors.text} />} 
        {recording ? (
          <Win95Button title="Stop Rec" onPress={stopRecording} />
        ) : (
          <Win95Button title="Rec" onPress={startRecording} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  list: { padding: t => t.spacing.md },
  messageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: t => t.spacing.sm },
  controls: { flexDirection: 'row', justifyContent: 'center', padding: t => t.spacing.md, borderTopWidth: 1 }
});
