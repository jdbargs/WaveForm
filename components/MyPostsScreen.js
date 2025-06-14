import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect
} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Dimensions,
  StyleSheet,
  Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';
import DesktopIcon from './DesktopIcon';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80;
const ICON_SIZE = 64;

export default function MyPostsScreen() {
  const navigation = useNavigation();
  const t = useTheme();

  // Set tab title
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'My Profile' });
  }, [navigation]);

  // Auth / profile
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        console.error('Error fetching auth user:', userErr);
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      if (error) console.error('Error fetching username:', error);
      else setUsername(data.username);
    };
    fetchUser();
  }, []);

  const handleUsernameSave = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId);
    if (error) console.error('Error updating username:', error);
  };

  // Posts & folders state
  const [posts, setPosts] = useState([]);
  const [folders, setFolders] = useState([]);
  const isFocused = useIsFocused();

  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching posts:', error);
    else {
      setPosts(
        data.map((p, i) => ({
          ...p,
          parentFolderId: p.folder_id ?? null,
          position:
            p.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
          type: 'file'
        }))
      );
    }
  }, [userId]);

  const fetchFolders = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching folders:', error);
    else {
      setFolders(
        data.map((f, i) => ({
          ...f,
          parentFolderId: f.parent_folder_id,
          position:
            f.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
          type: 'folder'
        }))
      );
    }
  }, [userId]);

  useEffect(() => {
    if (isFocused && userId) {
      fetchPosts();
      fetchFolders();
    }
  }, [isFocused, userId, fetchPosts, fetchFolders]);

  // Desktop navigation stack
  const [folderStack, setFolderStack] = useState([null]);
  const currentFolderId = folderStack[folderStack.length - 1];

  const goUp = () => {
    if (folderStack.length > 1) setFolderStack((s) => s.slice(0, -1));
  };

  // Create new folder
  const createFolder = async () => {
    if (!userId) return;
    // Random position within screen bounds
    const defaultPos = {
      x: Math.random() * (WINDOW_WIDTH - ICON_SIZE),
      y: Math.random() * (SCREEN_HEIGHT - ICON_SIZE)
    };
    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({
        name: 'New Folder',
        user_id: userId,
        parent_folder_id: currentFolderId,
        position: defaultPos
      })
      .select('*')
      .single();
    if (error) console.error('Error creating folder:', error);
    else {
      setFolders((prev) => [
        ...prev,
        {
          ...newFolder,
          parentFolderId: newFolder.parent_folder_id,
          position: newFolder.position,
          type: 'folder'
        }
      ]);
    }
  };

  // Audio playback
  const soundRef = useRef(null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    } catch (err) {
      console.error('Audio error:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // Delete post
  const handleDelete = (postId) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);
          if (error) console.error('Delete error:', error);
          else fetchPosts();
        }
      }
    ]);
  };

  // Drag & drop handlers
  const updatePosition = async (id, newPos, type) => {
    if (type === 'file') {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, position: newPos } : p))
      );
      const { error } = await supabase
        .from('posts')
        .update({ position: newPos })
        .eq('id', id);
      if (error) console.error('Error updating position:', error);
    } else {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, position: newPos } : f))
      );
      const { error } = await supabase
        .from('folders')
        .update({ position: newPos })
        .eq('id', id);
      if (error) console.error('Error updating folder position:', error);
    }
  };

  const moveIntoFolder = async (id, folderId, type) => {
    if (type === 'file') {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, parentFolderId: folderId } : p))
      );
      const { error } = await supabase
        .from('posts')
        .update({ folder_id: folderId })
        .eq('id', id);
      if (error) console.error('Error moving post:', error);
    } else {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, parentFolderId: folderId } : f))
      );
      const { error } = await supabase
        .from('folders')
        .update({ parent_folder_id: folderId })
        .eq('id', id);
      if (error) console.error('Error moving folder:', error);
    }
  };

  // Visible items
  const visibleFolders = folders.filter((f) => f.parentFolderId === currentFolderId);
  const visiblePosts = posts.filter((p) => p.parentFolderId === currentFolderId);
  const visibleItems = [...visibleFolders, ...visiblePosts];

  // Compute folder rects
  const folderRects = visibleFolders.map((f) => ({
    id: f.id,
    x: f.position.x,
    y: f.position.y,
    width: ICON_SIZE,
    height: ICON_SIZE
  }));

  // Styles
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.colors.buttonFace,
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
      padding: t.spacing.sm
    },
    usernameInput: {
      flex: 1,
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.header,
      fontWeight: t.font.weight.bold,
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
      marginRight: t.spacing.sm
    },
    postCount: { color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body },
    breadcrumb: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: t.spacing.sm,
      backgroundColor: t.colors.background
    },
    breadcrumbText: {
      marginLeft: t.spacing.sm,
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body
    },
    desktopContainer: { flex: 1, backgroundColor: t.colors.background, position: 'relative' }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TextInput
          style={styles.usernameInput}
          value={username}
          onChangeText={setUsername}
          onBlur={handleUsernameSave}
          placeholder="Username"
          placeholderTextColor={t.colors.text}
        />
        <Text style={styles.postCount}>{visibleItems.length} items</Text>
      </View>

      {/* Breadcrumb + New Folder */}
      <View style={styles.breadcrumb}>
        {folderStack.length > 1 && <Win95Button title="Up" onPress={goUp} />}
        <Win95Button title="New Folder" onPress={createFolder} />
        <Text style={styles.breadcrumbText}>
          {folderStack.length === 1
            ? 'Home'
            : folders.find((f) => f.id === currentFolderId)?.name}
        </Text>
      </View>

      {/* Desktop icons */}
      <View style={styles.desktopContainer}>
        {visibleItems.map((item) => {
          const absoluteIndex =
            item.type === 'file'
              ? posts.findIndex((p) => p.id === item.id)
              : folders.findIndex((f) => f.id === item.id);
          return (
            <DesktopIcon
              key={item.id}
              item={item}
              onPress={() => {
                if (item.type === 'folder') setFolderStack((s) => [...s, item.id]);
                else handlePlayPause(item.audio_url, absoluteIndex);
              }}
              onDragEnd={(id, pos) => updatePosition(id, pos, item.type)}
              onDropOnFolder={(id, folderId) => moveIntoFolder(id, folderId, item.type)}
              folderRects={folderRects}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}
