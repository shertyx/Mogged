import { View, Text, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { ConsentModal } from '@/components/ConsentModal';
import { canUpload, upsertProfile, getProfile } from '@/api/user';

export default function PhotosScreen() {
  const { photos, loading, load, upload, remove } = usePhotos();
  const [showConsent, setShowConsent] = useState(false);
  const [pendingUri, setPendingUri] = useState<{ uri: string; mimeType: string } | null>(null);

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    try {
      await canUpload();
    } catch (e: any) {
      Alert.alert('Cannot upload', e.message);
      return;
    }
    const profile = await getProfile();
    if (!profile?.consent_ai) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPendingUri({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
      setShowConsent(true);
      return;
    }
    pickAndUpload();
  };

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const handleConsentAccept = async () => {
    await upsertProfile('', true);
    setShowConsent(false);
    if (pendingUri) {
      await upload(pendingUri.uri, pendingUri.mimeType);
      setPendingUri(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Photos</Text>
      <Text style={styles.count}>{photos.length}/10 photos</Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PhotoCard photo={item} onDelete={remove} />
        )}
        contentContainerStyle={styles.grid}
      />
      <Pressable style={styles.uploadBtn} onPress={handleUpload} disabled={loading}>
        <Text style={styles.uploadText}>{loading ? 'Uploading…' : '+ Upload Photo'}</Text>
      </Pressable>
      <ConsentModal
        visible={showConsent}
        onAccept={handleConsentAccept}
        onDecline={() => { setShowConsent(false); setPendingUri(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', paddingHorizontal: 20, marginBottom: 4 },
  count: { color: '#666', fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  grid: { paddingHorizontal: 12 },
  uploadBtn: { margin: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  uploadText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
