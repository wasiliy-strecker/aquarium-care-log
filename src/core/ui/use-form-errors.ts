import { useRef, useState } from 'react';

export type FormErrors = Record<string, string>;
export type FormErrorTarget = { field: string; attempt: number };

export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [errorTarget, setErrorTarget] = useState<FormErrorTarget | null>(null);
  const attempt = useRef(0);

  function show(errors: FormErrors, order: string[]) {
    setFieldErrors(errors);
    const field = order.find((key) => !!errors[key]);
    if (field) setErrorTarget({ field, attempt: ++attempt.current });
  }

  function clear(field?: string) {
    if (!field) {
      setFieldErrors({});
      return;
    }
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return { fieldErrors, errorTarget, show, clear };
}
