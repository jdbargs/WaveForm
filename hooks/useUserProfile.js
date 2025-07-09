// src/hooks/useUserProfile.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export default function useUserProfile() {
  const [profile, setProfile] = useState({
    userId: null,
    username: '',
    isPrivate: false,
    loaded: false,
  });

  // load auth + profile
  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error: authErr
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        console.error(authErr);
        setProfile(p => ({ ...p, loaded: true }));
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('username, is_private')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile({
          userId:   user.id,
          username: data.username,
          isPrivate: data.is_private,
          loaded:    true,
        });
      }
    })();
  }, []);

  // updater for username
  const saveUsername = useCallback(
    async (newName) => {
      if (!profile.userId) return;
      const { error } = await supabase
        .from('users')
        .update({ username: newName })
        .eq('id', profile.userId);
      if (error) console.error(error);
      else setProfile(p => ({ ...p, username: newName }));
    },
    [profile.userId]
  );

  return { ...profile, saveUsername };
}
