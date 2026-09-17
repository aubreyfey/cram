import { Alert, Platform } from 'react-native';

// react-native-web ships Alert.alert as an empty function, so on the web
// build every confirm silently did nothing. Native keeps the real sheet;
// web falls back to the browser's own dialogs, which are ugly but honest.
//   0 actions           -> window.alert
//   1 action (+cancel)  -> window.confirm
//   2+ actions          -> window.prompt with a numbered list
export function alert(title, message, buttons) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);

  const text = [title, message].filter(Boolean).join('\n\n');
  const all = buttons || [];
  const cancel = all.find((b) => b.style === 'cancel');
  const actions = all.filter((b) => b.style !== 'cancel');

  if (actions.length === 0) {
    window.alert(text);
    all[0]?.onPress?.();
    return;
  }
  if (actions.length === 1) {
    const ok = window.confirm(`${text}\n\nOK = ${actions[0].text}`);
    (ok ? actions[0] : cancel)?.onPress?.();
    return;
  }
  const list = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  const answer = window.prompt(`${text}\n\n${list}\n\nType a number:`);
  const pick = actions[parseInt(answer, 10) - 1];
  (pick ?? cancel)?.onPress?.();
}
