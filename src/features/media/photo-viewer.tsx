import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, IconButton, useTheme } from '../../core/ui/components';
import { ZoomablePhoto } from './zoomable-photo';

export function PhotoViewer({
  images,
  initialIndex,
  close,
}: {
  images: { id: string; uri: string }[];
  initialIndex: number;
  close(): void;
}) {
  const c = useTheme(),
    safe = useSafeAreaInsets(),
    { width } = useWindowDimensions();
  const [page, setPage] = useState(initialIndex),
    [height, setHeight] = useState(0),
    [zoomed, setZoomed] = useState(false);
  const list = useRef<FlatList<{ id: string; uri: string }>>(null);
  const [position] = useState(() => new Animated.Value(initialIndex * width));
  const [entrance] = useState(() => new Animated.Value(1));
  const currentPage = useRef(initialIndex);
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);
  useEffect(() => {
    position.setValue(currentPage.current * width);
  }, [position, width]);
  function dismiss() {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) close();
    });
  }
  useEffect(() => {
    const listener = position.addListener(({ value }) =>
      list.current?.scrollToOffset({ offset: value, animated: false }),
    );
    return () => {
      position.stopAnimation();
      position.removeListener(listener);
    };
  }, [position]);
  function show(index: number) {
    if (index < 0 || index >= images.length) return;
    position.stopAnimation();
    setZoomed(false);
    currentPage.current = index;
    setPage(index);
    Animated.timing(position, {
      toValue: index * width,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }
  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <GestureHandlerRootView
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: safe.top,
          paddingBottom: safe.bottom,
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [
              {
                translateX: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, width],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconButton
              icon="arrow_back"
              label="Fotogalerie schließen"
              onPress={dismiss}
            />
            <Text style={{ fontFamily: 'Roboto', fontSize: 22, color: c.ink }}>
              Foto {page + 1} von {images.length}
            </Text>
          </View>
          <View
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
            style={{ flex: 1 }}
          >
            {height > 0 && (
              <FlatList
                key={width}
                ref={list}
                data={images}
                horizontal
                pagingEnabled
                scrollEnabled={!zoomed}
                initialScrollIndex={page}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: index * width,
                  index,
                })}
                keyExtractor={(item) => item.id}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                showsHorizontalScrollIndicator={false}
                onScrollBeginDrag={() => position.stopAnimation()}
                onMomentumScrollEnd={(event) => {
                  const next = Math.max(
                    0,
                    Math.min(
                      images.length - 1,
                      Math.round(event.nativeEvent.contentOffset.x / width),
                    ),
                  );
                  currentPage.current = next;
                  setPage(next);
                  setZoomed(false);
                  position.setValue(next * width);
                }}
                renderItem={({ item, index }) => (
                  <ZoomablePhoto
                    key={`${item.id}-${index === page}`}
                    uri={item.uri}
                    width={width}
                    height={height}
                    onZoom={setZoomed}
                  />
                )}
              />
            )}
          </View>
          <View
            style={{
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-evenly',
            }}
          >
            <IconButton
              icon="chevron_left"
              label="Vorheriges Foto"
              disabled={page === 0}
              onPress={() => show(page - 1)}
            />
            <Body>
              {page + 1} / {images.length}
            </Body>
            <IconButton
              icon="chevron_right"
              label="Nächstes Foto"
              disabled={page + 1 === images.length}
              onPress={() => show(page + 1)}
            />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
