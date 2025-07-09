// src/hooks/useFollowRequests.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export default function useFollowRequests(userId) {
  const [request, setRequest]     = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  // 1️⃣ Fetch the oldest pending request on mount / userId change
  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { data, error } = await supabase
        .from('follow_requests')
        .select(`
          id,
          follower_id,
          followed_id,
          status,
          created_at,
          follower:users!follow_requests_follower_id_fkey(username)
        `)
        .eq('followed_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('pending-request fetch error', error);
      } else if (data) {
        setRequest({ 
          ...data, 
          followerUsername: data.follower.username 
        });
        setShowPopup(true);
      }
    })();
  }, [userId]);

  // 2️⃣ Subscribe to new follow-requests
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('follow-requests-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follow_requests', filter: `followed_id=eq.${userId}` },
        async ({ new: req }) => {
          const { data, error } = await supabase
            .from('follow_requests')
            .select(`
              id,
              follower_id,
              followed_id,
              status,
              created_at,
              follower:users!follow_requests_follower_id_fkey(username)
            `)
            .eq('id', req.id)
            .single();

          if (!error && data) {
            setRequest({
              ...data,
              followerUsername: data.follower.username
            });
            setShowPopup(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 3️⃣ Approve/reject helper
  const respond = useCallback(
    async (requestId, approve) => {
      try {
        // update status
        const { data: updatedReq, error: statusErr } = await supabase
          .from('follow_requests')
          .update({ status: approve ? 'accepted' : 'rejected' })
          .eq('id', requestId)
          .select()
          .single();
        if (statusErr) throw statusErr;

        // if approved, insert into follows
        if (approve) {
          const { error: followErr } = await supabase
            .from('follows')
            .insert({
              follower_id: updatedReq.follower_id,
              followed_id: updatedReq.followed_id
            });
          if (followErr) throw followErr;
        }

        // clear local state
        setShowPopup(false);
        setRequest(null);
      } catch (e) {
        console.error('Error responding to follow request:', e);
      }
    },
    []
  );

  const hide = useCallback(() => setShowPopup(false), []);

  return { request, showPopup, respond, hide };
}
