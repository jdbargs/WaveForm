// components/ExploreScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase, followUser, unfollowUser } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function ExploreScreen() {
  const t = useTheme();
  const isFocused = useIsFocused();

  // Search users state
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());

  // Popular posts state
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  // Viewability config and handler for both lists
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 80 });
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    const idx = viewableItems[0].index;
    if (idx !== playingIndex) {
      unloadSound();
      playSoundAtIndex(idx);
    }
  });

  // Keep postsRef in sync
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Audio silent mode
  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }); }, []);

  // Fetch current user and follows
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: followData } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id);
      setFollowingIds(new Set(followData.map(f => f.followed_id)));
    })();
  }, [isFocused]);

  // User search effect
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setUsers([]); return; }
    setLoadingUsers(true);
    const timer = setTimeout(async () => {
      let query = supabase
        .from('users')
        .select('id, username, email')
        .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);
      if (currentUserId) query = query.neq('id', currentUserId);
      const { data, error } = await query;
      if (!error && data) setUsers(data);
      setLoadingUsers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  // Toggle follow/unfollow
  const handleFollowToggle = async (id) => {
    if (!currentUserId) return;
    if (followingIds.has(id)) {
      await unfollowUser(currentUserId, id);
      const s = new Set(followingIds); s.delete(id);
      setFollowingIds(s);
    } else {
      await followUser(currentUserId, id);
      const s = new Set(followingIds); s.add(id);
      setFollowingIds(s);
    }
  };

  // Fetch popular posts
  const fetchPopularPosts = useCallback(async () => {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from('posts')
      .select('id, audio_url, view_count, users(username)')
      .eq('is_active', true)
      .order('view_count', { ascending: false })
      .limit(100);
    if (!error && data) setPosts(data);
    setLoadingPosts(false);
  }, []);

  // Load posts when search is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchPopularPosts();
      return unloadSound;
    }
  }, [isFocused, searchQuery, fetchPopularPosts]);

  // Unload audio
  async function unloadSound() {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }

  // Play sound at index
  async function playSoundAtIndex(index) {
    const uri = postsRef.current[index]?.audio_url;
    if (!uri) return;
    await unloadSound();
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isPlaying) { setPlayingIndex(index); setIsPlaying(true); }
      else if (!status.isPlaying && !status.isBuffering) { setPlayingIndex(null); setIsPlaying(false); }
    });
  }

  // Toggle play/pause
  function togglePlayPause(index) {
    if (playingIndex === index && isPlaying) { soundRef.current.pauseAsync(); setIsPlaying(false); }
    else { playSoundAtIndex(index); }
  }

  // Render user item
  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: t.colors.text, fontFamily: t.font.family }]}>{item.username}</Text>
        <Text style={[styles.email, { color: t.colors.accentBlue, fontFamily: t.font.family }]}>{item.email}</Text>
      </View>
      <Win95Button title={followingIds.has(item.id) ? 'Unfollow' : 'Follow'} onPress={() => handleFollowToggle(item.id)} />
    </View>
  );

  // Render post item
  const renderPost = ({ item, index }) => (
    <View style={[styles.page, { backgroundColor: t.colors.background }]}> 
      <Text style={[styles.label, { color: t.colors.text, fontFamily: t.font.family }]}>▶ {item.users?.username}'s Post ({item.view_count} views)</Text>
      <Win95Button title={playingIndex === index && isPlaying ? '❚❚' : '▶'} onPress={() => togglePlayPause(index)} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: t.colors.background }]}> 
      <View style={[styles.container, { padding: t.spacing.md }]}> 
        <TextInput
          placeholder="Search users..."
          placeholderTextColor={t.colors.accentBlue}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.input, { borderColor: t.colors.buttonShadow, backgroundColor: t.colors.buttonFace, color: t.colors.text, fontFamily: t.font.family }]}
          autoCapitalize="none"
        />
        {searchQuery.trim() ? (
          loadingUsers ? (
            <ActivityIndicator color={t.colors.text} style={styles.loading} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={u => u.id}
              renderItem={renderUser}
              viewabilityConfig={viewConfig.current}
              onViewableItemsChanged={onViewableItemsChanged.current}
              ListEmptyComponent={!loadingUsers && <Text style={[styles.noResults, { color: t.colors.text, fontFamily: t.font.family }]}>No users found.</Text>}
            />
          )
        ) : (
          loadingPosts ? (
            <ActivityIndicator color={t.colors.text} style={styles.loading} />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={item => item.id}
              renderItem={renderPost}
              pagingEnabled
              snapToInterval={SCREEN_HEIGHT}
              snapToAlignment="center"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              viewabilityConfig={viewConfig.current}
              onViewableItemsChanged={onViewableItemsChanged.current}
            />
          )
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  input: { height: 40, borderWidth: 1, paddingHorizontal: 8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  userInfo: { flex: 1, marginRight: 8 },
  username: { fontSize: 16 },
  email: { fontSize: 12 },
  loading: { marginVertical: 16 },
  noResults: { textAlign: 'center', marginTop: 20 },
  page: { height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center', padding: 16 },
  label: { marginBottom: 8, fontSize: 16 }
});
