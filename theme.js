// theme.js
// 80s/90s retro, low-fi pixelated UI theme with a pixel font
export const theme = {
  colors: {
    // Button face grey
    buttonFace: '#CCCCCC',
    // Shadow for buttons (darker border)
    buttonShadow: '#808080',
    // Highlight for top/left edges
    buttonHighlight: '#FFFFFF',
    // Deep retro blue background
    accentBlue: '#0B16B4',
    // Main text color
    text: '#000000',
    // Entire app background
    background: '#0B16B4',
  },
  font: {
    // Use a bitmap-style pixel font for that truly crappy look.
    // Make sure to add PressStart2P.ttf into your assets/fonts and load it with expo-font or react-native link.
    family: 'PressStart2P',
    sizes: {
      header: 18,
      body:   16,
      caption: 14,
    },
    weight: {
      normal: '400',
      bold:   '700',
    }
  },
  spacing: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 16,
  },
  border: {
    width: 2,
    radius: 0,
  },
  dimensions: {
    headerHeight:  92,
    buttonHeight:  32,
    buttonPaddingHorizontal: 16,
    buttonPaddingVertical:   6,
  }
};
