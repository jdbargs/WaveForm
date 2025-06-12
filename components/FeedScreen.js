// components/FeedScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, Dimensions, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);
  const isFocused = useIsFocused();

  // Keep postsRef in sync to avoid stale closures
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Set up audio mode once
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      } catch (e) {
        console.warn('Audio mode error:', e);
      }
    })();
  }, []);

  // Fetch feed and clean up on focus/unfocus
  useEffect(() => {
    if (isFocused) fetchFeedPosts();
    return () => unloadSound();
  }, [isFocused]);

  async function fetchFeedPosts() {
    // 1. Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) return console.error('Auth error:', userError);
    const uid = userData.user.id;

    // 2. Get list of followed user IDs
    const { data: follows, error: followError } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', uid);
    if (followError) return console.error('Follow fetch error:', followError);

    // 3. Build array of IDs: followed + self
    const ids = follows.map(f => f.followed_id);
    ids.push(uid);

    // 4. Fetch posts from those IDs
    const { data: feedPosts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .in('user_id', ids)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (postsError) return console.error('Posts fetch error:', postsError);

    setPosts(feedPosts);
  }

  async function unloadSound() {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.warn('Unload error:', e);
      }
      soundRef.current = null;
    }
  }

  async function playSoundAtIndex(index) {
    if (index < 0 || index >= postsRef.current.length) return;
    const uri = postsRef.current[index].audio_url;
    if (!uri) return;

    // stop any existing
    if (soundRef.current) await unloadSound();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isPlaying) {
          setPlayingIndex(index);
          setIsPlaying(true);
        } else if (!status.isPlaying && !status.isBuffering) {
          setIsPlaying(false);
          setPlayingIndex(null);
        }
      });
    } catch (e) {
      console.error('Play error:', e);
      setIsPlaying(false);
      setPlayingIndex(null);
    }
  }

  async function pauseSound() {
    if (soundRef.current && isPlaying) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch (e) {
        console.error('Pause error:', e);
      }
    }
  }

  async function togglePlayPause(index) {
    if (playingIndex === index && isPlaying) {
      await pauseSound();
    } else {
      await playSoundAtIndex(index);
    }
  }

  const onViewableItemsChanged = useRef(async ({ viewableItems }) => {
    if (!viewableItems.length) return;
    const idx = viewableItems[0].index;
    if (idx !== playingIndex) {
      await unloadSound();
      await playSoundAtIndex(idx);
    }
  });

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 80 });

  const renderItem = ({ item, index }) => (
    <View style={styles.page}>
      <Text style={styles.audioLabel}>🎧 @{item.user_id}'s Post</Text>
      <Text style={styles.url}>{item.audio_url}</Text>
      <TouchableOpacity
        onPress={() => togglePlayPause(index)}
        style={[
          styles.playPauseButton,
          playingIndex === index && isPlaying ? styles.playingButton : null,
        ]}
      >
        <Text style={styles.playPauseText}>
          {playingIndex === index && isPlaying ? '⏸️' : '▶️'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfig.current}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, i) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * i,
          index: i,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  audioLabel: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 8,
  },
  url: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  playPauseButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  playingButton: {
    backgroundColor: '#1ed760',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 24,
  },
});
