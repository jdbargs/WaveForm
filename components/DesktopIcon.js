import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, Image, Text, TouchableWithoutFeedback } from 'react-native';

const ICON_SIZE = 80;

export default function DesktopIcon({ item, onPress, onDragEnd }) {
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
      onPanResponderGrant: (evt, gestureState) => {
        dragging.current = true;
        // Jump the icon so its top-left is under the finger
        // (simulate by immediately moving to finger position)
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        dragging.current = false;
        // Place the icon's top-left where the finger is
        const newPos = {
          x: (item.position?.x ?? 0) + gestureState.dx,
          y: (item.position?.y ?? 0) + gestureState.dy,
        };
        onDragEnd(item.id, newPos);
        pan.setValue({ x: 0, y: 0 });
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