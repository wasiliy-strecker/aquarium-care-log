import { Linking } from 'react-native';

export interface ExternalLinks {
  open(url: string): Promise<void>;
}

export class DeviceExternalLinks implements ExternalLinks {
  async open(url: string): Promise<void> {
    await Linking.openURL(url);
  }
}
