import type { ImageSourcePropType } from 'react-native';
import { messages } from '../../core/texts';
export type PhotoExample = {
  id: string;
  label: string;
  source(): ImageSourcePropType;
};
// Read-only bundled examples never enter aquarium data, drafts or backups.
export const photoExamples: PhotoExample[] = [
  {
    id: 'aquarium',
    label: messages.photoExamples.labels.aquarium,
    source: () => require('../../../assets/photo-examples/01_aquarium.jpg'),
  },
  {
    id: 'care',
    label: messages.photoExamples.labels.care,
    source: () =>
      require('../../../assets/photo-examples/02_wasserwechsel.jpg'),
  },
  {
    id: 'details',
    label: messages.photoExamples.labels.details,
    source: () => require('../../../assets/photo-examples/03_details.jpg'),
  },
];
