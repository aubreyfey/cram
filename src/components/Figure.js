import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { figureUri } from '../lib/figures';
import { radius, space } from '../theme';

// The picture on a card: a diagram, a graph, a labelled structure, cropped
// from the page it was scanned from. Renders nothing when the card has no
// figure for this side, or the file is not on this phone (a deck restored
// from the cloud carries the name, not the bytes) - the card is then just
// its text, which still works.
export default function Figure({ figure, side, height = 150, style }) {
  const [broken, setBroken] = useState(false);
  const uri = figure && figure.side === side ? figureUri(figure) : null;
  if (!uri || broken) return null;
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      onError={() => setBroken(true)}
      style={[styles.image, { height }, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: '#fff',
    marginBottom: space(4),
  },
});
