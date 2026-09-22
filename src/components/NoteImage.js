import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { fileUri } from '../lib/notes';
import { colors } from '../theme';

// A stored note image, or a quiet blank if it is not on this phone (a
// note restored from the cloud has the name, not the bytes).
export default function NoteImage({ image, style, resizeMode = 'cover' }) {
  const [broken, setBroken] = useState(false);
  const uri = fileUri(image);
  if (!uri || broken) return <View style={[style, styles.missing]} />;
  return <Image source={{ uri }} resizeMode={resizeMode} onError={() => setBroken(true)} style={style} />;
}

const styles = StyleSheet.create({
  missing: { backgroundColor: colors.surface },
});
