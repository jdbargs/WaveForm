// components/ExploreScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { supabase, followUser, unfollowUser } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';

export default function ExploreScreen() {
  const t = useTheme();                  // <-- make sure ThemeContext.js exports this
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchCurrentUserAndFollows = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;
      setCurrentUserId(user.id);

      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id);
      if (!followError && followData) {
        setFollowingIds(new Set(followData.map(f => f.followed_id)));
      }
    };
    fetchCurrentUserAndFollows();
  }, [isFocused]);

  useEffect(() => {
    const fetchUsers = async () => {
      const q = searchQuery.trim();
      if (!q) {
        setUsers([]);
        return;
      }
      setLoading(true);
      let query = supabase
        .from('users')
        .select('id, username, email')
        .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);
      if (currentUserId) query = query.neq('id', currentUserId);
      const { data, error } = await query;
      if (data) setUsers(data);
      else console.error(error);
      setLoading(false);
    };
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const handleFollowToggle = async id => {
    try {
      if (followingIds.has(id)) {
        await unfollowUser(currentUserId, id);
        const s = new Set(followingIds); s.delete(id); setFollowingIds(s);
      } else {
        await followUser(currentUserId, id);
        const s = new Set(followingIds); s.add(id); setFollowingIds(s);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, padding: t.spacing.md },
    input: {
      height: t.dimensions.buttonHeight,
      borderWidth: t.border.width,
      borderColor: t.colors.buttonShadow,
      backgroundColor: t.colors.buttonFace,
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.md,
    },
    loading: { marginVertical: t.spacing.sm },
    noResults: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      textAlign: 'center',
      marginTop: t.spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.sm,
      borderBottomWidth: t.border.width,
      borderBottomColor: t.colors.buttonShadow,
    },
    userInfo: { flex: 1, marginRight: t.spacing.md },
    username: {
      color: t.colors.text,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.body,
      fontWeight: t.font.weight.bold,
    },
    email: {
      color: t.colors.accentBlue,
      fontFamily: t.font.family,
      fontSize: t.font.sizes.caption,
      marginTop: t.spacing.xs,
    },
  });

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <Win95Button
        title={followingIds.has(item.id) ? 'Unfollow' : 'Follow'}
        onPress={() => handleFollowToggle(item.id)}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TextInput
          placeholder="Search users..."
          placeholderTextColor={t.colors.accentBlue}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.input}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color={t.colors.text} style={styles.loading} />}
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={renderItem}
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
