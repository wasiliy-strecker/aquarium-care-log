import { useCallback, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetHandle,
  useBottomSheetInternal,
  useGestureEventsHandlersDefault,
  ANIMATION_SOURCE,
  type GestureEventsHandlersHookType,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Body,
  Button,
  Card,
  IconButton,
  useTheme,
} from '../../core/ui/components';
import { Icon, type IconName } from '../../core/ui/icon';
import { overlayFrameStyle } from '../../core/ui/overlay-frame';
const hints: { title: string; icon: IconName; text: string }[] = [
  {
    title: 'Das ganze Aquarium',
    icon: 'water_drop',
    text: 'Ein ähnlicher Blickwinkel macht Veränderungen im Aquarium später gut sichtbar.',
  },
  {
    title: 'Spiegelungen vermeiden',
    icon: 'photo_camera_outlined',
    text: 'Achte auf Spiegelungen im Glas. Verändere bei Bedarf den Aufnahmewinkel.',
  },
  {
    title: 'Pflegeschritte festhalten',
    icon: 'edit_note_outlined',
    text: 'Ergänze Fotos vom Wasserwechsel, Filter oder Futter. Details passen in die Notiz.',
  },
  {
    title: 'Messwerte selbst eintragen',
    icon: 'straighten',
    text: 'Fotografiere bei Bedarf die Anzeige oder den Wassertest. Bezeichnung, Wert und Einheit trägst du selbst ein.',
  },
];
const snapPoints = ['25%', '70%', '95%'];
// Keep the library's scroll-to-drag handoff, but let go at any height as
// Flutter's DraggableScrollableSheet does with snap=false.
const useFreeSheetGestures: GestureEventsHandlersHookType = () => {
  const handlers = useGestureEventsHandlersDefault();
  const { animatedPosition, animatedDetentsState, animateToPosition } =
    useBottomSheetInternal();
  return {
    ...handlers,
    handleOnEnd: () => {
      'worklet';
      const { detents, highestDetentPosition, closedDetentPosition } =
        animatedDetentsState.get();
      if (
        !detents?.length ||
        highestDetentPosition === undefined ||
        closedDetentPosition === undefined
      )
        return;
      const position = animatedPosition.get();
      if (position >= detents[0]! - 1) {
        animateToPosition(closedDetentPosition, ANIMATION_SOURCE.GESTURE, 0);
      } else if (position < highestDetentPosition) {
        animateToPosition(highestDetentPosition, ANIMATION_SOURCE.GESTURE, 0);
      }
    },
  };
};
function HintsBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.4}
      pressBehavior="close"
      accessibilityLabel="Fotohinweise schließen"
      accessibilityHint="Schließt die Fotohinweise und kehrt zum Eintrag zurück."
    />
  );
}
function HintsHandle(props: BottomSheetHandleProps) {
  const c = useTheme();
  return (
    <BottomSheetHandle
      {...props}
      accessibilityLabel="Fotohinweise verschieben"
      accessibilityHint="Nach oben ziehen zum Vergrößern. Nach unten ziehen zum Schließen."
      style={{ paddingTop: 22, paddingBottom: 22 }}
      indicatorStyle={{
        width: 32,
        height: 4,
        borderRadius: 4,
        backgroundColor: c.muted,
      }}
    />
  );
}
export function PhotoHints({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<BottomSheet>(null);
  const c = useTheme();
  const safe = useSafeAreaInsets();
  const close = useCallback(() => sheet.current?.forceClose(), []);
  return (
    <>
      <Button
        textOnly
        icon="photo_library_outlined"
        title="Fotohinweise"
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          {open && (
            <BottomSheet
              ref={sheet}
              index={1}
              snapPoints={snapPoints}
              gestureEventsHandlersHook={useFreeSheetGestures}
              enableDynamicSizing={false}
              enablePanDownToClose
              enableOverDrag={false}
              topInset={safe.top}
              onClose={() => setOpen(false)}
              backdropComponent={HintsBackdrop}
              handleComponent={HintsHandle}
              backgroundStyle={{
                ...overlayFrameStyle(c.primary),
                backgroundColor: c.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
              }}
              accessible={false}
              accessibilityViewIsModal
            >
              {/* The integrated scroll view transfers the same gesture between
                  content scrolling and sheet dragging at the content edges. */}
              <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: safe.bottom + 24,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text
                    accessibilityRole="header"
                    style={{
                      flex: 1,
                      fontFamily: 'Roboto',
                      fontSize: 22,
                      lineHeight: 28,
                      color: c.ink,
                    }}
                  >
                    Aquarien fotografieren
                  </Text>
                  <IconButton
                    icon="close"
                    label="Fotohinweise schließen"
                    onPress={close}
                  />
                </View>
                {hints.map((h) => (
                  <Card key={h.title} style={{ margin: 4, gap: 0 }}>
                    <Icon name={h.icon} size={36} color={c.primary} />
                    <Body
                      style={{
                        marginTop: 12,
                        fontFamily: 'RobotoMedium',
                        fontSize: 16,
                        lineHeight: 24,
                        letterSpacing: 0.15,
                      }}
                    >
                      {h.title}
                    </Body>
                    <Body style={{ marginTop: 8 }}>{h.text}</Body>
                  </Card>
                ))}
              </BottomSheetScrollView>
            </BottomSheet>
          )}
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}
