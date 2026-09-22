import { useWindowDimensions } from 'react-native';

// One question, answered in one place: is this a phone or something wider?
// iPad, a landscape tablet, a desktop browser. Screens that are a column
// of content cap at READABLE and centre (Screen does this for them); the
// Library goes to two columns; the camera stays full-bleed.
export const WIDE = 700;
export const READABLE = 640;
export const LIBRARY = 980;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  return { width, height, wide, columns: wide ? 2 : 1 };
}
