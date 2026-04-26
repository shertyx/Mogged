import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TierBadge } from '@/components/TierBadge';
import { getProfile } from '@/api/user';
import { getElo } from '@/api/elo';

interface EloData { score: number; tier: string }
interface ProfileData { id: string; username: string; consent_ai: boolean }

export default function ProfileScreen() {
  const { userID, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);

  useEffect(() => {
    if (!userID) return;
    getProfile().then(setProfile).catch(console.error);
    getElo(userID).then(setElo).catch(console.error);
  }, [userID]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      {profile && (
        <View style={styles.section}>
          <Text style={styles.username}>{profile.username || 'Anonymous'}</Text>
          <Text style={styles.id}>{userID}</Text>
        </View>
      )}
      {elo && (
        <View style={styles.eloSection}>
          <Text style={styles.eloScore}>{elo.score}</Text>
          <Text style={styles.eloLabel}>ELO</Text>
          <TierBadge tier={elo.tier} />
        </View>
      )}
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', paddingHorizontal: 20, marginBottom: 24 },
  section: { paddingHorizontal: 20, marginBottom: 32 },
  username: { color: '#fff', fontSize: 22, fontWeight: '700' },
  id: { color: '#444', fontSize: 11, marginTop: 4 },
  eloSection: { alignItems: 'center', marginBottom: 40, gap: 8 },
  eloScore: { color: '#fff', fontSize: 64, fontWeight: '900' },
  eloLabel: { color: '#555', fontSize: 14 },
  logoutBtn: { marginHorizontal: 20, borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#888', fontSize: 16 },
});
