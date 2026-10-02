/* Gesture builder callbacks run only on native touch events. The compiler lint
 * currently treats callbacks passed through this builder as render-time calls.
 * Refs below are read only in those events, layout callbacks and cleanup. */
/* eslint-disable react-hooks/purity, react-hooks/refs */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PixelRatio, View, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from './theme';
import { useScrollHost } from './scroll-host';
import { reorderItems } from './reorder';
export function Sortable<T extends { id: string }>({
  items,
  columns = 1,
  disabled = false,
  onReorder,
  render,
  preview,
}: {
  items: T[];
  columns?: number;
  disabled?: boolean;
  onReorder?: (items: T[]) => void;
  render: (item: T, index: number, canTap: () => boolean) => ReactNode;
  preview?: (item: T, index: number) => ReactNode;
}) {
  const c = useTheme(),
    host = useScrollHost(),
    ref = useRef<View>(null);
  const [width, setWidth] = useState(0),
    [drag, setDrag] = useState<{
      id: string;
      x: number;
      y: number;
      over: number;
    } | null>(null);
  const rects = useRef(new Map<string, LayoutRectangle>()),
    state = useRef<{
      index: number;
      x: number;
      y: number;
      offset: number;
      originX: number;
      originY: number;
      pointerX: number;
      pointerY: number;
      viewportY: number;
      over: number;
    } | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    suppress = useRef(0),
    generation = useRef(0);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      generation.current++;
      state.current = null;
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  function start(index: number, x: number, y: number) {
    suppress.current = Date.now() + 60000;
    const token = ++generation.current;
    ref.current?.measureInWindow((originX, originY) => {
      if (generation.current !== token) return;
      state.current = {
        index,
        x,
        y,
        offset: host?.offset.current ?? 0,
        originX,
        originY,
        pointerX: x,
        pointerY: y,
        viewportY: 0,
        over: index,
      };
      host?.ref.current?.getNativeScrollRef()?.measureInWindow((_, top) => {
        if (state.current) state.current.viewportY = top;
      });
      setDrag({ id: items[index]!.id, x: 0, y: 0, over: index });
      stop();
      timer.current = setInterval(() => {
        const s = state.current;
        if (!s || !host) return;
        const local = s.pointerY - s.viewportY,
          edge = 72;
        const delta =
          local < edge
            ? -12 * (1 - local / edge)
            : local > host.height.current - edge
              ? 12 * (1 - (host.height.current - local) / edge)
              : 0;
        if (!delta) return;
        const next = Math.max(
          0,
          Math.min(
            host.content.current - host.height.current,
            host.offset.current + delta,
          ),
        );
        host.offset.current = next;
        host.ref.current?.scrollTo({ y: next, animated: false });
        move(s.pointerX, s.pointerY);
      }, 33);
    });
  }
  function move(x: number, y: number) {
    const s = state.current;
    if (!s) return;
    s.pointerX = x;
    s.pointerY = y;
    const scroll = (host?.offset.current ?? 0) - s.offset;
    const localX = x - s.originX,
      localY = y - s.originY + scroll;
    let over = s.over;
    for (let i = 0; i < items.length; i++) {
      const r = rects.current.get(items[i]!.id);
      if (
        r &&
        localX >= r.x &&
        localX <= r.x + r.width &&
        localY >= r.y &&
        localY <= r.y + r.height
      ) {
        over = i;
        break;
      }
    }
    s.over = over;
    setDrag({ id: items[s.index]!.id, x: x - s.x, y: y - s.y + scroll, over });
  }
  function end() {
    generation.current++;
    const s = state.current;
    if (!s) return;
    stop();
    state.current = null;
    setDrag(null);
    suppress.current = Date.now() + 450;
    if (s && s.index !== s.over)
      onReorder?.(reorderItems(items, s.index, s.over));
  }
  return (
    <View
      ref={ref}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
    >
      {items.map((item, index) => {
        const gesture = Gesture.Pan()
          .enabled(!disabled && !!onReorder && items.length > 1)
          .activateAfterLongPress(350)
          .runOnJS(true)
          .onStart((e) => start(index, e.absoluteX, e.absoluteY))
          .onUpdate((e) => move(e.absoluteX, e.absoluteY))
          .onFinalize(end);
        const active = drag?.id === item.id;
        return (
          <GestureDetector key={item.id} gesture={gesture}>
            <View
              onLayout={(e) => rects.current.set(item.id, e.nativeEvent.layout)}
              style={{
                width:
                  columns === 1
                    ? '100%'
                    : width
                      ? Math.floor(
                          ((width - 12 * (columns - 1)) / columns) *
                            PixelRatio.get(),
                        ) / PixelRatio.get()
                      : '48%',
                zIndex: active ? 10 : 0,
                borderRadius: 14,
                borderWidth: onReorder ? 2 : 0,
                borderColor:
                  drag?.over === index && !active ? c.primary : 'transparent',
              }}
            >
              <View style={{ opacity: active ? 0.3 : 1 }}>
                {render(item, index, () => Date.now() > suppress.current)}
              </View>
              {active && (
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: [{ translateX: drag.x }, { translateY: drag.y }],
                    borderRadius: 14,
                    backgroundColor: c.card,
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOpacity: 0.24,
                    shadowRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {preview
                    ? preview(item, index)
                    : render(item, index, () => false)}
                </View>
              )}
            </View>
          </GestureDetector>
        );
      })}
    </View>
  );
}
