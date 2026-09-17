import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { mascot as c, motion } from '../theme';

// Volt: a geometric owl. The vector lives in assets/mascot/volt.svg; this is
// the same drawing as react-native-svg so every part can move. Volt green is
// spent in two places only - the irises and the card - and focus is a straight
// lid line, not a face, so it survives 24px.
//
// Moods:
//   idle     - gentle bob, blinks now and then. Empty states, quiet moments.
//   thinking - eyes drift side to side, lids lift a little, slight lean.
//   happy    - eyes close to arcs, bounce, card lifts. Deck finished.
//   oops     - lids drop, tufts flare, quick head-shake. A card rated Again.

const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ACircle = Animated.createAnimatedComponent(Circle);

// One egg path. Wings, belly and lids are clipped inside it so nothing ever
// breaks the silhouette.
const BODY =
  'M64 20 C88 20 104 40 104 72 C104 100 88 118 64 118 C40 118 24 100 24 72 C24 40 40 20 64 20 Z';

// The lid is a straight cut from the outer edge (y1) to the centre (y2).
// Lower in the centre reads as concentration; higher reads as surprise.
const LIDS = {
  idle: [41, 47],
  thinking: [37, 39],
  oops: [46, 52],
};

export default function Mascot({ mood = 'idle', size = 72, style }) {
  const reduce = useReducedMotion();

  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const look = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pop = useSharedValue(1);
  const jump = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;

    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // A blink is a fast squash-and-open with a long pause; the pause is what
    // makes it read as a blink rather than a twitch.
    blink.value = withRepeat(
      withSequence(
        withDelay(3200, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;

    if (mood === 'thinking') {
      look.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 650, easing: Easing.inOut(Easing.quad) }),
          withTiming(-4, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      tilt.value = withSpring(-7, motion.soft);
    } else if (mood === 'happy') {
      look.value = withTiming(0, { duration: 200 });
      tilt.value = withSequence(
        withTiming(9, { duration: 110 }),
        withTiming(-9, { duration: 130 }),
        withTiming(5, { duration: 110 }),
        withSpring(0, motion.snap),
      );
      pop.value = withSequence(withSpring(1.18, motion.pop), withSpring(1, motion.soft));
      jump.value = withSequence(
        withTiming(-22, { duration: 220, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 320, mass: 0.6 }),
      );
    } else if (mood === 'oops') {
      look.value = withTiming(0, { duration: 150 });
      tilt.value = withSequence(
        withTiming(-10, { duration: 90 }),
        withTiming(10, { duration: 120 }),
        withTiming(-6, { duration: 110 }),
        withSpring(0, motion.snap),
      );
      jump.value = withSequence(withTiming(5, { duration: 100 }), withSpring(0, motion.soft));
    } else {
      look.value = withTiming(0, { duration: 250 });
      tilt.value = withSpring(0, motion.soft);
    }
  }, [mood, reduce]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value + jump.value },
      { rotate: `${tilt.value}deg` },
      { scale: pop.value },
    ],
  }));

  // Eyes squash on blink and drift with look. Discs stay put; only the iris,
  // pupil and catchlight move, the way real eyes do.
  const discL = useAnimatedProps(() => ({ ry: 17 * blink.value }));
  const discR = useAnimatedProps(() => ({ ry: 17 * blink.value }));
  const irisL = useAnimatedProps(() => ({ cx: 47 + look.value, ry: 10 * blink.value }));
  const irisR = useAnimatedProps(() => ({ cx: 81 + look.value, ry: 10 * blink.value }));
  const pupilL = useAnimatedProps(() => ({ cx: 47 + look.value, ry: 5 * blink.value }));
  const pupilR = useAnimatedProps(() => ({ cx: 81 + look.value, ry: 5 * blink.value }));
  const glintL = useAnimatedProps(() => ({ cx: 44.5 + look.value, opacity: blink.value > 0.5 ? 1 : 0 }));
  const glintR = useAnimatedProps(() => ({ cx: 78.5 + look.value, opacity: blink.value > 0.5 ? 1 : 0 }));

  const happy = mood === 'happy';
  const oops = mood === 'oops';
  const [lidOuter, lidInner] = LIDS[mood] ?? LIDS.idle;
  const flare = oops ? 7 : 0;

  return (
    <Animated.View style={[{ width: size, height: size }, style, bodyStyle]}>
      <Svg width={size} height={size} viewBox="0 0 128 128">
        <Defs>
          <ClipPath id="volt-clip">
            <Path d={BODY} />
          </ClipPath>
        </Defs>

        {/* ear tufts - flare outward when something went wrong */}
        <Path
          d="M34 36 L42 10 L58 30 Z"
          fill={c.body}
          stroke={c.edge}
          strokeWidth={3}
          strokeLinejoin="round"
          transform={`rotate(${-flare} 46 34)`}
        />
        <Path
          d="M94 36 L86 10 L70 30 Z"
          fill={c.body}
          stroke={c.edge}
          strokeWidth={3}
          strokeLinejoin="round"
          transform={`rotate(${flare} 82 34)`}
        />

        <Path d={BODY} fill={c.body} stroke={c.edge} strokeWidth={3} />

        <G clipPath="url(#volt-clip)">
          <Path d="M32 58 C24 76 26 98 38 112 C45 98 45 76 32 58 Z" fill={c.wing} />
          <Path d="M96 58 C104 76 102 98 90 112 C83 98 83 76 96 58 Z" fill={c.wing} />
          <Rect x={48} y={76} width={32} height={32} rx={16} fill={c.belly} />
        </G>

        {happy ? (
          // Closed, smiling eyes: two arcs in bone, same weight as the outline
          // so the face doesn't go thin.
          <>
            <Path d="M34 56 A13 13 0 0 1 60 56" stroke={c.bone} strokeWidth={5} strokeLinecap="round" fill="none" />
            <Path d="M68 56 A13 13 0 0 1 94 56" stroke={c.bone} strokeWidth={5} strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <AEllipse cx={47} cy={52} rx={17} animatedProps={discL} fill={c.bone} />
            <AEllipse cx={81} cy={52} rx={17} animatedProps={discR} fill={c.bone} />
            <AEllipse cy={52} rx={10} animatedProps={irisL} fill={c.volt} />
            <AEllipse cy={52} rx={10} animatedProps={irisR} fill={c.volt} />
            <AEllipse cy={52} rx={5} animatedProps={pupilL} fill={c.ink} />
            <AEllipse cy={52} rx={5} animatedProps={pupilR} fill={c.ink} />
            <ACircle cy={49.5} r={2.2} animatedProps={glintL} fill={c.bone} />
            <ACircle cy={49.5} r={2.2} animatedProps={glintR} fill={c.bone} />

            <G clipPath="url(#volt-clip)">
              <Path d={`M26 ${lidOuter} L64 ${lidInner} L64 28 L26 28 Z`} fill={c.body} />
              <Path d={`M102 ${lidOuter} L64 ${lidInner} L64 28 L102 28 Z`} fill={c.body} />
              <Path
                d={`M28 ${lidOuter} L64 ${lidInner} L100 ${lidOuter}`}
                stroke={c.edge}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          </>
        )}

        <Path d="M58 63 L70 63 L64 73 Z" fill={c.ash} />

        {/* the card - lifts a little when pleased */}
        <G transform={`translate(0 ${happy ? -6 : 0}) rotate(-12 88 98)`}>
          <Rect x={74} y={88} width={28} height={20} rx={4} fill={c.volt} />
          <Rect x={79} y={94} width={14} height={2.5} rx={1.25} fill={c.ink} />
          <Rect x={79} y={100} width={9} height={2.5} rx={1.25} fill={c.ink} />
        </G>

        <Rect x={46} y={112} width={13} height={8} rx={4} fill={c.ash} />
        <Rect x={69} y={112} width={13} height={8} rx={4} fill={c.ash} />
      </Svg>
    </Animated.View>
  );
}
