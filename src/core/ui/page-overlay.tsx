import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { StyleSheet, View } from 'react-native';

type PageOverlay = {
  ref: RefObject<View | null>;
  show(owner: symbol, content: ReactNode): void;
  hide(owner: symbol): void;
};
const Context = createContext<PageOverlay | null>(null);

/** Keep anchored lists outside ScrollView clipping and touch handling. */
export function PageOverlayHost({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [overlay, setOverlay] = useState<{
    owner: symbol;
    content: ReactNode;
  }>();
  const value = useMemo<PageOverlay>(
    () => ({
      ref,
      show: (owner, content) => setOverlay({ owner, content }),
      hide: (owner) =>
        setOverlay((current) =>
          current?.owner === owner ? undefined : current,
        ),
    }),
    [],
  );
  return (
    <Context.Provider value={value}>
      <View ref={ref} collapsable={false} style={{ flex: 1 }}>
        {children}
        {!!overlay && (
          <View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          >
            {overlay.content}
          </View>
        )}
      </View>
    </Context.Provider>
  );
}

export function usePageOverlay() {
  const overlay = useContext(Context);
  if (!overlay) throw new Error('PageOverlayHost fehlt.');
  return overlay;
}
