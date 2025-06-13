// components/FeedScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  Text
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function FeedScreen() {
  const t = useTheme();
  const [posts, setPosts] = useState([]);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);
  const isFocused = useIsFocused();

  // Sync ref
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Enable silent mode playback
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      } catch (e) {
        console.warn('Audio mode error:', e);
      }
    })();
  }, []);

  // Fetch posts on focus
  useEffect(() => {
    if (isFocused) fetchFeedPosts();
    return unloadSound;
  }, [isFocused]);

  async function fetchFeedPosts() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;
    const uid = user.id;

    const { data: follows } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', uid);
    const ids = follows.map(f => f.followed_id);
    ids.push(uid);

    const { data: feedPosts } = await supabase
      .from('posts')
      .select('*')
      .in('user_id', ids)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPosts(feedPosts);
  }

  async function unloadSound() {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }

  async function playSoundAtIndex(index) {
    if (index < 0 || index >= postsRef.current.length) return;
    const uri = postsRef.current[index].audio_url;
    if (!uri) return;

    if (soundRef.current) await unloadSound();

    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;

    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isPlaying) {
        setPlayingIndex(index);
        setIsPlaying(true);
      } else if (!status.isPlaying && !status.isBuffering) {
        setPlayingIndex(null);
        setIsPlaying(false);
      }
    });
  }

  function togglePlayPause(index) {
    if (playingIndex === index && isPlaying) {
      soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      playSoundAtIndex(index);
    }
  }

  const renderItem = ({ item, index }) => (
    <View style={styles.page}>
      <Text style={styles.audioLabel}>▶ @{item.user_id}'s Post</Text>
      <Text style={styles.url}>{item.audio_url}</Text>
      <Win95Button
        title={playingIndex === index && isPlaying ? '❚❚' : '▶'}
        onPress={() => togglePlayPause(index)}
      />
    </View>
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    page: {
      height: SCREEN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
      padding: t.spacing.md
    },
    audioLabel: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      marginBottom: t.spacing.sm
    },
    url: {
      color: t.colors.accentBlue,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.caption,
      marginBottom: t.spacing.md,
      textAlign: 'center'
    }
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * i, index: i })}
      />
    </View>
  );
}
