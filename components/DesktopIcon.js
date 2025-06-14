import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, Image, Text, TouchableWithoutFeedback } from 'react-native';

const ICON_SIZE = 64;

export default function DesktopIcon({ item, onPress, onDragEnd, onDropOnFolder, folderRects = [] }) {
  // Animated value for position
  const pan = useRef(new Animated.ValueXY(item.position)).current;

  // Update position when item.position prop changes
  useEffect(() => {
    pan.setValue(item.position);
  }, [item.position]);

  // Helpers for drop detection
  const isOverFolder = (pos) => {
    const centerX = pos.x + ICON_SIZE / 2;
    const centerY = pos.y + ICON_SIZE / 2;
    return folderRects.find(
      (rect) =>
        centerX >= rect.x &&
        centerX <= rect.x + rect.width &&
        centerY >= rect.y &&
        centerY <= rect.y + rect.height
    );
  };

  // PanResponder for drag behavior
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
        // If dropping over a folder, notify parent
        if (item.type === 'file') {
          const folder = isOverFolder(newPos);
          if (folder) {
            onDropOnFolder(item.id, folder.id);
            return;
          }
        }
        // Otherwise, just update position
        onDragEnd(item.id, newPos);
      }
    })
  ).current;

  // Render icon at animated position
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
