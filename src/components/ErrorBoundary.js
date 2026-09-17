import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Mascot from './Mascot';
import PrimaryButton from './PrimaryButton';
import { reportError } from '../lib/monitoring';
import { colors, space, type } from '../theme';

// In a release build an uncaught render error is a white screen with no way
// out except force-quitting. Decks live in AsyncStorage, so "start over" here
// costs nothing - it just remounts the tree.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.error(error);
    reportError(error, { componentStack: info?.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Mascot mood="idle" size={80} style={{ marginBottom: space(6) }} />
        <Text style={styles.title}>Something broke</Text>
        <Text style={styles.body}>Your decks are safe. Tap below to pick up where you were.</Text>
        {__DEV__ ? <Text style={styles.detail}>{String(this.state.error?.message)}</Text> : null}
        <PrimaryButton label="Start over" onPress={this.reset} style={{ marginTop: space(8) }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(8),
  },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  body: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(3) },
  detail: { ...type.mono, color: colors.textFaint, textAlign: 'center', marginTop: space(4) },
});
