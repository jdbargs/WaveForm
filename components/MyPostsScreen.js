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
import {
  ICON_SIZE,
  TRASH_MARGIN,
  HEADER_HEIGHT,
  BREADCRUMB_HEIGHT,
  DROP_PADDING,
  clamp,
  clampPos,
  intersects
} from '../utils/desktopUtils';
import usePostsAndFolders from '../hooks/usePostsAndFolders';
import useUserProfile from '../hooks/useUserProfile';
import useFollowRequests from '../hooks/useFollowRequests';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import Win95Button from './Win95Button';
import DesktopIcon from './DesktopIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Win95Popup from './Win95Popup';
const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

export default function MyPostsScreen() {
  const { userId, username, isPrivate, loaded, saveUsername } = useUserProfile();
  const { request, showPopup, respond, hide } = useFollowRequests(userId);
  const isFocused = useIsFocused();
  const trashRectRef = useRef(null);
  const portalRectRef = useRef(null);
  const trashImageRef = useRef(null);
  const portalImageRef = useRef(null);
  const folderRectsRef = useRef([]);
  const upRectRef = useRef(null);
  const desktopRef = useRef(null);
  const [desktopOffset, setDesktopOffset] = useState({ x: 0, y: 0 });
  const navigation = useNavigation();
  const t = useTheme();
  const [desktopHeight, setDesktopHeight] = useState(0);
  const [upRect, setUpRect] = useState(null);
  const [trashRect, setTrashRect] = useState(null);
  const [portalRect, setPortalRect] = useState(null);
  const containerWidth  = WINDOW_WIDTH;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [pendingDelete, setPendingDelete] = useState(null);
  // new: holds only the last message
  const [moveLog, setMoveLog] = useState(null);
  const containerHeight = desktopHeight ||
    (WINDOW_HEIGHT - HEADER_HEIGHT - BREADCRUMB_HEIGHT - tabBarHeight);
  const [deleteConfirm, setDeleteConfirm] = useState({
    visible: false,
    id: null,
    type: null,
  });
  const [renamePopup, setRenamePopup] = useState({
    visible: false,
    id: null,
    type: null,
    value: '',
  });
  const {
    posts,
    folders,
    updatePosition,
    moveIntoFolder
  } = usePostsAndFolders(
    userId,
    desktopHeight,
    tabBarHeight,
    isFocused,
    desktopOffset,
    trashRect,
    portalRect,
    setMoveLog
  );
  
  useEffect(() => { trashRectRef.current = trashRect; }, [trashRect]);
  useEffect(() => { portalRectRef.current = portalRect; }, [portalRect]);
  useEffect(() => { folderRectsRef.current = folderRects; }, [folderRects]);
  useEffect(() => { upRectRef.current = upRect; }, [upRect]);

  // Tab title
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false
    });
  }, [navigation]);

  useEffect(() => {
    if (trashImageRef.current && desktopOffset) {
      trashImageRef.current.measure((x, y, width, height, pageX, pageY) => {
        setTrashRect({
          x: pageX - desktopOffset.x,
          y: pageY - desktopOffset.y,
          width,
          height,
        });
      });
    }
    if (portalImageRef.current && desktopOffset) {
      portalImageRef.current.measure((x, y, width, height, pageX, pageY) => {
        setPortalRect({
          x: pageX - desktopOffset.x,
          y: pageY - desktopOffset.y,
          width,
          height,
        });
      });
    }
  }, [desktopHeight, tabBarHeight, desktopOffset]);

  useEffect(() => {
    if (desktopRef.current) {
      desktopRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDesktopOffset({ x: pageX, y: pageY });
      });
    }
  }, [desktopHeight, tabBarHeight]);

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
          position: clampPos(
            p.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
            desktopHeight || WINDOW_HEIGHT,
            tabBarHeight || 0
          ),
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
          position: clampPos(
            f.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
            desktopHeight || WINDOW_HEIGHT,
            tabBarHeight || 0
          ),
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
            const defaultPos = clampPos(
              {
                x: Math.random() * (containerWidth  - ICON_SIZE),
                y: Math.random() * (containerHeight - ICON_SIZE),
              },
              desktopHeight || WINDOW_HEIGHT,
              tabBarHeight || 0
            );
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

  // Delete
  const handleDeletePost = async (id) => { 
    await supabase.from('posts').delete().eq('id', id); 
    setPosts((p) => p.filter((x) => x.id !== id)); 
  };

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
  const handleDeleteConfirm = () => {
    if (!deleteConfirm.visible) return;
    handleTrashDrop(deleteConfirm.id, deleteConfirm.type);
    setDeleteConfirm({ visible: false, id: null, type: null });
  };

  const handleDeleteCancel = () => {
    if (pendingDelete && trashRect) {
      const { id, type, pos } = pendingDelete;

      // Find the current item in state if pos is missing or incomplete
      let fallbackPos = { x: 0, y: 0 };
      if (type === 'file') {
        const file = posts.find(p => p.id === id);
        if (file && file.position) fallbackPos = file.position;
      } else {
        const folder = folders.find(f => f.id === id);
        if (folder && folder.position) fallbackPos = folder.position;
      }
      const safePos = {
        x: (pos && typeof pos.x === 'number') ? pos.x : fallbackPos.x,
        y: (pos && typeof pos.y === 'number') ? pos.y : fallbackPos.y,
      };

      let newX = Math.max(0, trashRect.x - ICON_SIZE - 20);
      let newY = safePos.y;

      if (safePos.x < trashRect.x) {
        newX = safePos.x;
        newY = Math.max(0, trashRect.y - ICON_SIZE - 20);
      }

      updatePosition(id, { x: newX, y: newY }, type);
    }
    setDeleteConfirm({ visible: false, id: null, type: null });
    setPendingDelete(null);
  };

  const requestDelete = (id, type, pos) => {
    setDeleteConfirm({ visible: true, id, type });
    setPendingDelete({ id, type, pos });
  };

  // Rename
  const handleRenameDrop = (id, type) => {
    let currentName = '';
    if (type === 'file') {
      const file = posts.find((p) => p.id === id);
      currentName = file?.caption || '';
    } else {
      const folder = folders.find((f) => f.id === id);
      currentName = folder?.name || '';
    }
    setRenamePopup({
      visible: true,
      id,
      type,
      value: currentName,
    });
    if (portalRect) {
      snapIntoPortal(id, type, portalRect);
    }
  };

  const handleRenameSubmit = async () => {
    const { id, type, value } = renamePopup;
    if (type === 'file') {
      await supabase.from('posts').update({ caption: value }).eq('id', id);
      setPosts((p) => p.map((x) => x.id === id ? { ...x, caption: value } : x));
    } else {
      await supabase.from('folders').update({ name: value }).eq('id', id);
      setFolders((f) => f.map((x) => x.id === id ? { ...x, name: value } : x));
    }
    setRenamePopup({ visible: false, id: null, type: null, value: '' });
  };

  // 1) Define this helper somewhere in your module:
  function snapIntoPortal(id, type, portalRect) {
    // grab the item’s last known position
    const item = type === 'file'
      ? posts.find(p => p.id === id)
      : folders.find(f => f.id === id);

    const fallbackPos = item?.position || { x: 0, y: 0 };
    const safePos = { x: fallbackPos.x, y: fallbackPos.y };

    // your original math, just swapping trashRect → portalRect
    let newX = Math.max(0, portalRect.x - ICON_SIZE - 20);
    let newY = safePos.y;

    if (safePos.x < portalRect.x) {
      newX = safePos.x;
      newY = Math.max(0, portalRect.y - ICON_SIZE - 20);
    }

    updatePosition(id, { x: newX, y: newY }, type);
  }

  // 1️⃣ build this handler once per render:
  const isValidRect = rect =>
    rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    !(rect.x === 0 && rect.y === 0);

  const handleDragEnd = useCallback((id, rawPos, type, folderZones) => {
    // coordinate check 
    console.log('⏺️ RAW POS:', rawPos)
    console.log('⏺️ DESKTOP OFFSET:', desktopOffset)
    console.log('⏺️ FOLDER ZONES:', folderZones)

    // Build the file’s bounding box at its drop position:
    const dropX = rawPos.x;
    const dropY = rawPos.y;

    const box = { x: dropX, y: dropY, width: ICON_SIZE, height: ICON_SIZE };

    console.log('FOLDER DROP DEBUG (local):', {
      draggedBox: box,
      folderZones
    });

    const trashZone  = trashRectRef.current;
    const portalZone = portalRectRef.current;
    const backZone   = upRectRef.current;

    // 1) Trash
    if (trashZone && intersects(box, {
          x: trashZone.x - DROP_PADDING,
          y: trashZone.y - DROP_PADDING,
          width:  trashZone.width  + DROP_PADDING * 2,
          height: trashZone.height + DROP_PADDING * 2,
    })) {
      requestDelete(id, type, rawPos);
      return;
    }

    // 2) Rename-portal
    if (portalZone && intersects(box, {
          x: portalZone.x - DROP_PADDING,
          y: portalZone.y - DROP_PADDING,
          width:  portalZone.width  + DROP_PADDING * 2,
          height: portalZone.height + DROP_PADDING * 2,
    })) {
      handleRenameDrop(id, type);
      updatePosition(id, rawPos, type);
      return;
    }

    // 3) Back-arrow (“go up”)
    if (backZone && intersects(box, backZone)) {
      moveIntoFolder(id, parentFolder, type);
      return;
    }

    // 4) Any folder
    for (const zone of folderZones) {
      if (zone.id === id) continue; // Prevent dropping onto itself

      // Calculate overlap area
      const overlapX = Math.max(0, Math.min(box.x + box.width, zone.x + zone.width) - Math.max(box.x, zone.x));
      const overlapY = Math.max(0, Math.min(box.y + box.height, zone.y + zone.height) - Math.max(box.y, zone.y));
      const overlapArea = overlapX * overlapY;
      const boxArea = box.width * box.height;

      // Require at least 40% overlap (adjust as needed)
      const overlapRatio = overlapArea / boxArea;

      // Use a lower threshold for posts, higher for folders
      const threshold = type === 'file' ? 0.3 : 0.7;

      console.log('FOLDER DROP DEBUG:', {
        draggedBox: box,
        folderZone: zone,
        overlapArea,
        overlapRatio,
        boxArea,
        folderId: zone.id,
        itemId: id,
      });

      if (overlapRatio > threshold) {
        console.log('>>> MOVE INTO FOLDER TRIGGERED', { id, folderId: zone.id, type });
        moveIntoFolder(id, zone.id, type);
        return;
      }
    }

    // 5) Otherwise just clamp/reposition
    updatePosition(id, rawPos, type);
  }, [
    parentFolder,
    requestDelete,
    handleRenameDrop,
    updatePosition,
    moveIntoFolder,
    desktopOffset,
  ]);



  // Visible
  const visibleFolders = folders.filter((f) => f.parentFolderId === currentFolderId);
  const visiblePosts = posts.filter((p) => p.parentFolderId === currentFolderId);
  const visibleItems = [...visibleFolders, ...visiblePosts];

  // Drop zones
  const DROP_ZONE_MARGIN = 16;
  const folderRects = visibleFolders.map((f) => ({ 
    id: f.id, 
    x: f.position.x,
    y: f.position.y,
    width: ICON_SIZE,
    height: ICON_SIZE,
  }));


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
    paddingBottom: tabBarHeight,
    },
    logContainer: {
      padding: 8,
      backgroundColor: t.colors.buttonFace,
      borderTopWidth: t.border.width,
      borderTopColor: t.colors.buttonShadow,
    },
    logText: {
      fontFamily: t.font.family,
      fontSize: t.font.sizes.small,
      color: t.colors.text,  
    },
    moveLog: {
      position: 'absolute',
      left: 16,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.small,
      color: t.colors.text,
      backgroundColor: 'transparent',
      textShadowColor: t.colors.buttonShadow,
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 1,
      zIndex: 1000,            // ensure it floats on top
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TextInput
          style={styles.usernameInput}
          value={username}
          onChangeText={saveUsername}
          onBlur={() => saveUsername(username)}
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

      {/* Follow request popup */}
      {request && showPopup && (
        <Win95Popup
          visible
          title="New Follow Request"
          onClose={() => setShowPopup(false)}
        >
          <Text style={{ marginBottom: 12 }}>
            {request.followerUsername} wants to follow you.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Win95Button title="Accept" onPress={() => respond(request.id, true)} />
            <Win95Button title="Reject" onPress={() => respond(request.id, false)} />
          </View>
        </Win95Popup>
      )}


      {/* Rename popup */}
      <Win95Popup
        visible={renamePopup.visible}
        title={`Rename ${renamePopup.type === 'file' ? 'Post' : 'Folder'}`}
        onClose={() => setRenamePopup({ visible: false, id: null, type: null, value: '' })}
        actions={[]}
      >
        <Text>Enter new name:</Text>
        <TextInput
          value={renamePopup.value}
          onChangeText={text => setRenamePopup(r => ({ ...r, value: text }))}
          style={{ borderWidth: 1, borderColor: t.colors.buttonShadow, marginVertical: 12, color: t.colors.text, fontFamily: t.font.family, fontSize: t.font.sizes.body, padding: 6 }}
          autoFocus
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Win95Button title="Cancel" onPress={() => setRenamePopup({ visible: false, id: null, type: null, value: '' })} />
          <Win95Button title="OK" onPress={handleRenameSubmit} style={{ marginLeft: 8 }} />
        </View>
      </Win95Popup>

      <Win95Popup
        visible={deleteConfirm.visible}
        title={`Delete ${deleteConfirm.type === 'file' ? 'Post' : 'Folder'}?`}
        onClose={handleDeleteCancel}
        actions={[]}
      >
        <Text>Are you sure you want to delete this {deleteConfirm.type}?</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <Win95Button title="Cancel" onPress={handleDeleteCancel} />
          <Win95Button title="Delete" onPress={handleDeleteConfirm} style={{ marginLeft: 8 }} />
        </View>
      </Win95Popup>

      {moveLog && (
        <Text
          style={[
            styles.moveLog,
            { bottom: (tabBarHeight || 0) + 100 }
          ]}
        >
          {moveLog}
        </Text>
      )}

      {/* Desktop icons + debug overlays */}
      <View
        ref={desktopRef}
        style={styles.desktopContainer}
        onLayout={(e) => setDesktopHeight(e.nativeEvent.layout.height)}
      >
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
              onDragEnd={(id, pos) => handleDragEnd(id, pos, item.type, folderRects)}
              onTrashDrop={(id, pos) => requestDelete(id, item.type, pos)}
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
          ref={trashImageRef}
          source={require('../assets/images/trash.png')}
          onLayout={e => {
            setTrashRect(e.nativeEvent.layout);
          }}
          style={{
            position: 'absolute',
            width: ICON_SIZE,
            height: ICON_SIZE,
            bottom: tabBarHeight - 15,
            right: TRASH_MARGIN - 15,
          }}
          resizeMode="contain"
        />
        <Image
          ref={portalImageRef}
          source={require('../assets/images/portal.png')}
          onLayout={({ nativeEvent }) => {
            const { x, y, width, height } = nativeEvent.layout;
            // Add the desktop offset so coords become absolute
            setPortalRect({
              x: x + desktopOffset.x,
              y: y + desktopOffset.y,
              width,
              height,
            });
          }}
          style={{
            position: 'absolute',
            width: ICON_SIZE,
            height: ICON_SIZE,
            bottom: tabBarHeight - 15,
            left: TRASH_MARGIN - 15,
          }}
          resizeMode="contain"
        />
        </View>
    </SafeAreaView>
  );
}