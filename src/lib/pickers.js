import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { MAX_PAGES } from './api';

/**
 * Each picker resolves to a source shape the API layer understands:
 *   { kind: 'images', pages: [{ uri, size?, name? }], name? }
 *   { kind: 'pdf', uri, size?, name? }
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
    // removes content the model wanted. (It is also incompatible with
    // multi-select.)
    allowsEditing: false,
    // Ten screenshots of a lecture are one deck, not ten. Numbered badges so
    // the pages come through in the order they were picked.
    allowsMultipleSelection: true,
    selectionLimit: MAX_PAGES,
    orderedSelection: true,
  });

  if (result.canceled || !result.assets?.length) return null;
  return {
    kind: 'images',
    pages: result.assets.map((a) => ({
      uri: a.uri,
      size: a.fileSize,
      name: a.fileName || null,
    })),
    name: result.assets[0].fileName?.replace(/\.[^.]+$/, '') || null,
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

  const name = asset.name ? asset.name.replace(/\.[^.]+$/, '') : null;
  if (isPdf) return { kind: 'pdf', uri: asset.uri, size: asset.size, name };
  return { kind: 'images', pages: [{ uri: asset.uri, size: asset.size, name }], name };
}
