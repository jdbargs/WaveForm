// components/DesktopIcon.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Image,
  Text,
  TouchableWithoutFeedback
} from 'react-native';

const ICON_SIZE = 80;

export default function DesktopIcon({
  item,
  onPress,
  onDragEnd,
  onDropOnFolder = () => {},
  onTrashDrop,
  onDropOnBack = () => {},
  folderRects = [],
  trashRect,
  backRect = null
}) {
  // Animated value for position
  // ensure we always have numeric x & y
  const { x = 0, y = 0 } = item.position || {};
  const initialPos = { x: Number(x), y: Number(y) };
  const pan = useRef(new Animated.ValueXY(initialPos)).current;


  // Sync to prop changes
  useEffect(() => {
    pan.setValue(item.position);
  }, [item.position]);

  // Helpers to test a point against a rect
  const isPointInRect = (x, y, rect) =>
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height;

  const isOverFolder = (pos) => {
    const cx = pos.x + ICON_SIZE / 2;
    const cy = pos.y + ICON_SIZE / 2;
    return folderRects.find((r) => isPointInRect(cx, cy, r));
  };

  const isOverTrash = (pos) => {
    if (!trashRect) return false;
    const cx = pos.x + ICON_SIZE / 2;
    const cy = pos.y + ICON_SIZE / 2;
    return isPointInRect(cx, cy, trashRect);
  };

  // PanResponder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const newPos = { x: pan.x._value, y: pan.y._value };
        const cx = newPos.x + ICON_SIZE/2;
        const cy = newPos.y + ICON_SIZE/2;

        // 0) Dropped on Up‐arrow? (move back to parent)
        if (backRect && cx >= backRect.x && cx <= backRect.x + backRect.width &&
            cy >= backRect.y && cy <= backRect.y + backRect.height) {
          onDropOnBack(item.id);
          return;
        }

        // 1) Trash drop?
        if (isOverTrash(newPos)) {
          onTrashDrop(item.id, item.type);
          return;
        }

        // 2) Folder drop?
        const folder = isOverFolder(newPos);
        if (folder) {
          onDropOnFolder(item.id, folder.id);
          return;
        }

        // 3) Otherwise, just reposition
        onDragEnd(item.id, newPos);
      }
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        { position: 'absolute' },
        { transform: pan.getTranslateTransform() }
      ]}
    >
      <TouchableWithoutFeedback onPress={() => onPress && onPress(item)}>
        <View style={{ alignItems: 'center' }}>
          <Image
            source={
              item.type === 'folder'
                ? require('../assets/images/folder.png')
                : require('../assets/images/file.png')
            }
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
            resizeMode="contain"
          />
          <Text
            numberOfLines={1}
            style={{ width: 80, textAlign: 'center', marginTop: 4 }}
          >
            {item.caption || item.name}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}
