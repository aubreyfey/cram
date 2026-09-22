import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NoteImage from './NoteImage';
import { colors, space, type } from '../theme';

// Tap a photo, see the photo: full screen, black, the whole image, swipe
// to the next one from the same note. Tap anywhere or Close to leave.
//
//   images   the note's images
//   index    which one to open on
export default function PhotoViewer({ images, index = 0, visible, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index);
  const scroll = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setPage(index);
    // Land on the tapped photo once the modal has laid out.
    const t = setTimeout(() => scroll.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(t);
  }, [visible, index, width]);

  if (!images?.length) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((img, i) => (
            <Pressable key={img.file || img.uri || i} onPress={onClose} style={{ width, height }}>
              <NoteImage image={img} resizeMode="contain" style={styles.image} />
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.top, { paddingTop: insets.top + space(3) }]} pointerEvents="box-none">
          <Text style={styles.count}>{images.length > 1 ? `${page + 1} / ${images.length}` : ''}</Text>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  image: { width: '100%', height: '100%', backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
  },
  count: { ...type.mono, color: colors.textDim },
  close: { ...type.body, fontWeight: '700', color: colors.text },
});
