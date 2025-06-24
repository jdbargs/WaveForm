// components/Win95Button.js
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export default function Win95Button({ title, onPress, children, style }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: t.colors.buttonFace,
          borderColor: t.colors.buttonShadow,
          paddingHorizontal: t.dimensions.buttonPaddingHorizontal,
          paddingVertical: t.dimensions.buttonPaddingVertical,
          height: t.dimensions.buttonHeight,
        },
        style,
      ]}
    >
      {children ? (
        children
      ) : (
        <Text
          style={{
            color: t.colors.text,
            fontFamily: t.font.family,
            fontSize: t.font.sizes.body,
            fontWeight: t.font.weight.bold,
          }}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 0,
    shadowOffset: { width: -1, height: -1 },
    shadowColor: '#fff',
    shadowOpacity: 1,
    elevation: 0
  }
});
