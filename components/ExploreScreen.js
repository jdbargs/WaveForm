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
import { useTheme } from '../theme';
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
  const focusTimestampRef = useRef(0);
  const [pendingIds, setPendingIds] = useState(new Set());


  // Popular posts state
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  // Viewability config and handler
  const viewConfig = useRef({
    viewAreaCoveragePercentThreshold: 80,
  }).current;

  // 2) stable no-op for the user list
  const noop = useCallback(() => {}, []);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
        // ignore during our focus-buffer
      if (Date.now() - focusTimestampRef.current < 500) return;

      // ignore if user is actively searching
      if (searchQuery.trim()) return;

      if (!isFocused || viewableItems.length === 0) return;
      
      if (!isFocused || viewableItems.length === 0) return;
      const visibleIndexes = viewableItems.map(v => v.index);

      if (playingIndex !== null && !visibleIndexes.includes(playingIndex)) {
        unloadSound();
        setPlayingIndex(null);
      }

      const idx = visibleIndexes[0];
      if (idx !== playingIndex) {
        const post = postsRef.current[idx];
        (async () => {
          if (post?.id !== currentUserId) {
            await supabase
              .rpc('increment_post_view_count', { p_post_id: post.id });
          }
          await unloadSound();
          await playSoundAtIndex(idx);
        })();
      }
    },
    [searchQuery, isFocused, currentUserId, playingIndex]
  );

  const fetchPopularPosts = useCallback(async () => {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        name,
        audio_url,
        view_count,
        created_at,
        author:users!posts_user_id_fkey(
          username,
          is_private
        )
      `)
      .eq('is_public', true)
      // you can filter out private authors here client-side if you like:
      //.eq('users.is_private', false)
      .order('view_count', { ascending: false })
      .limit(100);

    if (error) console.error('fetchPopularPosts error', error);
    setPosts(data || []);
    setLoadingPosts(false);
  }, []);


  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }); }, []);
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

      const { data: reqData } = await supabase
        .from('follow_requests')
        .select('followed_id')
        .eq('follower_id', user.id)
        .eq('status', 'pending');
      setPendingIds(new Set(reqData.map(r => r.followed_id)));
    })();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      unloadSound();
      setPlayingIndex(null);
    }
  }, [isFocused]);

  // Search users
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setUsers([]); return; }
    setLoadingUsers(true);
    const timer = setTimeout(async () => {
      let query = supabase
        .from('users')
        .select('id, username, email, is_private')
        .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);
      if (currentUserId) query = query.neq('id', currentUserId);
      const { data, error } = await query;
      if (!error && data) setUsers(data);
      setLoadingUsers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  useEffect(() => {
    // only load top posts when the list isn’t in “search” mode
    if (!searchQuery.trim() && isFocused) {
      fetchPopularPosts();
      return () => {
        // cleanup audio when unmounting or losing focus
        unloadSound();
        setPlayingIndex(null);
      };
    }
  }, [searchQuery, isFocused, fetchPopularPosts]);


  useEffect(() => {
  if (isFocused) {
    // record when we just became focused
    focusTimestampRef.current = Date.now();
  } else {
    // immediate hard cutoff on blur
    unloadSound();
    setPlayingIndex(null);
  }
}, [isFocused]);


  // Follow/unfollow
  const handleFollowToggle = async (item) => {
    if (!currentUserId) return;
    const id = item.id;

    // 1) If already following → unfollow
    if (followingIds.has(id)) {
      await unfollowUser(currentUserId, id);
      setFollowingIds(prev => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      return;
    }

    // 2) If target is private → send a follow_request (once)
    if (item.is_private) {
      if (pendingIds.has(id)) return; // already requested

      const { error } = await supabase
        .from('follow_requests')
        .insert({
          follower_id: currentUserId,
          followed_id: id,
          status: 'pending'
        });

      if (error) {
        console.error('Follow-request error:', error);
        return;
      }

      setPendingIds(prev => {
        const s = new Set(prev);
        s.add(id);
        return s;
      });
      return;
    }

    // 3) Otherwise it’s a public user → normal follow
    await followUser(currentUserId, id);
    setFollowingIds(prev => {
      const s = new Set(prev);
      s.add(id);
      return s;
    });
  };

  // Audio controls
  async function unloadSound() {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }

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

  function togglePlayPause(index) {
    if (playingIndex === index && isPlaying) {
      soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      playSoundAtIndex(index);
    }
  }

  // Render user & post items
  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: t.colors.text, fontFamily: t.font.family }]}>
          {item.username}
        </Text>
        <Text style={[styles.email, { color: t.colors.accentBlue, fontFamily: t.font.family }]}>
          {item.email}
        </Text>
      </View>
      <Win95Button
        title={
          followingIds.has(item.id)
            ? 'Unfollow'
            : pendingIds.has(item.id)
              ? 'Pending'
              : 'Follow'
        }
        onPress={() => handleFollowToggle(item)}
        disabled={pendingIds.has(item.id)}
      />
    </View>
  );

  const renderPost = ({ item, index }) => (
    <View style={[styles.page, { backgroundColor: t.colors.background }]}>
      <Text style={[styles.label, { color: t.colors.text, fontFamily: t.font.family }]}>
        ▶ {item.author?.username}'s Post ({item.view_count} views)
      </Text>
      <Win95Button
        title={playingIndex === index && isPlaying ? '❚❚' : '▶'}
        onPress={() => togglePlayPause(index)}
      />
      <Text style={[styles.postName, { color: t.colors.text, fontFamily: t.font.family }]}>
        {item.name}
      </Text>
      <Text style={[styles.timestamp, { color: t.colors.text, fontFamily: t.font.family }]}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: t.colors.background }]}>
      <View style={[styles.container, { padding: t.spacing.md }]}>
        <TextInput
          placeholder="Search users..."
          placeholderTextColor={t.colors.background}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.input,
            {
              borderColor: t.colors.buttonShadow,
              backgroundColor: t.colors.buttonFace,
              color: t.colors.text,
              fontFamily: t.font.family
            }
          ]}
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
              ListEmptyComponent={
                !loadingUsers && (
                  <Text
                    style={[
                      styles.noResults,
                      { color: t.colors.text, fontFamily: t.font.family }
                    ]}
                  >
                    No users found.
                  </Text>
                )
              }
              viewabilityConfig={viewConfig}
              onViewableItemsChanged={noop}
            />
          )
        ) : loadingPosts ? (
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
            viewabilityConfig={viewConfig}
            onViewableItemsChanged={onViewableItemsChanged}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  input: { height: 40, borderWidth: 1, paddingHorizontal: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1
  },
  userInfo: { flex: 1, marginRight: 8 },
  username: { fontSize: 16 },
  email: { fontSize: 12 },
  loading: { marginVertical: 16 },
  noResults: { textAlign: 'center', marginTop: 20 },
  page: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  label: { marginBottom: 8, fontSize: 16 },
  postName: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center'
  },
  timestamp: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center'
  }
});
