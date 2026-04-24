import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Photo } from '../store/photos';

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, selected, onSelect }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.selected]}
      onPress={() => onSelect?.(photo.id)}
    >
      {photo.chad_score !== null && (
        <View style={styles.score}>
          <Text style={styles.scoreText}>{Math.round(photo.chad_score)}</Text>
        </View>
      )}
      <Pressable style={styles.delete} onPress={() => onDelete(photo.id)}>
        <Text style={styles.deleteText}>✕</Text>
      </Pressable>
      {photo.chad_score === null && (
        <View style={styles.pending}>
          <Text style={styles.pendingText}>Analyzing…</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '31%', aspectRatio: 1, backgroundColor: '#1a1a1a', borderRadius: 8, margin: '1%', overflow: 'hidden' },
  selected: { borderWidth: 2, borderColor: '#fff' },
  score: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  scoreText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  delete: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(200,0,0,0.8)', borderRadius: 4, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pending: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pendingText: { color: '#666', fontSize: 11 },
});
