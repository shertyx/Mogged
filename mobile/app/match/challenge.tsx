import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { createChallenge } from '@/api/elo';

export default function ChallengeScreen() {
  const { photos, load } = usePhotos();
  const [opponentID, setOpponentID] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const send = async () => {
    if (!opponentID.trim()) { Alert.alert('Enter opponent ID'); return; }
    if (selected.length !== 3) { Alert.alert('Select exactly 3 photos'); return; }
    setLoading(true);
    try {
      const { match_id } = await createChallenge(opponentID.trim(), selected);
      Alert.alert('Challenge sent!', `Match ID: ${match_id}`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Challenge</Text>
      <TextInput
        style={styles.input}
        placeholder="Opponent user ID"
        placeholderTextColor="#444"
        value={opponentID}
        onChangeText={setOpponentID}
        autoCapitalize="none"
      />
      <Text style={styles.sub}>Select 3 photos ({selected.length}/3)</Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PhotoCard
            photo={item}
            onDelete={() => {}}
            selected={selected.includes(item.id)}
            onSelect={toggleSelect}
          />
        )}
      />
      <Pressable
        style={[styles.btn, (loading || selected.length !== 3) && styles.btnDisabled]}
        onPress={send}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send Challenge'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16 },
  input: { backgroundColor: '#111', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 15 },
  sub: { color: '#666', marginBottom: 12 },
  btn: { marginVertical: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
