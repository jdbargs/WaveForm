// src/hooks/usePostsAndFolders.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  clampPos,
  intersects,
  ICON_SIZE,
  DROP_PADDING,
  HEADER_HEIGHT,
  BREADCRUMB_HEIGHT,
  clamp
} from '../utils/desktopUtils';

/**
 * Hook to manage posts and folders state, fetching, and drag/drop repositioning.
 *
 * @param {string|null} userId         - Supabase auth user ID
 * @param {number}     desktopHeight   - Height of the desktop container
 * @param {number}     tabBarHeight    - Height of the bottom tab bar
 * @param {boolean}    isFocused       - Indicates if screen is focused
 * @param {{x:number,y:number}} desktopOffset - Screen-to-desktop offset for drop calculations
 * @param {{x:number,y:number,width:number,height:number}} trashRect  - Bounding rect of trash icon
 * @param {{x:number,y:number,width:number,height:number}} portalRect - Bounding rect of portal icon
 * @param {function(string):void} setMoveLog - Setter to display move logs in the parent component
 *
 * @returns {{posts:Array, folders:Array, updatePosition:function, moveIntoFolder:function}}
 */
export default function usePostsAndFolders(
  userId,
  desktopHeight,
  tabBarHeight,
  isFocused,
  desktopOffset,
  trashRect,
  portalRect,
  setMoveLog
) {
  const [posts, setPosts] = useState([]);
  const [folders, setFolders] = useState([]);

  // Fetch user's posts
  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId);
    if (!error && data) {
      setPosts(
        data.map((p, i) => ({
          ...p,
          parentFolderId: p.folder_id ?? null,
          position: clampPos(
            p.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
            desktopHeight,
            tabBarHeight
          ),
          type: 'file'
        }))
      );
    }
  }, [userId, desktopHeight, tabBarHeight]);

  // Fetch user's folders
  const fetchFolders = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);
    if (!error && data) {
      setFolders(
        data.map((f, i) => ({
          ...f,
          parentFolderId: f.parent_folder_id,
          position: clampPos(
            f.position ?? { x: (i % 4) * 100 + 20, y: Math.floor(i / 4) * 120 + 20 },
            desktopHeight,
            tabBarHeight
          ),
          type: 'folder'
        }))
      );
    }
  }, [userId, desktopHeight, tabBarHeight]);

  // Reload data when screen is focused
  useEffect(() => {
    if (isFocused) {
      fetchPosts();
      fetchFolders();
    }
  }, [isFocused, fetchPosts, fetchFolders]);

  /**
   * Clamp and reposition an item to avoid forbidden zones (trash/portal), then persist.
   */
  const updatePosition = useCallback(
    async (id, rawPos, type) => {
      const usableHeight = desktopHeight - tabBarHeight;
      const usableWidth  = window.innerWidth || 0;
      if (usableHeight <= 0 || usableWidth <= 0) return;

      // Initial clamp to desktop
      let pos = clampPos(rawPos, desktopHeight, tabBarHeight);

      // Build forbidden zones
      const forbidden = [];
      if (trashRect?.width) {
        forbidden.push({
          x: trashRect.x - DROP_PADDING,
          y: trashRect.y - DROP_PADDING,
          width:  trashRect.width  + 2 * DROP_PADDING,
          height: trashRect.height + 2 * DROP_PADDING
        });
      }
      if (portalRect?.width) {
        forbidden.push({
          x: portalRect.x - DROP_PADDING,
          y: portalRect.y - DROP_PADDING,
          width:  portalRect.width  + 2 * DROP_PADDING,
          height: portalRect.height + 2 * DROP_PADDING
        });
      }

      // Box for collision detection
      const box = {
        x: rawPos.x - desktopOffset.x,
        y: rawPos.y - desktopOffset.y,
        width: ICON_SIZE,
        height: ICON_SIZE,
      };

      // Resolve collisions
      let tries = 10;
      while (tries-- > 0) {
        const zone = forbidden.find(z => intersects(box, z));
        if (!zone) break;
        // Push below
        pos.y = zone.y + zone.height + 1;
        if (pos.y + ICON_SIZE > usableHeight) {
          // Or above
          pos.y = zone.y - ICON_SIZE - 1;
        }
        // Clamp final
        pos.y = clamp(pos.y, HEADER_HEIGHT + BREADCRUMB_HEIGHT, usableHeight - ICON_SIZE);
        pos.x = clamp(pos.x, 0, usableWidth - ICON_SIZE);
        box.x = pos.x;
        box.y = pos.y;
      }

      pos = clampPos(pos, desktopHeight, tabBarHeight);

      // Persist state & to Supabase
      if (type === 'file') {
        setPosts(ps => ps.map(p => p.id === id ? { ...p, position: pos } : p));
        await supabase.from('posts').update({ position: pos }).eq('id', id);
      } else {
        setFolders(fs => fs.map(f => f.id === id ? { ...f, position: pos } : f));
        await supabase.from('folders').update({ position: pos }).eq('id', id);
      }
    },
    [desktopHeight, tabBarHeight, desktopOffset, trashRect, portalRect]
  );

  /**
   * Move item into a folder, log the action, and persist.
   */
  const moveIntoFolder = useCallback(
    async (id, folderId, type) => {
      // Find item & dest
      const item = (type === 'file' ? posts : folders).find(x => x.id === id);
      const dest = folders.find(f => f.id === folderId);
      const itemName   = type === 'file' ? item?.caption : item?.name;
      const folderName = dest?.name || 'Folder';

      // Log action
      setMoveLog(`${itemName} moved into ${folderName}`);
      setTimeout(() => setMoveLog(null), 2000);

      // Update state & database
      if (type === 'file') {
        setPosts(ps => ps.map(p => p.id === id ? { ...p, parentFolderId: folderId } : p));
        await supabase.from('posts').update({ folder_id: folderId }).eq('id', id);
      } else {
        setFolders(fs => fs.map(f => f.id === id ? { ...f, parentFolderId: folderId } : f));
        await supabase.from('folders').update({ parent_folder_id: folderId }).eq('id', id);
      }
    },
    [folders, posts, setMoveLog]
  );

  return { posts, folders, updatePosition, moveIntoFolder };
}
