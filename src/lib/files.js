import { Platform } from 'react-native';
import { File } from 'expo-file-system';

/**
 * Read a local file as a base64 string.
 *
 * Native uses expo-file-system's File API. On web that module has no real
 * filesystem to read from - the picker hands back a blob: URL instead - so we
 * go through fetch and FileReader there. Same signature either way.
 */
export async function readBase64(uri) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        // FileReader gives "data:<mime>;base64,<payload>" - the API wants
        // only the payload.
        const result = String(reader.result);
        const comma = result.indexOf(',');
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.readAsDataURL(blob);
    });
  }

  return await new File(uri).base64();
}
