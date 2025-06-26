// components/FeedScreen.js
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
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
import { useTheme } from '../theme';
import Win95Button from './Win95Button';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT;

export default function FeedScreen() {
  const t = useTheme();
  const isFocused = useIsFocused();
  const TAB_BAR_HEIGHT = t.dimensions.buttonHeight * 3;
  const [posts, setPosts] = useState([]);
  const postsRef = useRef([]);  
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);
  const soundRef = useRef(null);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // dynamic styles using theme
  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
    },
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
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      padding: t.spacing.md,
      borderTopWidth: 1,
      borderColor: t.colors.buttonShadow
    },
    postName: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      marginBottom: t.spacing.sm,
      textAlign: 'center',
    },
    timestamp: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,  // bump up if desired
      marginTop: t.spacing.sm,
      textAlign: 'center',
    },
  });

  const viewConfig = { viewAreaCoveragePercentThreshold: 80 };
  // viewability for autoplay
  const onViewableItemsChanged = useCallback(
    async ({ viewableItems }) => {
      // nothing visible → bail
      if (!viewableItems?.length) return;

      const idx = viewableItems[0].index;
      // same clip as before → no change
      if (idx === playingIndex) return;

      const post = postsRef.current[idx];
      if (post && post.id !== currentUserId) {
        try {
          // bump view count in the database
          await supabase.rpc('increment_post_view_count', { p_post_id: post.id });
        } catch (err) {
          console.warn('Failed to bump view_count:', err);
        }
      }

      // play or pause the newly visible clip
      togglePlayPause(idx);
    },
    [currentUserId, playingIndex]
  );



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
      .select(`
        id,
        audio_url,
        view_count,
        name,
        created_at,
        author:users!posts_user_id_fkey(username)
      `)    
      .in('user_id', ids)
      .eq('is_public', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPosts(feedPosts);
  }

  // returns a local file:// URI, downloading once if passed an http URL
  // simplified helper
  async function preparePlaybackUri(uri) {
    if (uri.startsWith('file://')) return uri;
    const filename = uri.split('/').pop().split('?')[0];
    const localUri = FileSystem.documentDirectory + filename;
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      await FileSystem.downloadAsync(uri, localUri);
    }
    return localUri;
  }



  async function unloadSound() {
    // grab a copy of the ref, then clear it immediately
    const sound = soundRef.current;
    soundRef.current = null;

    if (!sound) {
      // nothing to unload
      setPlayingIndex(null);
      setIsPlaying(false);
      return;
    }

    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (e) {
      console.warn('Error unloading sound:', e);
    } finally {
      setPlayingIndex(null);
      setIsPlaying(false);
    }
  }


  // play by index
  async function playSoundAtIndex(index) {
    const post = postsRef.current[index];
    if (!post?.audio_url) return;

    // 1) Switch into playback mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true
    });

    // 2) Unload any previous sound
    await unloadSound();

    // 3) Download the remote file to a truly local path
    let localUri;
    try {
      const remoteUrl = post.audio_url;
      const filename = remoteUrl
        .split("/")
        .pop()
        .split("?")[0];              // e.g. "abcd.mp3"
      localUri = `${FileSystem.documentDirectory}${filename}`;

      const info = await FileSystem.getInfoAsync(localUri, { size: true });
      if (!info.exists) {
        await FileSystem.downloadAsync(remoteUrl, localUri);
        const newInfo = await FileSystem.getInfoAsync(localUri, { size: true });
      } 
    } catch (err) {
      console.error("Download error:", err);
      alert("Could not download audio for playback.");
      return;
    }

    // 4) Play from that local file
    try {
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true }
      );
      soundRef.current = newSound;
      setPlayingIndex(index);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate(s => {
        if (s.didJustFinish) unloadSound();
      });
    } catch (err) {
      console.error("Playback error:", err);
      alert("Playback failed.");
    }
  }

  // add this immediately after:
  function togglePlayPause(index) {
    // if the same clip is playing, pause it; otherwise start it
    if (playingIndex === index && isPlaying) {
      soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      playSoundAtIndex(index);
    }
  }

  // render each post
  const renderItem = ({ item, index }) => {
    const username = item.author?.username || 'Unknown'
    const rawWaveform = Array.isArray(item.waveform) && item.waveform.length
      ? item.waveform
      : Array.from({ length: 50 }, () => Math.random());

    return (
      <View style={styles.page}>
        <Text style={styles.audioLabel}>▶ {username}'s Post:</Text>

        {/* Waveform bar graph */}
        <View style={styles.waveformContainer}>
          {rawWaveform.map((amp, i) => (
            <View
              key={i}
              style={{
                width: 2,
                height: (amp || 0) * 40,
                backgroundColor: t.colors.buttonShadow,
                marginHorizontal: 1
              }}
            />
          ))}
        </View>

        <View style={styles.controls}>
          <Win95Button
            title={playingIndex === index && isPlaying ? '❚❚' : '▶'}
            onPress={() => togglePlayPause(index)}
          />
        </View>

        <Text style={styles.postName}>{item.name}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>
    );
  };


  return (
    <SafeAreaView
      edges={[]}       
      style={{
        flex: 1,
        backgroundColor: t.colors.background,
      }}
    >
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListFooterComponent={<View style={{ height: TAB_BAR_HEIGHT }} />}
      />
    </SafeAreaView>
  );
}
