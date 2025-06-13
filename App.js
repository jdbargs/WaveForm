// App.js
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from './theme';
import FeedScreen from './components/FeedScreen';
import ExploreScreen from './components/ExploreScreen';
import MyPostsScreen from './components/MyPostsScreen';
import RecorderScreen from './components/RecorderScreen';
import AuthScreen from './components/AuthScreen';
import { supabase } from './lib/supabase';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeProvider } from './ThemeContext';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);

  // Load pixel font
  const [fontsLoaded] = useFonts({
    PressStart2P: require('./assets/fonts/PressStart2P.ttf'),
  });

  // Supabase session handling
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

  return (
    <ThemeProvider>
      <NavigationContainer>
        {!session ? (
          <AuthScreen />
        ) : (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;
                switch (route.name) {
                  case 'Feed':
                    iconName = focused ? 'play' : 'play-outline';
                    break;
                  case 'Explore':
                    iconName = focused ? 'search' : 'search-outline';
                    break;
                  case 'Post':
                    iconName = focused ? 'add-circle' : 'add-circle-outline';
                    break;
                  case 'My Profile':
                    iconName = focused ? 'person' : 'person-outline';
                    break;
                }
                return <Ionicons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: theme.colors.text,
              tabBarInactiveTintColor: theme.colors.buttonShadow,
              tabBarLabelStyle: {
                fontFamily: theme.font.family,
                fontSize: theme.font.sizes.caption,
              },
              tabBarStyle: {
                position: 'absolute',
                bottom: theme.spacing.sm,
                backgroundColor: theme.colors.background,
                borderTopWidth: theme.border.width,
                borderTopColor: theme.colors.buttonShadow,
                height: theme.dimensions.buttonHeight * 1.5,
              },
              headerShown: false,
            })}
          >
            <Tab.Screen name="Feed" component={FeedScreen} />
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
