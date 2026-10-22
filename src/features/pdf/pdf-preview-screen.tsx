import { messages } from '../../core/texts';
import { interpolate } from '../../core/domain/capture-data';
import { View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActionRow,
  Button,
  Busy,
  Notice,
  Page,
  SelectField,
  useTheme,
} from '../../core/ui/components';
import { usePdfPreview } from './use-pdf-preview';

const DocumentView = requireNativeView<ViewProps & { session: string }>(
  'AquariumNative',
);
export function PdfPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePdfPreview(id),
    c = useTheme();
  const pdf = vm.pdf;
  const partCount = pdf?.parts[0]?.partCount ?? 1;
  const multipart = partCount > 1;
  return (
    <Page
      ready={!vm.loading}
      scroll={false}
      bottom={
        pdf ? (
          <>
            <ActionRow>
              {[
                <Button
                  key="print"
                  secondary
                  icon="print_outlined"
                  title={messages.reportContent.print}
                  disabled={vm.busy}
                  onPress={() => void vm.print()}
                />,
                <Button
                  key="share"
                  icon="ios_share_outlined"
                  title={
                    multipart
                      ? messages.reportContent.sharePart
                      : messages.reportContent.share
                  }
                  disabled={vm.busy}
                  onPress={() => void vm.share()}
                />,
              ]}
            </ActionRow>
            {multipart && (
              <Button
                title={messages.reportContent.shareAll}
                icon="share_outlined"
                disabled={vm.busy || pdf.parts.length !== partCount}
                onPress={() => void vm.shareAll()}
              />
            )}
          </>
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: messages.reportContent.documentTitle,
        }}
      />
      {multipart && pdf && (
        <View style={{ padding: 12, gap: 8 }}>
          <SelectField
            label={messages.reportContent.choosePart}
            value={pdf.id}
            disabled={vm.busy || vm.loading}
            options={pdf.parts.map((part) => ({
              value: part.id,
              label: interpolate(messages.reportContent.part, {
                part: part.partIndex!,
                total: part.partCount!,
              }),
            }))}
            onChange={vm.selectPart}
          />
          {pdf.parts.length !== partCount && (
            <Notice text={messages.reportContent.missingPart} />
          )}
        </View>
      )}
      {!!vm.error && (
        <View style={{ padding: 12, gap: 8 }}>
          <Notice error text={vm.error} />
          {!pdf && (
            <Button
              secondary
              title={messages.reportContent.retry}
              onPress={vm.retry}
            />
          )}
        </View>
      )}
      {vm.loading ? (
        <Busy label={messages.reportContent.opening} />
      ) : (
        pdf && (
          <DocumentView
            session={pdf.preview.session}
            style={{ flex: 1, backgroundColor: c.background }}
          />
        )
      )}
    </Page>
  );
}
