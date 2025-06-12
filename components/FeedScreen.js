import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState(null);
  const soundRef = useRef(null);

  useEffect(() => {
    fetchPosts();
    return () => {
      unloadSound();
    };
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20); // Fetch first page

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setPosts(data);
    }
    setLoading(false);
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const playSound = async (url) => {
    try {
      await unloadSound();
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      if (index !== playingIndex) {
        setPlayingIndex(index);
        const currentPost = posts[index];
        if (currentPost?.audio_url) {
          playSound(currentPost.audio_url);
        }
      }
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  const renderItem = ({ item }) => (
    <View style={styles.page}>
      <Text style={styles.audioLabel}>🔊 Now playing</Text>
      <Text style={styles.url}>{item.audio_url}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#999" />
        <Text>Loading audio feed...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewRef.current}
      viewabilityConfig={viewConfigRef.current}
      snapToAlignment="start"
      decelerationRate="fast"
      getItemLayout={(data, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
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
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
