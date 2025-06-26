// components/ChatScreen.js
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  FlatList,
  StyleSheet,
  ScrollView,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';
import { v4 as uuidv4 } from 'uuid';
import profileIcon from '../assets/images/profile.png';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen({ route, navigation }) {
  const t = useTheme();
  const { chatId } = route.params;

  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(null);
  const [uploading, setUploading] = useState(false);
  const recordingRef = useRef(null);

  // for participants dropdown
  const [showUsers, setShowUsers] = useState(false);
  const [participants, setParticipants] = useState([]);

  // for pause toggle
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);


  // hide tab bar on this screen
  const defaultTabBarStyle = {
    position: 'absolute',
    bottom: t.spacing.sm,
    left: t.spacing.sm,
    right: t.spacing.sm,
    backgroundColor: t.colors.buttonFace,
    borderTopWidth: t.border.width,
    borderTopColor: t.colors.buttonShadow,
    height: t.dimensions.buttonHeight * 3,
  };

  // load participant list
  useEffect(() => {
    async function loadUsers() {
      const { data, error } = await supabase
        .from('chat_members')
        .select('users!inner(id, username)')
        .eq('chat_id', chatId);

      if (error) {
        console.error('Error loading participants:', error);
      } else {
        console.log('Raw participant data:', data);
        const list = data.map(d => d.users);
        console.log('Parsed participants:', list);
        setParticipants(list);
      }
    }
    loadUsers();
  }, [chatId]);

  // header back button
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

  // header "who's here" button with logging
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            console.log('Toggling user dropdown, previous state:', showUsers);
            setShowUsers(v => !v);
          }}
          style={{
            padding: 8,
            marginRight: 16,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 4,
          }}
        >
          <Image
            source={profileIcon}
            style={{ width: 24, height: 24, tintColor: t.colors.text }}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t, showUsers]);

  // replace your existing “subscribe & fetch messages” effect with this:
  useEffect(() => {
    supabase.removeAllChannels();

    // move fetchMessages into this scope so we can call it on new inserts
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, users(username), created_at')  // ← include created_at
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    // initial load
    fetchMessages();

    // on every new INSERT, re-fetch the full list
    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`
        },
        () => {
          fetchMessages();  // ← get the real created_at now
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chatId]);


  // recording handlers
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
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
      const blob = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const buf = Buffer.from(blob, 'base64');
      const filename = `${uuidv4()}.caf`;

      const { error: uploadError } = await supabase.storage
        .from('audio-posts')
        .upload(`chats/${chatId}/${filename}`, buf, {
          upsert: false,
          contentType: 'audio/caf'
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl }, error: urlError } =
        supabase.storage
          .from('audio-posts')
          .getPublicUrl(`chats/${chatId}/${filename}`);
      if (urlError) throw urlError;

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error('No user');

      await supabase.from('chat_messages').insert([
        {
          chat_id: chatId,
          user_id: user.id,
          content: publicUrl
        }
      ]);
    } catch (err) {
      console.error('Upload error', err);
    } finally {
      setUploading(false);
      setRecording(null);
    }
  };

  const handlePlayPause = async (message) => {
    // If we’re already playing this message, pause it
    if (playingId === message.id) {
      await sound.pauseAsync();
      setPlayingId(null);
    } else {
      // Otherwise unload any existing sound…
      if (sound) {
        await sound.unloadAsync();
      }
      // …then load & play the new one
      const { sound: newSound } = await Audio.Sound.createAsync({
        uri: message.content
      });
      setSound(newSound);
      setPlayingId(message.id);

      // When it finishes, reset the button
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          setPlayingId(null);
          newSound.unloadAsync();
        }
      });

      await newSound.playAsync();
    }
  };

  const renderItem = ({ item }) => {     
    // NEW — default to '' so includes() never runs on undefined
    const raw = item.created_at ?? '';
    // if it’s "YYYY-MM-DD HH:MM:SS", turn it into an ISO string
    const iso = raw.includes(' ') && !raw.includes('T')
      ? raw.replace(' ', 'T') + 'Z'
      : raw;
    // if iso is empty, Date() will just be "Invalid Date" (no crash)
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const timeString = ` ${hh}:${mm}`;
    const dateString = ` ${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;

    return (
      <View style={styles.messageRow}>
        {/* 1) Username */}
        <Text style={styles.usernameText}>
          {item.users.username}:
        </Text>

        {/* 2) Play/Pause (taller) */}
        <Win95Button
          title={playingId === item.id ? '❚❚ Pause' : '▶ Play'}
          onPress={() => handlePlayPause(item)}
          style={{ height: t.dimensions.buttonHeight * 1.2 }}
        />

        {/* 3) Timestamp stacked in its own column, to the right */}
        <View style={styles.timestampContainer}>
          <Text
            style={[
              styles.timeText,
              { fontSize: t.font.sizes.md }      // ← bump +2px
            ]}    
          >
            {timeString}
          </Text>
          <Text
            style={[
              styles.dateText,
              { fontSize: t.font.sizes.md }      // ← bump +2px
            ]}
          >
            {dateString}
          </Text>
        </View>
      </View>
    );
  };



  const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    list: {},
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      borderTopWidth: 1
    },
    usernameText: {
      fontFamily: t.font.family,
      fontSize: t.font.sizes.xl,
      fontWeight: 'bold',
      color: t.colors.text,
      marginRight: t.spacing.sm
    },
    playContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      marginLeft: t.spacing.sm
    },
    timeText: {
      fontFamily: t.font.family,
      fontSize: t.font.sizes.md,
      color: t.colors.text,
      marginTop: t.spacing.xs
    },
    dateText: {
      fontFamily: t.font.family,
      fontSize: t.font.sizes.md,
      color: t.colors.text
    },
    userDropdown: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 150,

      backgroundColor: t.colors.buttonFace,  
      borderWidth: 1,
      borderColor: t.colors.buttonShadow,   
      borderRadius: 6,
      maxHeight: 150,
      paddingVertical: 4,

      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,

      paddingVertical: 4,
    },
    userItem: {
      backgroundColor: t.colors.buttonFace,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 18,
      fontFamily: t.font.family,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.buttonShadow,
    },
  });

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: t.colors.background }]}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { padding: t.spacing.md }
        ]}
      />

      {showUsers && (
        <View style={[styles.userDropdown, {
          backgroundColor: t.colors.buttonFace,
          borderColor: t.colors.buttonShadow,
        }]}>
          <ScrollView style={{ maxHeight: 150 }}>
            {participants.map(u => (
              <Text
                key={u.id}
                style={[styles.userItem, { color: t.colors.text }]}
              >
                {u.username}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}


      <View
        style={[
          styles.controls,
          {
            padding: t.spacing.md,
            borderTopColor: t.colors.buttonShadow
          }
        ]}
      >
        {uploading && (
          <ActivityIndicator size="small" color={t.colors.text} />
        )}
        {recording ? (
          <Win95Button title="Stop Rec" onPress={stopRecording} />
        ) : (
          <Win95Button title="Rec" onPress={startRecording} />
        )}
      </View>
    </SafeAreaView>
  );
};
