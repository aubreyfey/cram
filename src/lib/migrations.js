import AsyncStorage from '@react-native-async-storage/async-storage';

// Data outlives code. Every update replaces the app and keeps the storage,
// so any change to *how* things are stored has to be applied to what is
// already there, once, at launch. This is where that happens.
//
// To change a stored shape: bump SCHEMA, add a step below that rewrites
// the old form into the new one. Steps run in order from the stored
// version to SCHEMA. A fresh install just gets stamped with the current
// number. Loaders stay tolerant of missing fields regardless - migrations
// are for shape changes, not for filling in defaults.
const KEY = 'cram.schema';
export const SCHEMA = 1;

const steps = {
  // 1: the shape everything shipped with. Nothing to do.
};

export async function migrate() {
  let from = 0;
  try {
    from = Number(await AsyncStorage.getItem(KEY)) || 0;
  } catch {
    from = 0;
  }
  if (from >= SCHEMA) return SCHEMA;

  for (let v = from + 1; v <= SCHEMA; v++) {
    const step = steps[v];
    if (step) {
      try {
        await step();
      } catch (e) {
        // A migration that throws must not brick the app; the data is left
        // as it was and the loaders' tolerance carries it. Report it.
        if (__DEV__) console.error(`migration ${v} failed`, e);
        break;
      }
    }
    await AsyncStorage.setItem(KEY, String(v));
  }
  return SCHEMA;
}
