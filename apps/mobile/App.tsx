import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text } from 'react-native';
import { getTokens, clearTokens } from './src/storage';
import { getProfile } from './src/api';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { AnnouncementsScreen } from './src/screens/AnnouncementsScreen';
import type { UserProfileDto } from '@la-chat/shared-types';

export type RootStackParamList = {
  Login: undefined;
  ChatList: undefined;
  Chat: { conversationId: string; title?: string };
  Announcements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<UserProfileDto | null>(null);

  useEffect(() => {
    (async () => {
      const tokens = await getTokens();
      if (!tokens) { setInitializing(false); return; }
      try {
        const profile = await getProfile();
        setUser(profile);
      } catch {
        await clearTokens();
      }
      setInitializing(false);
    })();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e3a5f' }}>
        <ActivityIndicator size="large" color="#d4a017" />
        <Text style={{ color: '#d4a017', marginTop: 12 }}>LA Chat</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={DefaultTheme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1e3a5f' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }}>
        {user ? (
          <>
            <Stack.Screen name="ChatList" options={{ title: 'LA Chat' }}>
              {(props) => <ChatListScreen {...props} user={user} onLogout={async () => { setUser(null); }} />}
            </Stack.Screen>
            <Stack.Screen name="Chat" options={({ route }) => ({ title: route.params?.title || 'Chat' })} component={ChatScreen} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements' }} />
          </>
        ) : (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {() => <LoginScreen onLogin={(profile) => setUser(profile)} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
