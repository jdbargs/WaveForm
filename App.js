import React, { useEffect, useState } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedScreen from './components/FeedScreen';
import ExploreScreen from './components/ExploreScreen';
import MyPostsScreen from './components/MyPostsScreen';
import RecorderScreen from './components/RecorderScreen';
import AuthScreen from './components/AuthScreen';
import { supabase } from './lib/supabase';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription?.unsubscribe();
    };
  }, []);

  if (!session) {
    return (
      <NavigationContainer>
        <AuthScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Feed') iconName = focused ? 'play' : 'play-outline';
            else if (route.name === 'Explore') iconName = focused ? 'search' : 'search-outline';
            else if (route.name === 'Post') iconName = focused ? 'add-circle' : 'add-circle-outline';
            else if (route.name === 'My Posts') iconName = focused ? 'person' : 'person-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: '#000',
            borderTopColor: '#222',
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Feed" component={FeedScreen} />
        <Tab.Screen name="Explore" component={ExploreScreen} />
        <Tab.Screen name="Post" component={RecorderScreen} />
        <Tab.Screen name="My Posts" component={MyPostsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
