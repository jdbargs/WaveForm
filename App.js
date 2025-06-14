// App.js
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
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

// Import mail icon for header
import MailIcon from './assets/images/mail.png';

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
            <TouchableOpacity
              onPress={() => navigation.navigate('Messages')}
              style={{
                marginLeft: theme.spacing.sm,
                padding: theme.spacing.xs,
                borderWidth: 2,
                borderColor: '#000',
                borderRadius: 0,
                backgroundColor: theme.colors.buttonFace
              }}
            >
              <Image source={MailIcon} style={{ width: 32, height: 32 }} />
            </TouchableOpacity>
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

  return (
    <ThemeProvider>
      <NavigationContainer>
        {!session ? (
          <AuthScreen />
        ) : (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ color }) => {
                let iconName = 'ellipse';
                if (route.name === 'Feed') iconName = 'play-outline';
                if (route.name === 'Explore') iconName = 'search-outline';
                if (route.name === 'Post') iconName = 'add-circle-outline';
                if (route.name === 'My Profile') iconName = 'person-outline';
                return <Ionicons name={iconName} size={14} color={color} />;
              },
              tabBarActiveTintColor: theme.colors.text,
              tabBarInactiveTintColor: theme.colors.buttonShadow,
              tabBarStyle: defaultTabBarStyle,
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
            })}
          >
            <Tab.Screen
              name="Feed"
              component={FeedStackScreen}
              options={({ route }) => {
                const nested = getFocusedRouteNameFromRoute(route) ?? 'FeedMain';
                return {
                  tabBarStyle: nested === 'FeedMain' ? defaultTabBarStyle : { display: 'none' },
                };
              }}
            />
            <Tab.Screen name="Explore" component={ExploreScreen} />
            <Tab.Screen name="Post" component={RecorderScreen} />
            <Tab.Screen name="My Profile" component={MyPostsScreen} />
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
