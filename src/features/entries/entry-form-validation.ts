import { parseDecimal, type EntryForm } from '../../core/domain/models';
import type { FormErrors } from '../../core/ui/use-form-errors';
import { messages } from '../../core/texts';

export const entryFieldOrder = [
  'activity',
  'measurementLabel',
  'value',
  'unit',
  'occurredAt',
  'note',
];
export function validateEntryForm(form: EntryForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.activity.trim()) errors.activity = 'Bitte eine Aktivität eingeben.';
  for (const key of ['activity', 'measurementLabel', 'unit'] as const)
    if (form[key].length > 500) errors[key] = messages.validation.shortText;
  try {
    if (parseDecimal(form.value) !== null && !form.measurementLabel.trim())
      errors.measurementLabel = 'Bitte die Messgröße benennen.';
  } catch (error) {
    errors.value =
      error instanceof Error
        ? error.message
        : 'Bitte einen gültigen Messwert eingeben.';
  }
  if (!form.occurredAt || !Number.isFinite(Date.parse(form.occurredAt)))
    errors.occurredAt = messages.validation.occurredAt;
  if (form.note.length > 20000) errors.note = messages.validation.note;
  return errors;
}
