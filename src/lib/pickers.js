import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Each picker resolves to a source shape the API layer understands:
 *   { uri, kind: 'image' | 'pdf', size?, name? }
 * or null when the user backed out, which is not an error.
 */

export async function pickFromLibrary() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    const err = new Error('Cram needs access to your photos to import one.');
    err.code = 'permission';
    throw err;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    // No editing step - cropping a lecture slide before it is read only ever
    // removes content the model wanted.
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    kind: 'image',
    size: asset.fileSize,
    name: asset.fileName || null,
  };
}

export async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const isPdf =
    asset.mimeType === 'application/pdf' ||
    asset.name?.toLowerCase().endsWith('.pdf');

  return {
    uri: asset.uri,
    kind: isPdf ? 'pdf' : 'image',
    size: asset.size,
    name: asset.name ? asset.name.replace(/\.[^.]+$/, '') : null,
  };
}
