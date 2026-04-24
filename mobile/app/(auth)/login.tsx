import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { getOAuthURL, exchangeCallback } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { setTokens } = useAuthStore();

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;
      if (code && state) {
        const data = await exchangeCallback(code, state);
        await setTokens(data.access_token, data.refresh_token, data.user_id);
      }
    });
    return () => sub.remove();
  }, []);

  const handleLogin = async () => {
    await WebBrowser.openAuthSessionAsync(
      getOAuthURL(),
      Linking.createURL('/')
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mogged</Text>
      <Text style={styles.subtitle}>How chad are you?</Text>
      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  subtitle: { fontSize: 16, color: '#888' },
  button: { marginTop: 32, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
