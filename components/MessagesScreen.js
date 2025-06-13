// components/MessagesScreen.js
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Alert
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../ThemeContext';
import Win95Button from './Win95Button';
import { v4 as uuidv4 } from 'uuid';

export default function MessagesScreen({ navigation }) {
  const t = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // fetch current user
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user || null);
    })();
  }, []);

  // hide tab bar on focus, restore on blur
  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  // header back button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Win95Button
          title="<"
          onPress={() => navigation.goBack()}
          style={{ marginLeft: t.spacing.sm }}
        />
      )
    });
  }, [navigation, t]);

  // fetch chats
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const { data, error } = await supabase
        .from('chat_members')
        .select('chat_id, chats(name)')
        .eq('user_id', currentUser.id);
      if (!error && data) {
        setChats(data.map(item => ({ chat_id: item.chat_id, name: item.chats.name })));
      }
    })();
  }, [currentUser]);

  // search users
  useEffect(() => {
    if (!searchQuery.trim() || !currentUser) {
      setUsers([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `%${searchQuery}%`);
      if (!error && data) {
        setUsers(data.filter(u => u.id !== currentUser.id));
      }
    })();
  }, [searchQuery, currentUser]);

  const toggleSelect = (user) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const createChat = async () => {
    if (!newChatName.trim()) {
      Alert.alert('Chat name required', 'Please enter a chat name.');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Add users', 'Please select at least one user.');
      return;
    }
    try {
      const chatId = uuidv4();
      const { error: chatErr } = await supabase.from('chats').insert([{ id: chatId, name: newChatName }]);
      if (chatErr) throw chatErr;
      const members = [
        { chat_id: chatId, user_id: currentUser.id },
        ...selectedUsers.map(u => ({ chat_id: chatId, user_id: u.id }))
      ];
      const { error: memErr } = await supabase.from('chat_members').insert(members);
      if (memErr) throw memErr;
      setNewChatName('');
      setSearchQuery('');
      setSelectedUsers([]);
      // refresh chats
      const { data, error } = await supabase
        .from('chat_members')
        .select('chat_id, chats(name)')
        .eq('user_id', currentUser.id);
      if (!error && data) {
        setChats(data.map(item => ({ chat_id: item.chat_id, name: item.chats.name })));
      }
      navigation.navigate('Chat', { chatId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not create chat.');
    }
  };

  const deleteChat = (chatId) => {
    Alert.alert('Delete chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('chat_messages').delete().eq('chat_id', chatId);
            await supabase.from('chat_members').delete().eq('chat_id', chatId);
            await supabase.from('chats').delete().eq('id', chatId);
            setChats(prev => prev.filter(c => c.chat_id !== chatId));
          } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not delete chat.');
          }
        }
      }
    ]);
  };

  const renderUser = ({ item }) => (
    <Win95Button
      title={item.username}
      onPress={() => toggleSelect(item)}
      style={{
        marginBottom: t.spacing.xs,
        backgroundColor: selectedUsers.find(u => u.id === item.id)
          ? t.colors.primary
          : t.colors.buttonFace
      }}
    />
  );

  const renderChat = ({ item }) => (
    <View style={[styles.chatRow, { marginBottom: t.spacing.sm }]}> 
      <Win95Button
        title={item.name || 'Untitled'}
        onPress={() => navigation.navigate('Chat', { chatId: item.chat_id })}
        style={{ flex: 1 }}
      />
      <Win95Button
        title="X"
        onPress={() => deleteChat(item.chat_id)}
        style={{
          marginLeft: t.spacing.xs,
          width: 32,
          height: 32,
          paddingHorizontal: 0,
          justifyContent: 'center'
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: t.colors.background }]}> 
      <View style={[styles.container, { padding: t.spacing.md }]}> 
        <TextInput
          style={[
            styles.input,
            {
              borderColor: t.colors.buttonShadow,
              backgroundColor: t.colors.buttonFace,
              color: t.colors.text,
              fontFamily: t.font.family,
              fontSize: t.font.sizes.body
            }
          ]}
          placeholder="New chat name"
          placeholderTextColor={t.colors.buttonShadow}
          value={newChatName}
          onChangeText={setNewChatName}
        />
        <TextInput
          style={[
            styles.input,
            {
              borderColor: t.colors.buttonShadow,
              backgroundColor: t.colors.buttonFace,
              color: t.colors.text,
              fontFamily: t.font.family,
              fontSize: t.font.sizes.body
            }
          ]}
          placeholder="Add users"
          placeholderTextColor={t.colors.buttonShadow}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {/* Create Chat button moved here */}
        <Win95Button
          title="Create Chat"
          onPress={createChat}
          style={{ marginBottom: t.spacing.md }}
        />
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={renderUser}
          style={{ maxHeight: 150, marginBottom: t.spacing.md }}
          ListEmptyComponent={
            searchQuery.trim() ? (
              <Text style={{ color: t.colors.text }}>No matches.</Text>
            ) : null
          }
        />
        {!!selectedUsers.length && (
          <Text style={[styles.selectedInfo, { color: t.colors.text }]}>Adding: {selectedUsers.map(u => u.username).join(', ')}</Text>
        )}
        <FlatList
          data={chats}
          keyExtractor={item => item.chat_id}
          renderItem={renderChat}
          ListEmptyComponent={<Text style={[styles.empty, { color: t.colors.text }]}>No chats yet.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  input: { height: 40, borderWidth: 1, paddingHorizontal: 8, marginBottom: 8 },
  chatRow: { flexDirection: 'row', alignItems: 'center' },
  selectedInfo: { marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 16 }
});
