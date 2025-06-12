// components/ExploreScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { supabase, followUser, unfollowUser } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const isFocused = useIsFocused();

  // 1) Fetch current user and their follow list
  useEffect(() => {
    const fetchCurrentUserAndFollows = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error fetching current user:', userError);
        return;
      }
      setCurrentUserId(user.id);

      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id);

      if (followError) {
        console.error('Error fetching follow list:', followError);
      } else {
        setFollowingIds(new Set(followData.map(f => f.followed_id)));
      }
    };
    fetchCurrentUserAndFollows();
  }, [isFocused]);

  // 2) Fetch users matching the search query (by username OR email)
  useEffect(() => {
    const fetchUsers = async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setUsers([]);
        return;
      }
      setLoading(true);

      console.log(`[Explore] Searching for "${trimmed}" (exclude: ${currentUserId})`);

      let query = supabase
        .from('users')
        .select('id, username, email')
        .or(`username.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(50);

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query;
      console.log('[Explore] fetchUsers result:', data, error);

      if (error) {
        console.error('Error searching users:', error);
        setUsers([]);
      } else {
        setUsers(data);
      }
      setLoading(false);
    };

    const handler = setTimeout(fetchUsers, 300); // debounce
    return () => clearTimeout(handler);
  }, [searchQuery, currentUserId]);

  // 3) Toggle follow/unfollow
  const handleFollowToggle = async (userId) => {
    try {
      if (followingIds.has(userId)) {
        await unfollowUser(currentUserId, userId);
        const updated = new Set(followingIds);
        updated.delete(userId);
        setFollowingIds(updated);
      } else {
        await followUser(currentUserId, userId);
        const updated = new Set(followingIds);
        updated.add(userId);
        setFollowingIds(updated);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  // 4) Render each user row
  const renderItem = ({ item }) => (
    <View style={styles.userRow}>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleFollowToggle(item.id)}
        style={[
          styles.button,
          followingIds.has(item.id) ? styles.unfollowButton : styles.followButton
        ]}
      >
        <Text style={styles.buttonText}>
          {followingIds.has(item.id) ? 'Unfollow' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TextInput
          placeholder="Search users..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color="#fff" style={styles.loading} />}
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            !loading && searchQuery.trim() ? (
              <Text style={styles.noResults}>No users found.</Text>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000'
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16
  },
  searchInput: {
    height: 40,
    borderColor: '#444',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    marginTop: 32,
    marginBottom: 12
  },
  loading: {
    marginVertical: 10
  },
  noResults: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1
  },
  userInfo: {
    flex: 1,
    marginRight: 12
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  email: {
    color: '#888',
    fontSize: 14,
    marginTop: 2
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20
  },
  followButton: {
    backgroundColor: '#1DB954'
  },
  unfollowButton: {
    backgroundColor: '#333'
  },
  buttonText: {
    color: '#fff',
    fontSize: 14
  }
});
