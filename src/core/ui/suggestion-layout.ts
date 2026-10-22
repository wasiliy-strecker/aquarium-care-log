export const suggestionGap = 12;

export type SuggestionLayout = {
  above: boolean;
  maxHeight: number;
};

/** Keep the list inside the visible form, clear of its header and keyboard. */
export function suggestionLayout(
  field: { top: number; height: number },
  viewport: { top: number; bottom: number },
  desiredHeight: number,
): SuggestionLayout {
  if (field.top >= viewport.bottom || field.top + field.height <= viewport.top)
    return { above: false, maxHeight: 0 };
  const above = Math.max(0, field.top - viewport.top - suggestionGap);
  const below = Math.max(
    0,
    viewport.bottom - field.top - field.height - suggestionGap,
  );
  const opensAbove = below < desiredHeight && above > below;
  return {
    above: opensAbove,
    maxHeight: Math.min(desiredHeight, opensAbove ? above : below),
  };
}
