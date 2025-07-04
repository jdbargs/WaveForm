import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Image,
  Text,
  TouchableWithoutFeedback,
} from 'react-native';

const ICON_SIZE = 80;

export default function DesktopIcon({ item, onPress, onDragEnd }) {
  const pan = useRef(new Animated.ValueXY()).current;

  // 1️⃣ On mount only, set the Animated value to the item's position.
  //    We do *not* touch offset here.
  useEffect(() => {
    pan.setValue({ x: item.position.x, y: item.position.y });
  }, []);

  // ...after your existing useEffect that runs on mount:
  useEffect(() => {
    // Whenever the parent's item.position changes,
    // reset any offset and jump the Animated.Value there
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({
      x: item.position.x,
      y: item.position.y
    });
  }, [item.position.x, item.position.y]);


  // 2️⃣ Build your PanResponder once, using the
  // "extract offset on grant / flatten on release" pattern.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: () => {
        // Take whatever absolute is in pan.x/_value
        // and push it into offset, zero out the delta.
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event(
        [ null, { dx: pan.x, dy: pan.y } ],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: () => {
        // Merge offset + delta into the base value, clear offset
        pan.flattenOffset();
        // Read out the new absolute
        const newX = pan.x._value;
        const newY = pan.y._value;
        // Tell your parent to persist it
        onDragEnd(item.id, { x: newX, y: newY });
        // **no manual setValue or setOffset here**
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        // All movement comes from transform now
        transform: pan.getTranslateTransform(),
      }}
    >
      <TouchableWithoutFeedback onPress={() => onPress?.(item)}>
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
            style={{ width: ICON_SIZE, textAlign: 'center', marginTop: 4 }}
          >
            {item.caption || item.name}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}
