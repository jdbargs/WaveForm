import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, Image, Text, TouchableWithoutFeedback } from 'react-native';

const ICON_SIZE = 80;

export default function DesktopIcon({ item, onPress, onDragEnd }) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const posRef = useRef(item.position);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) {
      pan.setValue({ x: 0, y: 0 });
    }
  }, [item.position]);

  useEffect(() => { 
    posRef.current = item.position;
    // reset any lingering transform
    pan.setValue({ x: 0, y: 0 });
  }, [item.position]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, { dx, dy }) => {
      pan.setValue({ x: dx, y: dy });
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      // now use the _current_ position, not the one from mount
      const newPos = {
        x: posRef.current.x + dx,
        y: posRef.current.y + dy,
      };
      onDragEnd(item.id, newPos);
      pan.setValue({ x: 0, y: 0 });
    },
  })).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        transform: pan.getTranslateTransform(),
      }}
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