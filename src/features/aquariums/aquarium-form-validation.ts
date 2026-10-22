import { parseDecimal, type AquariumForm } from '../../core/domain/models';
import type { FormErrors } from '../../core/ui/use-form-errors';
import { messages } from '../../core/texts';

export const aquariumFieldOrder = ['name', 'volume', 'dimensions', 'location'];
export function validateAquariumForm(form: AquariumForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Bitte einen Aquariennamen eingeben.';
  for (const key of ['name', 'dimensions', 'location'] as const)
    if (form[key].length > 500) errors[key] = messages.validation.shortText;
  try {
    const volume = parseDecimal(form.volume, 'Volumen');
    if (volume !== null && volume <= 0)
      errors.volume = 'Bitte ein Volumen größer als 0 eingeben.';
  } catch (error) {
    errors.volume =
      error instanceof Error
        ? error.message
        : 'Bitte ein gültiges Volumen eingeben.';
  }
  return errors;
}
