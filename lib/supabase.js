// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hppvbcggmujfnvqnmhew.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcHZiY2dnbXVqZm52cW5taGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2NDY3MzgsImV4cCI6MjA2NTIyMjczOH0.iC2pX0OIqUdXwfcVvX4gkMQktkpysMM4RbAnl_7Ycsc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


/**
 * Follow a user by inserting a row into the follows table.
 * @param {string} followerId – the user who is doing the following
 * @param {string} followeeId – the user to be followed
 * @returns {Promise<Object[]>} the inserted row(s)
 */
export async function followUser(followerId, followeeId) {
  const { data, error } = await supabase
    .from('follows')
    .insert([
      { follower_id: followerId, followed_id: followeeId }
    ]);

  if (error) {
    console.error('Error following user:', error);
    throw error;
  }
  return data;
}

/**
 * Unfollow a user by deleting the corresponding row from the follows table.
 * @param {string} followerId – the user who is unfollowing
 * @param {string} followeeId – the user to be unfollowed
 * @returns {Promise<Object[]>} the deleted row(s)
 */
export async function unfollowUser(followerId, followeeId) {
  const { data, error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', followeeId);

  if (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
  return data;
}

export async function setPrivacy(isPrivate) {
  return supabase
    .from('users')
    .update({ is_private: isPrivate })
    .eq('id', supabase.auth.user().id);
}

export async function sendFollowRequest(toUserId) {
  return supabase
    .from('follow_requests')
    .insert({ follower_id: supabase.auth.user().id, followed_id: toUserId });
}

export async function getPendingFollowRequests() {
  return supabase
    .from('follow_requests')
    .select('*')
    .eq('followed_id', supabase.auth.user().id)
    .eq('status', 'pending');
}

export async function respondFollowRequest(requestId, accept) {
  return supabase
    .from('follow_requests')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', requestId);
}

export async function getAcceptedFollowIds() {
  const { data } = await supabase
    .from('follow_requests')
    .select('follower_id')
    .eq('status', 'accepted')
    .eq('follower_id', supabase.auth.user().id);
  return data.map(r => r.followed_id);
}
