import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKENS_KEY = 'la-chat-tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<StoredTokens | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(TOKENS_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setTokens(tokens: StoredTokens): Promise<void> {
  const raw = JSON.stringify(tokens);
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKENS_KEY, raw);
  } else {
    await SecureStore.setItemAsync(TOKENS_KEY, raw);
  }
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKENS_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  }
}
