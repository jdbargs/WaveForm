// App.js
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from './theme';
import FeedScreen from './components/FeedScreen';
import ExploreScreen from './components/ExploreScreen';
import MyPostsScreen from './components/MyPostsScreen';
import RecorderScreen from './components/RecorderScreen';
import AuthScreen from './components/AuthScreen';
import MessagesScreen from './components/MessagesScreen';
import ChatScreen from './components/ChatScreen';
import { supabase } from './lib/supabase';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeProvider } from './ThemeContext';
import Win95Button from './components/Win95Button';

// Feed Stack
const FeedStack = createNativeStackNavigator();
function FeedStackScreen() {
  return (
    <FeedStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.buttonFace,
          borderBottomWidth: theme.border.width,
          borderBottomColor: theme.colors.buttonShadow,
        },
        headerTitleStyle: {
          fontFamily: theme.font.family,
          fontSize: theme.font.sizes.header,
          color: theme.colors.text,
        },
      }}
    >
      <FeedStack.Screen
        name="FeedMain"
        component={FeedScreen}
        options={({ navigation }) => ({
          title: 'Feed',
          headerLeft: () => (
            <Win95Button
              title="Messages"
              onPress={() => navigation.navigate('Messages')}
              style={{ marginLeft: theme.spacing.sm }}
            />
          ),
        })}
      />
      <FeedStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <FeedStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
    </FeedStack.Navigator>
  );
}

// Bottom Tabs
const Tab = createBottomTabNavigator();
export default function App() {
  const [session, setSession] = useState(null);
  const [fontsLoaded] = useFonts({
    PressStart2P: require('./assets/fonts/PressStart2P.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_, newSession) => setSession(newSession));
    return () => listener.subscription?.unsubscribe();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  const buttonSize = theme.dimensions.buttonHeight * 3;
  const defaultTabBarStyle = {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.buttonFace,
    borderTopWidth: theme.border.width,
    borderTopColor: theme.colors.buttonShadow,
    height: buttonSize,
  };

  const commonOptions = {
    tabBarIcon: ({ color, size }) => {
      // Determine icon based on route name (handled per screen below)
      return <Ionicons name={commonOptions.iconName} size={size} color={color} />;
    },
    tabBarActiveTintColor: theme.colors.text,
    tabBarInactiveTintColor: theme.colors.buttonShadow,
    tabBarItemStyle: {
      backgroundColor: theme.colors.buttonFace,
      width: buttonSize,
      height: buttonSize,
      marginHorizontal: theme.spacing.xs,
      borderWidth: theme.border.width,
      borderColor: theme.colors.buttonShadow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBarLabelStyle: {
      fontFamily: theme.font.family,
      fontSize: theme.font.sizes.caption,
      marginTop: theme.spacing.xs,
    },
    headerShown: false,
  };

  return (
    <ThemeProvider>
      <NavigationContainer>
        {!session ? (
          <AuthScreen />
        ) : (
          <Tab.Navigator>
            <Tab.Screen
              name="Feed"
              component={FeedStackScreen}
              options={({ route }) => {
                const nested = getFocusedRouteNameFromRoute(route) ?? 'FeedMain';
                return {
                  ...commonOptions,
                  tabBarIcon: ({ color }) => (
                    <Ionicons name="play-outline" size={14} color={color} />
                  ),
                  tabBarStyle:
                    nested === 'FeedMain'
                      ? defaultTabBarStyle
                      : { display: 'none' },
                };
              }}
            />
            <Tab.Screen
              name="Explore"
              component={ExploreScreen}
              options={{
                ...commonOptions,
                tabBarIcon: ({ color }) => (
                  <Ionicons name="search-outline" size={14} color={color} />
                ),
                tabBarStyle: defaultTabBarStyle,
              }}
            />
            <Tab.Screen
              name="Post"
              component={RecorderScreen}
              options={{
                ...commonOptions,
                tabBarIcon: ({ color }) => (
                  <Ionicons name="add-circle-outline" size={14} color={color} />
                ),
                tabBarStyle: defaultTabBarStyle,
              }}
            />
            <Tab.Screen
              name="My Profile"
              component={MyPostsScreen}
              options={{
                ...commonOptions,
                tabBarIcon: ({ color }) => (
                  <Ionicons name="person-outline" size={14} color={color} />
                ),
                tabBarStyle: defaultTabBarStyle,
              }}
            />
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
