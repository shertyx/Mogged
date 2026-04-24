import { View, Text, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { RoundResult } from '@/components/RoundResult';
import { useRouter } from 'expo-router';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8080';

type Phase = 'selecting' | 'searching' | 'matched' | 'result';

interface Round { round: number; myScore: number; oppScore: number; won: boolean }

export default function RealtimeMatchScreen() {
  const { photos, load } = usePhotos();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('selecting');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [won, setWon] = useState<boolean | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const joinQueue = async () => {
    if (selected.length !== 3) {
      Alert.alert('Select exactly 3 photos');
      return;
    }
    const token = await SecureStore.getItemAsync('access_token');
    setPhase('searching');
    const socket = new WebSocket(`${WS_URL}/matchmaking`, undefined, {
      headers: { Authorization: `Bearer ${token}` },
    } as any);
    ws.current = socket;

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'matched') {
        setPhase('matched');
      } else if (msg.type === 'timeout') {
        setPhase('selecting');
        Alert.alert('No opponent found', 'Try again later');
      } else if (msg.type === 'round') {
        setRounds((r) => [...r, { round: msg.round, myScore: msg.my_score, oppScore: msg.opp_score, won: msg.my_score >= msg.opp_score }]);
      } else if (msg.type === 'match_end') {
        setWon(msg.winner_is_me);
        setPhase('result');
        socket.close();
      }
    };
    socket.onerror = () => {
      setPhase('selecting');
      Alert.alert('Connection error');
    };
  };

  if (phase === 'result') {
    return (
      <View style={styles.container}>
        <Text style={styles.result}>{won ? '🏆 You won!' : '💀 You lost'}</Text>
        {rounds.map((r) => <RoundResult key={r.round} round={r.round} myScore={r.myScore} opponentScore={r.oppScore} won={r.won} />)}
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'searching' || phase === 'matched') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{phase === 'searching' ? 'Finding opponent…' : 'Opponent found!'}</Text>
        <Text style={styles.sub}>{phase === 'searching' ? 'Timeout in 5 minutes' : 'Match starting…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select 3 Photos</Text>
      <Text style={styles.sub}>{selected.length}/3 selected</Text>
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
      <Pressable style={[styles.btn, selected.length !== 3 && styles.btnDisabled]} onPress={joinQueue}>
        <Text style={styles.btnText}>Find Match</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 16 },
  result: { color: '#fff', fontSize: 40, fontWeight: '900', textAlign: 'center', marginBottom: 32 },
  btn: { marginVertical: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
