import { SuggestionField } from '../../core/ui/suggestion-field';

export function ActivityField(props: {
  value: string;
  suggestions: string[];
  onChange(value: string): void;
  disabled: boolean;
  autoFocus: boolean;
}) {
  return (
    <SuggestionField
      {...props}
      label="Aktivität *"
      placeholder="z. B. Wasserwechsel oder Filterreinigung"
      helper="Vorschlag auswählen oder eigene Aktivität eingeben."
      helperStyle={{ lineHeight: 16, letterSpacing: 0.4 }}
    />
  );
}
