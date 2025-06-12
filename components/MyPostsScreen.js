// components/MyPostsScreen.js
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function MyPostsScreen() {
  const navigation = useNavigation();
  // Set tab label to "My Profile"
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'My Profile' });
  }, [navigation]);

  // Username state
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);

  // Fetch current user and username
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error fetching auth user:', userError);
        return;
      }
      setUserId(user.id);

      // Fetch profile username
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      if (error) {
        console.error('Error fetching username:', error);
      } else {
        setUsername(data.username);
      }
    };
    fetchUser();
  }, []);

  // Save updated username
  const handleUsernameSave = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId);
    if (error) console.error('Error updating username:', error);
  };

  // Posts and audio playback state
  const [posts, setPosts] = useState([]);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);
  const isFocused = useIsFocused();

  // Fetch user's posts
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const fetchPosts = useCallback(async () => {
    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setPosts(data);
    }
  }, [userId]);

  // Reload when screen focused or userId changes
  useEffect(() => {
    if (isFocused && userId) {
      fetchPosts();
    }
  }, [isFocused, userId, fetchPosts]);

  // Play/pause logic
  const handlePlayPause = async (uri, index) => {
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        await soundRef.current.playAsync();
        setPlayingIndex(index);
        setIsPlaying(true);
      } else if (isPlaying && playingIndex === index) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.stopAsync();
        setPlayingIndex(null);
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        await soundRef.current.playAsync();
        setPlayingIndex(index);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Render each post row
  const renderItem = ({ item, index }) => (
    <View style={styles.postRow}>
      <TouchableOpacity
        style={[
          styles.playButton,
          playingIndex === index && isPlaying && styles.playingButton,
        ]}
        onPress={() => handlePlayPause(item.audio_url, index)}
      >
        <Text style={styles.playPauseText}>
          {playingIndex === index && isPlaying ? '❚❚' : '▶'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.postText}>{item.caption}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with editable username and post count */}
      <View style={styles.header}>
        <TextInput
          style={styles.usernameInput}
          value={username}
          onChangeText={setUsername}
          onBlur={handleUsernameSave}
          placeholder="Username"
          placeholderTextColor="#888"
        />
        <Text style={styles.postCount}>{posts.length} posts</Text>
      </View>

      {/* Posts list */}
      <View style={styles.container}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 80 }}
          style={{ height: SCREEN_HEIGHT }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  usernameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    borderBottomColor: '#444',
    borderBottomWidth: 1,
    paddingVertical: 4,
    marginRight: 12,
  },
  postCount: {
    color: '#fff',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  playButton: {
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 24,
    marginRight: 12,
  },
  playingButton: {
    backgroundColor: '#1ed760',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  postText: {
    color: '#fff',
    flex: 1,
    fontSize: 16,
  },
});
