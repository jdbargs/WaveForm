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
import * as FileSystem from 'expo-file-system';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function FeedScreen() {
  const t = useTheme();
  const isFocused = useIsFocused();
  const [posts, setPosts] = useState([]);
  const postsRef = useRef(posts);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  // dynamic styles using theme
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
    postName: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      marginBottom: t.spacing.sm,
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
      .select(`
        id,
        audio_url,
        view_count,
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
        console.log("Downloading to:", localUri);
        await FileSystem.downloadAsync(remoteUrl, localUri);
        const newInfo = await FileSystem.getInfoAsync(localUri, { size: true });
        console.log("Downloaded size:", newInfo.size, "bytes");
      } else {
        console.log("Using cached file, size:", info.size, "bytes");
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
      console.log("Playback loaded:", status);
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
        <Text style={styles.postName}>{item.name}</Text>

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
      </View>
    );
  };

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
