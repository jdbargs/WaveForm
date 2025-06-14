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

  // viewability for autoplay
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 80 });
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    const idx = viewableItems[0].index;
    if (idx !== playingIndex) {
      unloadSound();
      playSoundAtIndex(idx);
    }
  });

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // silent mode
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      } catch (e) {
        console.warn('Audio mode error:', e);
      }
    })();
  }, []);

  // fetch when focused
  useEffect(() => {
    if (isFocused) fetchFeedPosts();
    return unloadSound;
  }, [isFocused]);

  // fetch posts + waveform
  async function fetchFeedPosts() {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) return;
    const { data: follows = [] } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', uid);
    const ids = follows.map(f => f.followed_id).concat(uid);

    const { data: feedPosts = [] } = await supabase
      .from('posts')
      .select('id, audio_url, waveform, user_id, users(username)')
      .in('user_id', ids)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPosts(feedPosts);
  }

  // unload audio
  async function unloadSound() {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }

  // play by index
  async function playSoundAtIndex(index) {
    if (index < 0 || index >= postsRef.current.length) return;
    const uri = postsRef.current[index].audio_url;
    if (!uri) return;

    await unloadSound();
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
          setPlayingIndex(null);
          setIsPlaying(false);
        }
      });
    } catch (e) {
      console.error('Play error:', e);
    }
  }

  // toggle
  function togglePlayPause(index) {
    if (playingIndex === index && isPlaying) {
      soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      playSoundAtIndex(index);
    }
  }

  // render each post
  const renderItem = ({ item, index }) => {
    const username = item.users?.username || 'Unknown';
    // use existing waveform or generate a random one if missing
    const rawWaveform = Array.isArray(item.waveform) && item.waveform.length
      ? item.waveform
      : Array.from({ length: 50 }, () => Math.random());

    return (
      <View style={styles.page}>
        <Text style={styles.audioLabel}>▶ {username}'s Post</Text>

        {/* Waveform bar graph */}
        <View style={styles.waveformContainer}>
          {rawWaveform.map((amp, i) => (
            <View
              key={i}
              style={{
                width: 2,
                height: (amp || 0) * 40,
                backgroundColor: t.colors.buttonShadow,
                marginHorizontal: 1,
              }}
            />
          ))}
        </View>

        <Win95Button
          title={playingIndex === index && isPlaying ? '❚❚' : '▶'}
          onPress={() => togglePlayPause(index)}
        />
      </View>
    );
  };

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
    waveformContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 40,
      marginBottom: t.spacing.md
    },
    url: {
      color: t.colors.accentBlue,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.caption,
      marginBottom: t.spacing.md,
      textAlign: 'center'
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      padding: t.spacing.md,
      borderTopWidth: 1,
      borderColor: t.colors.buttonShadow
    }
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfig.current}
      />
    </View>
  );
}
