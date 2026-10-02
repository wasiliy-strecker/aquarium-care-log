import { createContext, useContext, type RefObject } from 'react';
import type { ScrollView } from 'react-native';
export type ScrollHost = {
  ref: RefObject<ScrollView | null>;
  offset: { current: number };
  height: { current: number };
  content: { current: number };
};
export const ScrollContext = createContext<ScrollHost | null>(null);
export const useScrollHost = () => useContext(ScrollContext);
