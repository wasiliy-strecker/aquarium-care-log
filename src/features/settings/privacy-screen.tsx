import { Stack } from 'expo-router';
import { Body, Card, Page } from '../../core/ui/components';
import { privacyParagraphs } from './privacy-content';

export function PrivacyScreen() {
  return (
    <Page>
      <Stack.Screen options={{ title: 'Datenschutz' }} />
      <Card>
        <Body strong>AquariumLog · Datenschutzerklärung</Body>
        {privacyParagraphs.map((paragraph) => (
          <Body key={paragraph}>{paragraph}</Body>
        ))}
      </Card>
    </Page>
  );
}
