import { View, Text, StyleSheet } from 'react-native';

interface Props {
  round: number;
  myScore: number;
  opponentScore: number;
  won: boolean;
}

export function RoundResult({ round, myScore, opponentScore, won }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.round}>Round {round}</Text>
      <View style={styles.scores}>
        <View style={[styles.side, won && styles.winner]}>
          <Text style={styles.scoreText}>{Math.round(myScore)}</Text>
          <Text style={styles.label}>You</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={[styles.side, !won && styles.winner]}>
          <Text style={styles.scoreText}>{Math.round(opponentScore)}</Text>
          <Text style={styles.label}>Opponent</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginVertical: 6 },
  round: { color: '#666', fontSize: 12, marginBottom: 8 },
  scores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', flex: 1, opacity: 0.5 },
  winner: { opacity: 1 },
  scoreText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  label: { color: '#888', fontSize: 12 },
  vs: { color: '#444', fontSize: 16, fontWeight: '700' },
});
