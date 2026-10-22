import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ActionRow,
  Body,
  Button,
  Busy,
  BusyOverlay,
  Card,
  IconButton,
  Notice,
  useTheme,
} from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { PAGE_SIZE, type SavedReport } from '../../core/domain/models';
import { dateTime } from '../aquariums/presentation-model';
import { useReports } from './use-reports';
import { useScrollHost } from '../../core/ui/scroll-host';
import { interpolate } from '../../core/domain/capture-data';
import { messages } from '../../core/texts';

function ReportCard({
  report,
  available,
  busy,
  deleting,
  onOpen,
  onDelete,
}: {
  report: SavedReport;
  available: boolean;
  busy: boolean;
  deleting: boolean;
  onOpen(): void;
  onDelete(): void;
}) {
  const c = useTheme();
  const backgroundColor = available ? c.soft : c.errorContainer;
  const color = available ? c.onSoft : c.onErrorContainer;
  return (
    <Card
      onPress={available && !busy ? onOpen : undefined}
      style={[s.reportCard, { backgroundColor: c.secondaryContainer }]}
    >
      <View style={[s.pdfIcon, { backgroundColor }]}>
        <Icon
          name={available ? 'picture_as_pdf_outlined' : 'file_present_outlined'}
          color={color}
        />
      </View>
      <View style={s.reportBody}>
        <Body style={[s.reportTitle, { color: c.ink }]}>
          {report.entryId
            ? messages.reportContent.single
            : messages.reportContent.history}
          {report.partIndex
            ? ` · ${interpolate(messages.reportContent.part, { part: report.partIndex, total: report.partCount! })}`
            : ''}
        </Body>
        <Body style={{ color: c.ink, marginTop: 3 }}>
          {interpolate(messages.reportContent.created, {
            date: dateTime(report.createdAt),
          })}
        </Body>
        <Body strong style={{ color: c.ink, marginTop: 4 }}>
          {report.summary}
          {'\n'}
          {report.full
            ? messages.reportContent.withPhotoLabel
            : messages.reportContent.withoutPhotoLabel}
        </Body>
        <View style={[s.status, { backgroundColor }]}>
          <Icon
            name={available ? 'verified_outlined' : 'error_outline'}
            size={17}
            color={color}
          />
          <Text numberOfLines={1} style={[s.statusText, { color }]}>
            {available
              ? messages.reportContent.saved
              : messages.reportContent.missing}
          </Text>
        </View>
      </View>
      <View
        style={[
          s.deleteAction,
          { borderWidth: 1, borderColor: c.destructive, borderRadius: 999 },
        ]}
      >
        {deleting ? (
          <ActivityIndicator
            accessibilityLabel={messages.reportContent.deleting}
            color={c.primary}
          />
        ) : (
          <IconButton
            icon="delete_outline"
            label={
              report.entryId
                ? messages.reportContent.deleteSingle
                : messages.reportContent.deleteHistory
            }
            color={c.destructive}
            disabled={busy}
            onPress={onDelete}
          />
        )}
      </View>
    </Card>
  );
}

type ReportsProps = {
  aquariumId: string;
  entryId?: string | null;
  hasPhotos: boolean;
};

export function Reports(props: ReportsProps) {
  return (
    <ReportSection
      key={`${props.aquariumId}/${props.entryId ?? ''}`}
      {...props}
    />
  );
}

