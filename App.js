// App.js
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Image,
  TouchableOpacity
} from 'react-native';
import { useFonts } from 'expo-font';
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  StackActions
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import FeedScreen from './components/FeedScreen';
import ExploreScreen from './components/ExploreScreen';
import MyPostsScreen from './components/MyPostsScreen';
import RecorderScreen from './components/RecorderScreen';
import AuthScreen from './components/AuthScreen';
import MessagesScreen from './components/MessagesScreen';
import ChatScreen from './components/ChatScreen';
import SettingsScreen from './components/SettingsScreen';
import Win95Button from './components/Win95Button';

import { supabase } from './lib/supabase';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeProvider, defaultTheme as theme, useTheme } from './theme';

// Import mail icon for header
import MailIcon from './assets/images/mail.png';

//
// Profile Stack
//
const ProfileStack = createNativeStackNavigator();
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator
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
      <ProfileStack.Screen
        name="MyPosts"
        component={MyPostsScreen}
        options={({ navigation }) => ({
          headerBackVisible: false,
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Win95Button
              title="You"
              onPress={() => navigation.navigate('You')}
              style={{ marginLeft: theme.spacing.sm }}
            />
          ),
        })}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={({ navigation }) => ({
          title: 'Settings',
          headerBackVisible: false,
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Win95Button
              title="<"
              onPress={() => navigation.goBack()}
              style={{ marginLeft: theme.spacing.sm }}
            />
          ),
        })}
      />
    </ProfileStack.Navigator>
  );
}

//
// Feed Stack
//
const FeedStack = createNativeStackNavigator();
function FeedStackScreen() {
  const { colors, border, font } = useTheme();

  return (
    <FeedStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.buttonFace,
          borderBottomWidth: border.width,
          borderBottomColor: colors.buttonShadow,
        },
        headerTitleStyle: {
          fontFamily: font.family,
          fontSize: font.sizes.header,
          color: colors.text,
        },
      }}
    >
      <FeedStack.Screen
        name="FeedMain"
        component={FeedScreen}
        options={({ navigation }) => ({
          title: 'Feed',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Messages')}
              style={{
                marginLeft: theme.spacing.sm,
                padding: theme.spacing.xs,
                borderWidth: 2,
                borderColor: '#000',
                borderRadius: 0,
                backgroundColor: theme.colors.buttonFace,
              }}
            >
              <Image source={MailIcon} style={{ width: 32, height: 32 }} />
            </TouchableOpacity>
          ),
        })}
      />
      <FeedStack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
      <FeedStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </FeedStack.Navigator>
  );
}

//
// Bottom Tabs and InnerApp
//
const Tab = createBottomTabNavigator();

function InnerApp() {
  const [session, setSession] = useState(null);
  const [fontsLoaded] = useFonts({
    PressStart2P: require('./assets/fonts/PressStart2P.ttf'),
  });
  const t = useTheme();

  // safe-area hook must be called before any early returns
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_, newSession) =>
      setSession(newSession)
    );
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
  // App.js (or wherever your Tab.Navigator lives)
  const defaultTabBarStyle = {
    position: 'absolute',
    bottom: t.spacing.sm,
    left:   t.spacing.sm,
    right:  t.spacing.sm,
    backgroundColor:  t.colors.buttonFace,
    borderTopWidth:   t.border.width,
    borderTopColor:   t.colors.buttonShadow,
    height:           t.dimensions.buttonHeight * 3,
  };


  const commonOptions = ({ route }) => ({
    tabBarIcon: ({ color }) => {
      let iconName = 'ellipse';
      if (route.name === 'Feed') iconName = 'play-outline';
      if (route.name === 'World') iconName = 'search-outline';
      if (route.name === 'Post') iconName = 'add-circle-outline';
      if (route.name === 'You') iconName = 'person-outline';
      return <Ionicons name={iconName} size={14} color={color} />;
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
  });

  return (
    <ThemeProvider>
      <NavigationContainer>
        {!session ? (
          <AuthScreen />
        ) : (
          <Tab.Navigator screenOptions={commonOptions}>
            <Tab.Screen
              name="Feed"
              component={FeedStackScreen}
              options={({ route }) => {
                const focusedRoute = getFocusedRouteNameFromRoute(route) ?? 'FeedMain';
                const isNested = focusedRoute !== 'FeedMain';
                return {
                  tabBarStyle: isNested
                    ? { display: 'none' } // <-- fully hides the tab bar
                    : defaultTabBarStyle,
                };
              }}
              listeners={({ navigation, route }) => ({
                tabPress: () => {
                  const focusedRoute = getFocusedRouteNameFromRoute(route) ?? 'FeedMain';
                  if (focusedRoute !== 'FeedMain') {
                    navigation.navigate('Feed', { screen: 'FeedMain' });
                  }
                },
              })}
            />
            <Tab.Screen
              name="World"
              component={ExploreScreen}
              options={{ tabBarStyle: defaultTabBarStyle }}
            />
            <Tab.Screen
              name="Post"
              component={RecorderScreen}
              options={{ tabBarStyle: defaultTabBarStyle }}
            />
            <Tab.Screen
              name="You"
              component={ProfileStackScreen}
              options={{ tabBarStyle: defaultTabBarStyle }}
            />
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <InnerApp />
      </ThemeProvider>
    </SafeAreaProvider>
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
