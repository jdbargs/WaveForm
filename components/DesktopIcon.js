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
  // 1. pan is always just the drag offset
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragging = useRef(false);

  // 2. Reset pan to zero when item.position changes (unless dragging)
  useEffect(() => {
    if (!dragging.current) {
      pan.setValue({ x: 0, y: 0 });
    }
  }, [item.position]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        dragging.current = false;
        // Calculate new absolute position
        const newPos = {
          x: (item.position?.x || 0) + pan.x._value,
          y: (item.position?.y || 0) + pan.y._value,
        };
        pan.setValue({ x: 0, y: 0 }); // Reset for next drag
        onDragEnd(item.id, newPos);
      }
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        {
          position: 'absolute',
          left: item.position.x,
          top: item.position.y,
        },
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