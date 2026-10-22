import { useEffect, type RefObject } from 'react';
import { View } from 'react-native';
import { useScrollHost } from './scroll-host';
import type { FormErrorTarget } from './use-form-errors';

export function FormErrorScroll({
  target,
  anchors,
}: {
  target: FormErrorTarget | null;
  anchors: RefObject<Record<string, View | null>>;
}) {
  const host = useScrollHost();
  useEffect(() => {
    if (!target || !host) return;
    const frame = requestAnimationFrame(() => {
      const anchor = anchors.current[target.field];
      anchor?.measureInWindow((_x, fieldY) => {
        host.ref.current
          ?.getNativeScrollRef()
          ?.measureInWindow((_scrollX, scrollY) => {
            host.ref.current?.scrollTo({
              y: Math.max(0, host.offset.current + fieldY - scrollY - 12),
              animated: true,
            });
          });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [target, anchors, host]);
  return null;
}
