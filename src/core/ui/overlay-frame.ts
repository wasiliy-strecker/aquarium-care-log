import type { ViewStyle } from 'react-native';
export function overlayFrameStyle(primary: string): ViewStyle {
  return {
    borderWidth: 0.5,
    borderColor: primary + 'B3',
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 8,
        spreadDistance: 0,
        color: primary + '24',
      },
    ],
  };
}
