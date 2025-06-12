import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function MyPostsScreen() {
  const [posts, setPosts] = useState([]);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        console.warn('Failed to set audio mode:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (isFocused) fetchUserPosts();
    return () => {
      unloadSound();
    };
  }, [isFocused]);

  const fetchUserPosts = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      console.error('User not authenticated', userError);
      return;
    }

    const userId = userData.user.id;

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user posts:', error);
    } else {
      setPosts(data);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (err) {
        console.warn('Error unloading sound:', err);
      }
      soundRef.current = null;
    }
  };

  const playSoundAtIndex = async (index) => {
    if (index < 0 || index >= posts.length) return;

    const uri = posts[index].audio_url;
    if (!uri) return;

    try {
      if (playingIndex !== null && playingIndex !== index) {
        await unloadSound(); // Stop previous sound before starting new
      }

      if (playingIndex === index && isPlaying) {
        // Already playing this audio
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingIndex(index);
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying && !status.isBuffering) {
          setIsPlaying(false);
          setPlayingIndex(null);
        }
      });
    } catch (err) {
      console.error('Playback error:', err);
      setIsPlaying(false);
      setPlayingIndex(null);
    }
  };

  const pauseSound = async () => {
    if (soundRef.current && isPlaying) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch (err) {
        console.error('Pause error:', err);
      }
    }
  };

  const togglePlayPause = async (index) => {
    if (playingIndex === index && isPlaying) {
      await pauseSound();
    } else {
      await playSoundAtIndex(index);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    const index = viewableItems[0].index;
    if (index === undefined || index < 0 || index >= posts.length) return;
    if (index !== playingIndex) {
      playSoundAtIndex(index);
    }
  });

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 80,
  });

  const renderItem = ({ item, index }) => (
    <View style={styles.page}>
      <Text style={styles.audioLabel}>🎧 Your Post</Text>
      <Text style={styles.url}>{item.audio_url}</Text>
      <TouchableOpacity
        onPress={() => togglePlayPause(index)}
        style={[
          styles.playPauseButton,
          playingIndex === index && isPlaying ? styles.playingButton : null,
        ]}
      >
        <Text style={styles.playPauseText}>
          {playingIndex === index && isPlaying ? 'Pause' : 'Play'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(data, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  audioLabel: {
    color: '#fff',
    fontSize: 22,
    marginBottom: 12,
  },
  url: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  playPauseButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  playingButton: {
    backgroundColor: '#1ed760', // brighter green when playing
  },
  playPauseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
