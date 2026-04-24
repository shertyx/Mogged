import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ visible, onAccept, onDecline }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>AI Face Analysis</Text>
          <Text style={styles.body}>
            Mogged will analyze your facial features using AI to calculate your chad score.
            Your photo will be stored securely and never shared publicly.
            You can delete your data at any time.
          </Text>
          <Pressable style={styles.accept} onPress={onAccept}>
            <Text style={styles.acceptText}>I Consent</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={onDecline}>
            <Text style={styles.declineText}>No thanks</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, width: '85%', gap: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  body: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  accept: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  acceptText: { color: '#000', fontWeight: '700', fontSize: 16 },
  decline: { alignItems: 'center', paddingVertical: 8 },
  declineText: { color: '#555', fontSize: 14 },
});
