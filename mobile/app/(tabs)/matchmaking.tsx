import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function MatchmakingScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Fight</Text>
      <Pressable style={styles.card} onPress={() => router.push('/match/realtime')}>
        <Text style={styles.cardTitle}>⚡ Real-time Match</Text>
        <Text style={styles.cardSub}>Find an opponent now — 5 min timeout</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => router.push('/match/challenge')}>
        <Text style={styles.cardTitle}>📩 Async Challenge</Text>
        <Text style={styles.cardSub}>Challenge a friend — they have 24h to accept</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20, gap: 16 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 24, gap: 8 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardSub: { color: '#666', fontSize: 14 },
});
