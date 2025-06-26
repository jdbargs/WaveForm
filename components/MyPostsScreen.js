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
  TouchableOpacity,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';
import DesktopIcon from './DesktopIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
const ICON_SIZE = 80;
const TRASH_MARGIN = 20;
const HEADER_HEIGHT     = 56;  // whatever your <View style={styles.header}> actually renders at
const BREADCRUMB_HEIGHT = 48;  // whatever your <View style={styles.breadcrumb}> actually renders at
const DROP_PADDING = 20;    // how many pixels extra you want around each icon
const clamp = (val, min, max) => Math.max(min, Math.min(val, max));


export default function MyPostsScreen() {
  const navigation = useNavigation();
  const t = useTheme();
  const [desktopHeight, setDesktopHeight] = useState(0);
  const [upRect, setUpRect] = useState(null);
  const [trashRect, setTrashRect] = useState(null);
  const [portalRect, setPortalRect] = useState(null);
  const containerWidth  = WINDOW_WIDTH;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const containerHeight = desktopHeight ||
    (WINDOW_HEIGHT - HEADER_HEIGHT - BREADCRUMB_HEIGHT - tabBarHeight);



  // Tab title
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false
    });
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
  const parentFolder = folderStack.length > 1
    ? folderStack[folderStack.length - 2]
    : null;
  const goUp = () =>
    folderStack.length > 1 && setFolderStack((s) => s.slice(0, -1));

  // New folder
  const createFolder = () => {
    if (!userId) return;

    Alert.prompt(
      'New Folder',
      'Enter folder name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async (name) => {
            // fallback if user left the field blank
            const folderName = name?.trim() || 'New Folder';
            // Pick a random position inside the desktop
            const defaultPos = {
              x: Math.random() * (containerWidth  - ICON_SIZE),
              y: Math.random() * (containerHeight - ICON_SIZE),
            };
            // Insert into Supabase
            const { data: newFolder, error } = await supabase
              .from('folders')
              .insert({
                name: folderName,
                user_id: userId,
                parent_folder_id: currentFolderId,
                position: defaultPos,
              })
              .select('*')
              .single();
            if (!error) {
              setFolders((f) => [
                ...f,
                {
                  ...newFolder,
                  parentFolderId: newFolder.parent_folder_id,
                  position: newFolder.position,
                  type: 'folder',
                },
              ]);
            } else {
              console.error('Error creating folder:', error);
            }
          },
        },
      ],
      'plain-text',
      'New Folder' // default text
    );
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

  useEffect(() => {
    if (desktopHeight === 0) return;  
    const usableHeight = desktopHeight - tabBarHeight;
    const usableWidth  = WINDOW_WIDTH;

    // helper to clamp a single position
    const clampPos = ({ x, y }) => ({
      x: clamp(x, 0, containerWidth  - ICON_SIZE),
      y: clamp(y, 0, containerHeight - ICON_SIZE),
    });

    // clamp posts
    setPosts(old =>
      old.map(p => ({
        ...p,
        position: clampPos(p.position)
      }))
    );
    // clamp folders
    setFolders(old =>
      old.map(f => ({
        ...f,
        position: clampPos(f.position)
      }))
    );
  }, [desktopHeight]);

  // Delete
  const handleDeletePost = async (id) => { await supabase.from('posts').delete().eq('id', id); setPosts((p) => p.filter((x) => x.id !== id)); };
  const handleDeleteFolder = async (id) => {
    const { data, error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id)
      .select();                 

    if (error) {
      console.error('Folder delete error:', error);
      Alert.alert('Delete failed', error.message);
    } else {
      console.log('Deleted folder:', data);
      setFolders((f) => f.filter((x) => x.id !== id));
    }
  };

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
  const updatePosition = async (id, rawPos, type) => {
    // 1) Clamp into desktop bounds
    const usableHeight = desktopHeight - tabBarHeight;
    const usableWidth  = WINDOW_WIDTH;

    let x = clamp(rawPos.x, 0, usableWidth - ICON_SIZE);
    let y = clamp(rawPos.y, 0, usableHeight - ICON_SIZE);
    let pos = { x, y };

    // 2) Build “forbidden” zones around each drop-icon
    const forbiddenZones = [
      {
        x: trashRect.x - DROP_PADDING,
        y: trashRect.y - DROP_PADDING,
        width:  trashRect.width  + DROP_PADDING * 2,
        height: trashRect.height + DROP_PADDING * 2,
      },
      {
        x: portalRect.x - DROP_PADDING,
        y: portalRect.y - DROP_PADDING,
        width:  portalRect.width  + DROP_PADDING * 2,
        height: portalRect.height + DROP_PADDING * 2,
      }
    ];

    // 3) AABB intersection test
    const intersects = (a, b) =>
      a.x < b.x + b.width &&
      a.x + a.width  > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    const box = { x: pos.x, y: pos.y, width: ICON_SIZE, height: ICON_SIZE };

    // 4) If it collides, push it above that zone
    forbiddenZones.forEach(zone => {
      if (intersects(box, zone)) {
        // move it immediately above the forbidden area
        pos.y = zone.y - ICON_SIZE - 1;
        // re‐clamp so it never goes negative
        pos.y = clamp(pos.y, 0, usableHeight - ICON_SIZE);
        // update our test box
        box.y = pos.y;
      }
    });

    // 5) Commit the new “safe” position
    if (type === 'file') {
      setPosts(p =>
        p.map(x => x.id === id ? { ...x, position: pos } : x)
      );
      await supabase.from('posts').update({ position: pos }).eq('id', id);
    } else {
      setFolders(f =>
        f.map(x => x.id === id ? { ...x, position: pos } : x)
      );
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

  // inside MyPostsScreen

  // 1️⃣ build this handler once per render:
  const handleDragEnd = useCallback(
    (id, rawPos, type) => {
      // First, clamp & reposition the item
      updatePosition(id, rawPos, type);

      // If the trash zone is defined and the drop is inside it, delete
      if (
        trashRect &&
        rawPos.x + ICON_SIZE/2 >= trashRect.x &&
        rawPos.x + ICON_SIZE/2 <= trashRect.x + trashRect.width &&
        rawPos.y + ICON_SIZE/2 >= trashRect.y &&
        rawPos.y + ICON_SIZE/2 <= trashRect.y + trashRect.height
      ) {
        Alert.alert(
          'Delete?',
          `Permanently delete this ${type}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK', onPress: () => handleTrashDrop(id, type) }
          ]
        );
        return;
      }

      // If the portal zone is defined and the drop is inside it, move back up
      if (
        portalRect &&
        rawPos.x + ICON_SIZE/2 >= portalRect.x &&
        rawPos.x + ICON_SIZE/2 <= portalRect.x + portalRect.width &&
        rawPos.y + ICON_SIZE/2 >= portalRect.y &&
        rawPos.y + ICON_SIZE/2 <= portalRect.y + portalRect.height
      ) {
        // Move item back to its parent folder
        moveIntoFolder(id, parentFolder, type);
        return;
      }

      // Otherwise, check folder drop zones
      for (const { id: fid, x, y, width, height } of folderRects) {
        if (
          rawPos.x + ICON_SIZE/2 >= x &&
          rawPos.x + ICON_SIZE/2 <= x + width &&
          rawPos.y + ICON_SIZE/2 >= y &&
          rawPos.y + ICON_SIZE/2 <= y + height
        ) {
          moveIntoFolder(id, fid, type);
          return;
        }
      }
    },
    [trashRect, portalRect, folderRects, updatePosition, moveIntoFolder, parentFolder]
  );


  // Visible
  const visibleFolders = folders.filter((f) => f.parentFolderId === currentFolderId);
  const visiblePosts = posts.filter((p) => p.parentFolderId === currentFolderId);
  const visibleItems = [...visibleFolders, ...visiblePosts];

  // Drop zones
  const folderRects = visibleFolders.map((f) => ({ id: f.id, x: f.position.x, y: f.position.y, width: ICON_SIZE, height: ICON_SIZE }));

  const styles = StyleSheet.create({ 
    safeArea: { flex: 1, backgroundColor: t.colors.background }, 
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.colors.buttonFace, borderBottomWidth: t.border.width, borderBottomColor: t.colors.buttonShadow, padding: t.spacing.sm }, 
    usernameInput: { flex: 1, color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.header, fontWeight: t.font.weight.bold, borderBottomWidth: t.border.width, borderBottomColor: t.colors.buttonShadow, marginRight: t.spacing.sm }, 
    postCount: { color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body }, 
    breadcrumb: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: t.spacing.sm, backgroundColor: t.colors.background }, 
    breadcrumbText: { marginLeft: t.spacing.sm, color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body }, desktopContainer: { flex: 1, backgroundColor: t.colors.background, position: 'relative' },
    desktopContainer: {
    flex: 1,
    backgroundColor: t.colors.background,
    position: 'relative',
    paddingBottom: tabBarHeight,   // ← reserve exactly that much space at the bottom
    }
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
        {folderStack.length > 1 && (
          <View
            onLayout={e => {
              const { x, y, width, height } = e.nativeEvent.layout;
              // `y` is relative to breadcrumb; desktopContainer starts BREADCRUMB_HEIGHT below it
              setUpRect({
                x,
                y: y - BREADCRUMB_HEIGHT,
                width,
                height,
              });
            }}
          >
            <Win95Button title="<" onPress={goUp} />
          </View>
        )}
        <Win95Button onPress={createFolder}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ marginRight: 6, fontSize: 22, marginTop: -7 }}>+</Text>
            <Image
              source={require('../assets/images/newfolder.png')}
              style={{ width: 25, height: 25, resizeMode: 'contain' }}
            />
          </View>
        </Win95Button>
        <Text style={styles.breadcrumbText}>
          {folderStack.length === 1
            ? 'Home'
            : folders.find((f) => f.id === currentFolderId)?.name}
       </Text>
      <Win95Button onPress={() => navigation.navigate('Settings')}>
        <Image
          source={require('../assets/images/gear.png')}
          style={{ width: 25, height: 25, resizeMode: 'contain' }}
          />
      </Win95Button>
      </View>

      {/* Desktop icons + debug overlays */}
      <View
        style={styles.desktopContainer}
        onLayout={(e) => setDesktopHeight(e.nativeEvent.layout.height)}
      >
        {/* DEBUG: show trash & portal drop zones */}
        {trashRect && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: trashRect.x,
              top:  trashRect.y,
              width: trashRect.width,
              height:trashRect.height,
              backgroundColor: 'rgba(255, 0, 0, 0.3)'
            }}
          />
        )}
        {portalRect && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: portalRect.x,
            top: portalRect.y,
            width: portalRect.width,
            height: portalRect.height,
            backgroundColor: 'rgba(0, 0, 255, 0.3)'
          }}
        />
      )}
        {visibleItems.map((item) => {
          const absoluteIndex =
            item.type === 'file'
              ? posts.findIndex((p) => p.id === item.id)
              : folders.findIndex((f) => f.id === item.id);
          return (
            <DesktopIcon
              key={item.id}
              item={item}
              onPress={() =>
                item.type === 'folder'
                  ? setFolderStack((s) => [...s, item.id])
                  : handlePlayPause(item.audio_url, absoluteIndex)
              }
              onDragEnd={(id, pos) => handleDragEnd(id, pos, item.type)}
              onTrashDrop={handleTrashDrop}
              onDropOnBack={id => moveIntoFolder(id, parentFolder, item.type)}
              onRenameDrop={handleRenameDrop}
              onDropOnFolder={(id, folderId) =>
                moveIntoFolder(id, folderId, item.type)
              }
              folderRects={folderRects}
              trashRect={trashRect}
              backRect={upRect}
              portalRect={portalRect}
            />
          );
        })}
        {/* Trash and Portal Icon */}
        <Image
          source={require('../assets/images/trash.png')}
          onLayout={e => {
            setTrashRect(e.nativeEvent.layout);
          }}
          style={{
            position: 'absolute',
            width: ICON_SIZE,
            height: ICON_SIZE,
            bottom: tabBarHeight,
            right: TRASH_MARGIN,
          }}
          resizeMode="contain"
        />
        <Image
          source={require('../assets/images/portal.png')}
          onLayout={e => setPortalRect(e.nativeEvent.layout)}
          style={{
            position: 'absolute',
            width: ICON_SIZE,
            height: ICON_SIZE,
            bottom: tabBarHeight,
            left: TRASH_MARGIN,
          }}
          resizeMode="contain"
        />
        </View>
    </SafeAreaView>
  );
}