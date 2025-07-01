import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, Image, Text, TouchableWithoutFeedback } from 'react-native';

const ICON_SIZE = 80;

export default function DesktopIcon({
  item,
  onPress,
  onDragEnd,
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragging = useRef(false);

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
      onPanResponderMove: (evt, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: () => {
        dragging.current = false;
        const newPos = {
          x: (item.position?.x ?? 0) + pan.x._value,
          y: (item.position?.y ?? 0) + pan.y._value,
        };
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
          left: item.position?.x ?? 0,
          top: item.position?.y ?? 0,
        },
        { transform: pan.getTranslateTransform() }
      ]}
    >
      <TouchableWithoutFeedback onPress={() => onPress && onPress(item)}>
        <View style={{ alignItems: 'center' }}>
          <Image
            source={item.type === 'folder'
              ? require('../assets/images/folder.png')
              : require('../assets/images/file.png')}
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