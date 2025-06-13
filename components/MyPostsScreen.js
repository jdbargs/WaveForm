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
  Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;

export default function MyPostsScreen() {
  const navigation = useNavigation();
  const t = useTheme();

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
        error: userError
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
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);
  const isFocused = useIsFocused();

  // Fetch user's posts
  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
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
        await sound.playAsync();
        setPlayingIndex(index);
        setIsPlaying(true);
      } else if (isPlaying && playingIndex === index) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.stopAsync();
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        await sound.playAsync();
        setPlayingIndex(index);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  };

  // Delete a post
  const handleDelete = (postId) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', postId);
            if (error) {
              console.error('Delete error:', error);
            } else {
              fetchPosts();
            }
          }
        }
      ]
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Styles with theme
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.colors.buttonFace,
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm
    },
    usernameInput: {
      flex: 1,
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.header,
      fontWeight: t.font.weight.bold,
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
      paddingVertical: t.spacing.xs,
      marginRight: t.spacing.sm
    },
    postCount: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body
    },
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm
    },
    postRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
      paddingVertical: t.spacing.sm
    },
    postText: {
      flex: 1,
      marginLeft: t.spacing.sm,
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: t.spacing.sm
    }
  });

  // Render each post row
  const renderItem = ({ item, index }) => (
    <View style={styles.postRow}>
      <Win95Button
        title={playingIndex === index && isPlaying ? '❚❚' : '▶'}
        onPress={() => handlePlayPause(item.audio_url, index)}
      />
      <Text style={styles.postText}>{item.caption}</Text>
      <View style={styles.actionButtons}>
        <Win95Button title="Delete" onPress={() => handleDelete(item.id)} />
      </View>
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
          placeholderTextColor={t.colors.text}
        />
        <Text style={styles.postCount}>{posts.length} posts</Text>
      </View>

      {/* Posts list */}
      <View style={styles.container}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ height: SCREEN_HEIGHT }}
        />
      </View>
    </SafeAreaView>
  );
}
