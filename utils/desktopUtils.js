// src/utils/desktopUtils.js
import { Dimensions } from 'react-native';
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

export const ICON_SIZE        = 80;
export const TRASH_MARGIN     = 20;
export const HEADER_HEIGHT    = 56;
export const BREADCRUMB_HEIGHT= 48;
export const DROP_PADDING     = 0;

export function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

// now you have WINDOW_WIDTH in scope
export function clampPos(pos, desktopHeight, tabBarHeight) {
  return {
    x: clamp(pos.x, 0, WINDOW_WIDTH - ICON_SIZE),
    y: clamp(pos.y, 0, (desktopHeight - tabBarHeight) - ICON_SIZE),
  };
}

export function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width  > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
