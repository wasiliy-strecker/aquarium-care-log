// Adapted from SerienLog's read-only example gallery (MPL-2.0).
import { useCallback, useRef, useState } from 'react';
import { messages } from '../../core/texts';
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  View,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, IconButton, useTheme } from '../../core/ui/components';
import { useSheetDrag } from '../../core/ui/use-sheet-drag';
import { overlayFrameStyle } from '../../core/ui/overlay-frame';
import { photoExamples, type PhotoExample } from './photo-examples';

export function PhotoExamplesButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const close = useCallback(() => setVisible(false), []);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Button
        title={messages.photoExamples.open}
        icon="photo_library_outlined"
        textOnly
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setVisible(true);
        }}
      />
      {visible && <PhotoExamplesGallery close={close} />}
    </View>
  );
}

function ExampleImage({
  example,
  width,
  height,
}: {
  example: PhotoExample;
  width: number;
  height: number;
}) {
  const c = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width, height, paddingHorizontal: 4 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: c.input,
          justifyContent: 'center',
        }}
      >
        {failed ? (
          <Body style={{ padding: 16, textAlign: 'center' }}>
            {messages.photoExamples.unavailable}
          </Body>
        ) : (
          <Image
            source={example.source()}
            resizeMode="contain"
            accessibilityLabel={messages.photoExamples.imageLabel.replace(
              '{label}',
              example.label,
            )}
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </View>
    </View>
  );
}

function PhotoExamplesGallery({ close }: { close(): void }) {
  const c = useTheme(),
    safe = useSafeAreaInsets();
  const [index, setIndex] = useState(0),
    [width, setWidth] = useState(0);
  const list = useRef<FlatList<PhotoExample>>(null);
  const sheet = useSheetDrag(true, true, close);
  const imageHeight = width * (3 / 4);
  function goTo(next: number) {
    if (next < 0 || next >= photoExamples.length) return;
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={close}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: '#00000066',
            paddingTop: safe.top,
          }}
        >
          <Pressable
            accessibilityLabel={messages.photoExamples.dismiss}
            onPress={close}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <GestureDetector gesture={sheet.pan}>
            <Animated.View
              accessibilityViewIsModal
              onLayout={sheet.onLayout}
              style={[
                {
                  backgroundColor: c.card,
                  ...overlayFrameStyle(c.primary),
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  width: '100%',
                  maxWidth: 640,
                  height: '90%',
                  alignSelf: 'center',
                  padding: 16,
                  paddingBottom: safe.bottom + 16,
                  gap: 8,
                },
                sheet.style,
              ]}
            >
              <View
                style={{
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: c.muted,
                  alignSelf: 'center',
                  marginBottom: 4,
                }}
              />
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Body strong style={{ fontSize: 22, lineHeight: 28, flex: 1 }}>
                  {messages.photoExamples.title}
                </Body>
                <IconButton
                  icon="close"
                  label={messages.photoExamples.close}
                  onPress={close}
                />
              </View>
              <GestureDetector gesture={sheet.nativeScroll}>
                <Animated.ScrollView
                  onLayout={sheet.onScrollLayout}
                  onScroll={sheet.onScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                >
                  <Body>{messages.photoExamples.guidance}</Body>
                  <View
                    onLayout={(event) =>
                      setWidth(event.nativeEvent.layout.width)
                    }
                  >
                    {width > 0 && (
                      <FlatList
                        key={width}
                        ref={list}
                        data={photoExamples}
                        horizontal
                        pagingEnabled
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={index}
                        initialNumToRender={1}
                        maxToRenderPerBatch={2}
                        windowSize={3}
                        keyExtractor={(item) => item.id}
                        getItemLayout={(_, page) => ({
                          length: width,
                          offset: page * width,
                          index: page,
                        })}
                        onMomentumScrollEnd={(event) =>
                          setIndex(
                            Math.max(
                              0,
                              Math.min(
                                photoExamples.length - 1,
                                Math.round(
                                  event.nativeEvent.contentOffset.x / width,
                                ),
                              ),
                            ),
                          )
                        }
                        renderItem={({ item }) => (
                          <ExampleImage
                            example={item}
                            width={width}
                            height={imageHeight}
                          />
                        )}
                      />
                    )}
                  </View>
                  <Body strong style={{ textAlign: 'center', fontSize: 16 }}>
                    {photoExamples[index]!.label}
                  </Body>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <IconButton
                      icon="chevron_left"
                      label={messages.photoExamples.previous}
                      disabled={index === 0}
                      onPress={() => goTo(index - 1)}
                    />
                    <View accessibilityLiveRegion="polite">
                      <Body>
                        {messages.photoExamples.position
                          .replace('{current}', String(index + 1))
                          .replace('{total}', String(photoExamples.length))}
                      </Body>
                    </View>
                    <IconButton
                      icon="chevron_right"
                      label={messages.photoExamples.next}
                      disabled={index === photoExamples.length - 1}
                      onPress={() => goTo(index + 1)}
                    />
                  </View>
                  <Body muted style={{ textAlign: 'center', fontSize: 12 }}>
                    {messages.photoExamples.attribution}
                  </Body>
                </Animated.ScrollView>
              </GestureDetector>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
