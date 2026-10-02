import { useState } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Body } from '../../core/ui/components';
export function ZoomablePhoto({
  uri,
  width,
  height,
  onZoom,
}: {
  uri: string;
  width: number;
  height: number;
  onZoom(zoomed: boolean): void;
}) {
  const [size, setSize] = useState({ width, height }),
    [failed, setFailed] = useState(false);
  const fit = Math.min(width / size.width, height / size.height),
    fw = size.width * fit,
    fh = size.height * fit;
  const scale = useSharedValue(1),
    startScale = useSharedValue(1),
    x = useSharedValue(0),
    y = useSharedValue(0),
    sx = useSharedValue(0),
    sy = useSharedValue(0),
    fx = useSharedValue(0),
    fy = useSharedValue(0);
  const constrain = () => {
    'worklet';
    const maxX = Math.max(0, (fw * scale.get() - width) / 2),
      maxY = Math.max(0, (fh * scale.get() - height) / 2);
    x.set(Math.max(-maxX, Math.min(maxX, x.get())));
    y.set(Math.max(-maxY, Math.min(maxY, y.get())));
  };
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      startScale.set(scale.get());
      sx.set(x.get());
      sy.set(y.get());
      fx.set(e.focalX - width / 2);
      fy.set(e.focalY - height / 2);
      scheduleOnRN(onZoom, true);
    })
    .onUpdate((e) => {
      const next = Math.max(1, Math.min(5, startScale.get() * e.scale));
      x.set(fx.get() + ((sx.get() - fx.get()) * next) / startScale.get());
      y.set(fy.get() + ((sy.get() - fy.get()) * next) / startScale.get());
      scale.set(next);
      constrain();
    })
    .onFinalize(() => scheduleOnRN(onZoom, scale.get() > 1.01));
  const pan = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesMove((_, manager) => {
      if (scale.get() > 1.01) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      sx.set(x.get());
      sy.set(y.get());
    })
    .onUpdate((e) => {
      x.set(sx.get() + e.translationX);
      y.set(sy.get() + e.translationY);
      constrain();
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: scale.get() },
    ],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <View
        style={{
          width,
          height,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {failed ? (
          <Body>Foto nicht verfügbar</Body>
        ) : (
          <Animated.View style={[{ width: fw, height: fh }, style]}>
            <Image
              source={{ uri }}
              resizeMode="contain"
              onLoad={(event) => {
                const next = event.nativeEvent.source;
                if (next.width && next.height) setSize(next);
              }}
              onError={() => setFailed(true)}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}