function ReportSection({
  aquariumId,
  entryId = null,
  hasPhotos,
}: ReportsProps) {
  const vm = useReports(aquariumId, entryId, hasPhotos);
  const c = useTheme();
  const host = useScrollHost();
  const heading = useRef<View>(null);
  const revealPage = useRef(false);
  const previousOffset = useRef(vm.offset);
  useEffect(() => {
    if (previousOffset.current !== vm.offset) {
      previousOffset.current = vm.offset;
      revealPage.current = true;
    }
    if (vm.loading || vm.loadError || !revealPage.current || !host) return;
    let active = true;
    const frame = requestAnimationFrame(() => {
      heading.current?.measureInWindow((_, top) => {
        host.ref.current
          ?.getNativeScrollRef()
          ?.measureInWindow((_, pageTop) => {
            if (active)
              host.ref.current?.scrollTo({
                y: Math.max(0, host.offset.current + top - pageTop - 20),
                animated: true,
              });
          });
      });
      revealPage.current = false;
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [vm.loading, vm.loadError, vm.offset, host]);
  const saved = (
    <View>
      {vm.loading || (!vm.availableFiles && !vm.loadError) ? (
        <Busy label={messages.reportContent.checking} />
      ) : vm.loadError ? (
        <View style={s.loadError}>
          <Notice error text={vm.loadError} />
          <Button
            textOnly
            title={messages.reportContent.retry}
            onPress={vm.retry}
          />
        </View>
      ) : (
        <>
          {vm.reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              available={vm.availableFiles?.has(report.file) === true}
              busy={vm.busy}
              deleting={vm.deletingId === report.id}
              onOpen={() => vm.open(report)}
              onDelete={() => void vm.remove(report)}
            />
          ))}
          {vm.total > PAGE_SIZE && (
            <View style={{ gap: 8 }}>
              <Body style={{ textAlign: 'center' }}>
                {interpolate(messages.reportContent.page, {
                  page: Math.floor(vm.offset / PAGE_SIZE) + 1,
                  total: Math.ceil(vm.total / PAGE_SIZE),
                })}
              </Body>
              <ActionRow>
                {[
                  <Button
                    key="previous"
                    secondary
                    title={messages.reportContent.previous}
                    icon="chevron_left"
                    disabled={vm.offset === 0 || vm.busy}
                    onPress={() => vm.setOffset(vm.offset - PAGE_SIZE)}
                  />,
                  <Button
                    key="next"
                    secondary
                    title={messages.reportContent.next}
                    icon="chevron_right"
                    disabled={vm.offset + PAGE_SIZE >= vm.total || vm.busy}
                    onPress={() => vm.setOffset(vm.offset + PAGE_SIZE)}
                  />,
                ]}
              </ActionRow>
            </View>
          )}
        </>
      )}
    </View>
  );
  return (
    <View style={entryId ? { marginTop: 8 } : undefined}>
      {!!entryId && (
        <View ref={heading} collapsable={false}>
          <Body strong style={s.heading}>
            {messages.reportContent.savedSingle}
          </Body>
        </View>
      )}
      <Card style={[s.createCard, { backgroundColor: c.secondaryContainer }]}>
        <View style={s.purposeRow}>
          <Icon name="picture_as_pdf_outlined" color={c.onSecondaryContainer} />
          <Body strong style={{ flex: 1, color: c.ink }}>
            {entryId
              ? messages.reportContent.singleTitle
              : messages.reportContent.historyTitle}
          </Body>
        </View>
        <Button
          icon="picture_as_pdf_outlined"
          title={messages.reportContent.title}
          disabled={vm.busy}
          onPress={() => void vm.create()}
        />
      </Card>
      {!!vm.error && <Notice error text={vm.error} />}
      {entryId ? (
        <View style={{ marginTop: vm.total ? 12 : 0 }}>{saved}</View>
      ) : vm.total > 0 || vm.loading || vm.loadError ? (
        <View ref={heading} collapsable={false}>
          <Card style={s.historySection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: vm.expanded }}
              onPress={() => vm.setExpanded(!vm.expanded)}
              style={({ pressed }) => [
                s.historyHeading,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Icon name="folder_copy_outlined" color={c.primary} />
              <View style={{ flex: 1 }}>
                <Body strong style={s.sectionTitle}>
                  {messages.reportContent.savedHistory}
                </Body>
                <Body>
                  {vm.loadError
                    ? messages.reportContent.loadFailed
                    : vm.loading
                      ? messages.reportContent.loading
                      : vm.total === 1
                        ? messages.reportContent.one
                        : interpolate(messages.reportContent.count, {
                            count: vm.total,
                          })}
                </Body>
              </View>
              <Icon
                name={vm.expanded ? 'expand_less' : 'expand_more'}
                color={c.muted}
              />
            </Pressable>
            {vm.expanded && <View style={s.historyChildren}>{saved}</View>}
          </Card>
        </View>
      ) : null}
      <BusyOverlay
        visible={vm.busy && !vm.deletingId}
        label={messages.reportContent.processing}
      />
    </View>
  );
}

const s = StyleSheet.create({
  heading: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    marginBottom: 8,
  },
  createCard: { margin: 4, padding: 15, gap: 14 },
  purposeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reportCard: {
    padding: 13,
    marginBottom: 10,
    gap: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pdfIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBody: { flex: 1, marginLeft: 10, marginRight: 4 },
  reportTitle: {
    fontFamily: 'RobotoBlack',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
    maxWidth: '100%',
  },
  statusText: {
    fontFamily: 'RobotoBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  deleteAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySection: { margin: 4, marginTop: 14, padding: 0, gap: 0 },
  historyHeading: {
    minHeight: 80,
    paddingHorizontal: 15,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionTitle: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  historyChildren: { paddingHorizontal: 7, paddingBottom: 7 },
  loadError: { padding: 16, gap: 8 },
});
