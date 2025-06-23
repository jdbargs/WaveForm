// theme.js
// 80s/90s retro, low-fi pixelated UI theme with a pixel font
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Background color state with persistence
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  useEffect(() => {
    AsyncStorage.getItem('bgColor')
      .then(saved => {
        if (saved) setBackgroundColor(saved);
      })
      .catch(console.error);
  }, []);

  const changeBackgroundColor = (hex) => {
    setBackgroundColor(hex);
    AsyncStorage.setItem('bgColor', hex).catch(console.error);
  };

  const theme = {
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
      background: backgroundColor,
    },
    font: {
      family: 'PressStart2P',
      sizes: {
        header: 18,
        body: 16,
        caption: 14,
      },
      weight: {
        normal: '400',
        bold: '700',
      },
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
      headerHeight: 92,
      buttonHeight: 32,
      buttonPaddingHorizontal: 16,
      buttonPaddingVertical: 6,
    },
    setBackgroundColor: changeBackgroundColor,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to access theme in components
export const useTheme = () => useContext(ThemeContext);
