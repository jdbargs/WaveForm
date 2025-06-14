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
  Alert,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';
import DesktopIcon from './DesktopIcon';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
const SCREEN_HEIGHT = WINDOW_HEIGHT - 80; // above tab bar
const ICON_SIZE = 64;
const TRASH_MARGIN = 20;
const TAB_BAR_HEIGHT = 80; // height of bottom tab bar

export default function MyPostsScreen() {
  const navigation = useNavigation();
  const t = useTheme();

  // Tab title
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'My Profile' });
  }, [navigation]);

  // Auth/profile
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();
      if (userErr || !user) return console.error(userErr);
      setUserId(user.id);
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      if (!error) setUsername(data.username);
    })();
  }, []);

  const handleUsernameSave = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId);
    if (error) console.error(error);
  };

  // Posts & folders
  const [posts, setPosts] = useState([]);
  const [folders, setFolders] = useState([]);
  const isFocused = useIsFocused();

  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId);
    if (!error)
      setPosts(
        data.map((p, i) => ({
          ...p,
          parentFolderId: p.folder_id ?? null,
          position:
            p.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
          type: 'file'
        }))
      );
  }, [userId]);

  const fetchFolders = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);
    if (!error)
      setFolders(
        data.map((f, i) => ({
          ...f,
          parentFolderId: f.parent_folder_id,
          position:
            f.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
          type: 'folder'
        }))
      );
  }, [userId]);

  useEffect(() => {
    if (isFocused && userId) {
      fetchPosts();
      fetchFolders();
    }
  }, [isFocused, userId, fetchPosts, fetchFolders]);

  // Desktop navigation
  const [folderStack, setFolderStack] = useState([null]);
  const currentFolderId = folderStack[folderStack.length - 1];
  const goUp = () =>
    folderStack.length > 1 && setFolderStack((s) => s.slice(0, -1));

  // New folder
  const createFolder = async () => {
    if (!userId) return;
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
    if (!error)
      setFolders((f) => [
        ...f,
        { ...newFolder, parentFolderId: newFolder.parent_folder_id, position: newFolder.position, type: 'folder' }
      ]);
  };

  // Audio playback
  const soundRef = useRef(null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const handlePlayPause = async (uri, idx) => {
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        await sound.playAsync();
        setPlayingIndex(idx);
        setIsPlaying(true);
      } else if (isPlaying && playingIndex === idx) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.stopAsync();
        const { sound } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        await sound.playAsync();
        setPlayingIndex(idx);
        setIsPlaying(true);
      }
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => () => soundRef.current && soundRef.current.unloadAsync(), []);

  // Delete
  const handleDeletePost = async (id) => { await supabase.from('posts').delete().eq('id', id); setPosts((p) => p.filter((x) => x.id !== id)); };
  const handleDeleteFolder = async (id) => { await supabase.from('folders').delete().eq('id', id); setFolders((f) => f.filter((x) => x.id !== id)); };
  const handleTrashDrop = (id, type) => type === 'file' ? handleDeletePost(id) : handleDeleteFolder(id);

  // Rename
  const handleRenameDrop = (id, type) => {
    if (type === 'file') {
      const file = posts.find((p) => p.id === id);
      Alert.prompt(
        'Rename Post',
        'Enter new name:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', onPress: async (text) => {
              await supabase.from('posts').update({ caption: text }).eq('id', id);
              setPosts((p) => p.map((x) => x.id === id ? { ...x, caption: text } : x));
            }}
        ],
        'plain-text',
        file.caption
      );
    } else {
      const folder = folders.find((f) => f.id === id);
      Alert.prompt(
        'Rename Folder',
        'Enter new name:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', onPress: async (text) => {
              await supabase.from('folders').update({ name: text }).eq('id', id);
              setFolders((f) => f.map((x) => x.id === id ? { ...x, name: text } : x));
            }}
        ],
        'plain-text',
        folder.name
      );
    }
  };

  // Move & reposition
  const updatePosition = async (id, pos, type) => {
    if (type === 'file') {
      setPosts((p) => p.map((x) => x.id === id ? { ...x, position: pos } : x));
      await supabase.from('posts').update({ position: pos }).eq('id', id);
    } else {
      setFolders((f) => f.map((x) => x.id === id ? { ...x, position: pos } : x));
      await supabase.from('folders').update({ position: pos }).eq('id', id);
    }
  };

  const moveIntoFolder = async (id, folderId, type) => {
    if (type === 'file') {
      setPosts((p) =>
        p.map((x) =>
          x.id === id ? { ...x, parentFolderId: folderId } : x
        )
      );
      await supabase
        .from('posts')
        .update({ folder_id: folderId })
        .eq('id', id);
    } else {
      setFolders((f) =>
        f.map((x) =>
          x.id === id ? { ...x, parentFolderId: folderId } : x
        )
      );
      await supabase
        .from('folders')
        .update({ parent_folder_id: folderId })
        .eq('id', id);
    }
  };

  // Visible
  const visibleFolders = folders.filter((f) => f.parentFolderId === currentFolderId);
  const visiblePosts = posts.filter((p) => p.parentFolderId === currentFolderId);
  const visibleItems = [...visibleFolders, ...visiblePosts];

  // Drop zones
  const folderRects = visibleFolders.map((f) => ({ id: f.id, x: f.position.x, y: f.position.y, width: ICON_SIZE, height: ICON_SIZE }));
  const trashRect = { x: WINDOW_WIDTH - ICON_SIZE - TRASH_MARGIN, y: SCREEN_HEIGHT - ICON_SIZE - (TRASH_MARGIN + TAB_BAR_HEIGHT), width: ICON_SIZE, height: ICON_SIZE };
  const portalRect = { x: TRASH_MARGIN, y: SCREEN_HEIGHT - ICON_SIZE - (TRASH_MARGIN + TAB_BAR_HEIGHT), width: ICON_SIZE, height: ICON_SIZE };

  const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: t.colors.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.colors.buttonFace, borderBottomWidth: t.border.width, borderBottomColor: t.colors.buttonShadow, padding: t.spacing.sm }, usernameInput: { flex: 1, color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.header, fontWeight: t.font.weight.bold, borderBottomWidth: t.border.width, borderBottomColor: t.colors.buttonShadow, marginRight: t.spacing.sm }, postCount: { color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body }, breadcrumb: { flexDirection: 'row', alignItems: 'center', padding: t.spacing.sm, backgroundColor: t.colors.background }, breadcrumbText: { marginLeft: t.spacing.sm, color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body }, desktopContainer: { flex: 1, backgroundColor: t.colors.background, position: 'relative' } });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TextInput style={styles.usernameInput} value={username} onChangeText={setUsername} onBlur={handleUsernameSave} placeholder="Username" placeholderTextColor={t.colors.text} />
        <Text style={styles.postCount}>{visibleItems.length} items</Text>
      </View>
      {/* Breadcrumb + New Folder */}
      <View style={styles.breadcrumb}>
        {folderStack.length > 1 && <Win95Button title="Up" onPress={goUp} />}
        <Win95Button title="New Folder" onPress={createFolder} />
        <Text style={styles.breadcrumbText}>{folderStack.length===1? 'Home':folders.find((f)=>f.id===currentFolderId)?.name}</Text>
      </View>
      {/* Desktop icons */}
      <View style={styles.desktopContainer}>
        {visibleItems.map((item) => {
          const absoluteIndex = item.type === 'file'
            ? posts.findIndex((p) => p.id === item.id)
            : folders.findIndex((f) => f.id === item.id);
          return (
            <DesktopIcon
              key={item.id}
              item={item}
              onPress={() => item.type==='folder'?setFolderStack((s)=>[...s,item.id]):handlePlayPause(item.audio_url,absoluteIndex)}
              onDragEnd={(id,pos)=>updatePosition(id,pos,item.type)}
              onDropOnFolder={(id,folderId)=>moveIntoFolder(id,folderId,item.type)}
              onTrashDrop={handleTrashDrop}
              onRenameDrop={handleRenameDrop}
              folderRects={folderRects}
              trashRect={trashRect}
              portalRect={portalRect}
            />
          );
        })}
        {/* Trash Icon */}
        <Image source={require('../assets/images/trash.png')} style={{position:'absolute',width:ICON_SIZE,height:ICON_SIZE,bottom:TRASH_MARGIN+TAB_BAR_HEIGHT,right:TRASH_MARGIN}} resizeMode="contain" />
        {/* Portal Icon */}
        <Image source={require('../assets/images/portal.png')} style={{position:'absolute',width:ICON_SIZE,height:ICON_SIZE,bottom:TRASH_MARGIN+TAB_BAR_HEIGHT,left:TRASH_MARGIN}} resizeMode="contain" />
      </View>
    </SafeAreaView>
  );
}
