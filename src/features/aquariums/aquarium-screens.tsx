import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reports } from '../pdf/reports';
import { entryDateTime } from '../../core/domain/capture-data';
import { AquariumCover } from './aquarium-cover';
import { ReminderScheduleStatus } from './reminder-status';
import { View, Text, FlatList, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Body,
  Button,
  Busy,
  Card,
  Field,
  Heading,
  Page,
  Title,
  Fab,
  IconButton,
  Notice,
  useTheme,
} from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { useFeedback } from '../../core/ui/feedback';
import { useAquariums, useAquariumDetail } from './use-aquariums';
import { HistoryTile } from './history-tile';
import {
  dateTime,
  aquariumSummary,
  entrySummary,
  reminderSummary,
  sortLabels,
  type AquariumSort,
  type DashboardItem,
} from './presentation-model';
import { PAGE_SIZE, type Aquarium } from '../../core/domain/models';
import type { ReminderStatus } from '../../core/native/aquarium-native';
export function ReminderInfo({
  aquarium,
  status,
}: {
  aquarium: Aquarium;
  status?: ReminderStatus;
}) {
  const c = useTheme();
  const r = aquarium.reminder;
  const s = status?.schedules.find((s) => s.aquariumId === aquarium.id);
  if (!r && s?.planningState !== 'cancelFailed') return null;
  return (
    <View style={{ gap: 6 }}>
      {r && (
        <Body strong style={{ fontSize: 12 }}>
          Erinnern: {reminderSummary(r)}
        </Body>
      )}
      <ReminderScheduleStatus
        reminder={r}
        status={status}
        aquariumId={aquarium.id}
        onEdit={() =>
          router.push({
            pathname: '/aquarium/edit',
            params: { id: aquarium.id },
          })
        }
      />
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: c.soft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon name="notifications_active_outlined" size={19} color={c.onSoft} />
        <Body strong style={{ fontSize: 12, color: c.onSoft, flex: 1 }}>
          Letzte Erinnerung:{' '}
          {s?.lastTriggeredAtMillis
            ? `${dateTime(s.lastTriggeredAtMillis)} Uhr`
            : 'noch keine'}
        </Body>
      </View>
    </View>
  );
}
function DashboardHeader({ vm }: { vm: ReturnType<typeof useAquariums> }) {
  const feedback = useFeedback();
  return (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      {!!vm.error && (
        <>
          <Notice error text={vm.error} />
          <Button title="Erneut laden" onPress={vm.retry} />
        </>
      )}
      <Title subtitle="Pflege, Fotos und Wasserwerte deiner Aquarien festhalten.">
        Deine Aquarien
      </Title>
      <View style={{ marginTop: 4 }}>
        <Field
          label="Aquarien suchen"
          leading="search"
          value={vm.search}
          onChangeText={vm.setSearch}
          trailing={vm.search ? 'close' : undefined}
          onTrailingPress={() => vm.setSearch('')}
          returnKeyType="search"
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Body muted>
          {vm.items.length}{' '}
          {vm.search
            ? 'Treffer'
            : vm.items.length === 1
              ? 'Aquarium'
              : 'Aquarien'}
        </Body>
        <Button
          secondary
          icon="sort"
          menu
          title={sortLabels[vm.sort]}
          onPress={(anchor) =>
            void feedback
              .choose({
                title: 'Aquarien sortieren',
                anchor,
                options: (Object.keys(sortLabels) as AquariumSort[]).map(
                  (value) => ({
                    value,
                    label: sortLabels[value],
                    icon: value === vm.sort ? 'check' : undefined,
                  }),
                ),
              })
              .then((value) => {
                if (value) vm.setSort(value as AquariumSort);
              })
          }
        />
      </View>
    </View>
  );
}
function DashboardCard({
  item,
  hasDraft,
  status,
}: {
  item: DashboardItem;
  hasDraft: boolean;
  status?: ReminderStatus;
}) {
  const c = useTheme();
  const { aquarium, latest, lastEdited, photo } = item;
  return (
    <Card
      style={{ padding: 0, gap: 0 }}
      onPress={() =>
        router.push({
          pathname: '/aquarium/[id]',
          params: { id: aquarium.id },
        })
      }
    >
      <AquariumCover photo={photo} title={aquarium.name} />
      <View
        style={{
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.primary + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={'water_drop'} color={c.primary} />
          {status?.schedules.find((s) => s.aquariumId === aquarium.id)
            ?.isNotificationActive && (
            <View
              style={{
                position: 'absolute',
                right: -2,
                top: -4,
                backgroundColor: c.danger,
                borderRadius: 10,
                paddingHorizontal: 5,
              }}
            >
              <Text style={{ color: c.background, fontSize: 11 }}>1</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Body strong style={{ fontSize: 16, lineHeight: 24 }}>
            {aquarium.name}
          </Body>
          <Body muted>{aquariumSummary(aquarium)}</Body>
          <Text
            style={{
              fontFamily: 'RobotoBlack',
              fontSize: 22,
              lineHeight: 28,
              color: c.ink,
              marginTop: 2,
            }}
          >
            {entrySummary(latest)}
          </Text>
          <Body muted style={{ fontSize: 12, lineHeight: 16 }}>
            Zuletzt bearbeitet: {dateTime(lastEdited)}
          </Body>
          {hasDraft && (
            <Body muted style={{ fontSize: 12 }}>
              Gesicherter Formularentwurf
            </Body>
          )}
          <ReminderInfo aquarium={aquarium} status={status} />
        </View>
        <Icon name="chevron_right" />
      </View>
    </Card>
  );
}
function AquariumSeparator() {
  return <View style={{ height: 12 }} />;
}
const dashboardKey = (item: DashboardItem) => item.aquarium.id;
export function AquariumsScreen() {
  const vm = useAquariums(),
    c = useTheme(),
    safe = useSafeAreaInsets(),
    { fontScale } = useWindowDimensions();
  const create = () => router.push('/aquarium/edit');
  return (
    <Page
      ready={!vm.loading}
      scroll={vm.loading || vm.empty}
      fab={<Fab title="Aquarium anlegen" onPress={create} />}
    >
      {vm.loading ? (
        <Busy label="Aquarien werden geladen …" />
      ) : vm.error && vm.empty ? (
        <>
          <Notice error text={vm.error} />
          <Button title="Erneut laden" onPress={vm.retry} />
        </>
      ) : vm.empty ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 20,
          }}
        >
          <Icon name="water_drop" size={72} color={c.primary} />
          <Title>Erstes Aquarium anlegen</Title>
          <Body style={{ textAlign: 'center' }}>
            Halte Wasserwechsel, Filterreinigung und Fütterung für jedes
            Aquarium fest. Ergänze Fotos, Messwerte und persönliche
            Pflegeerinnerungen. Deine Daten werden lokal auf deinem Gerät
            gespeichert.
          </Body>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: Math.max(112, 56 * fontScale + 48) + safe.bottom,
            width: '100%',
            maxWidth: 800,
            alignSelf: 'center',
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={vm.items}
          keyExtractor={dashboardKey}
          ListHeaderComponent={<DashboardHeader vm={vm} />}
          ListEmptyComponent={
            <Card>
              <Icon name="search" size={42} color={c.primary} />
              <Body>Keine passenden Aquarien gefunden.</Body>
            </Card>
          }
          ItemSeparatorComponent={AquariumSeparator}
          renderItem={({ item }) => (
            <DashboardCard
              item={item}
              hasDraft={vm.drafts.some(
                (d) => d.aquariumId === item.aquarium.id,
              )}
              status={vm.status}
            />
          )}
        />
      )}
    </Page>
  );
}
export function Pager({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange(n: number): void;
}) {
  return total > PAGE_SIZE ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <IconButton
        icon="chevron_left"
        label="Vorherige Seite"
        disabled={offset === 0}
        onPress={() => onChange(Math.max(0, offset - PAGE_SIZE))}
      />
      <Body>
        Seite {Math.floor(offset / PAGE_SIZE) + 1} von{' '}
        {Math.ceil(total / PAGE_SIZE)}
      </Body>
      <IconButton
        icon="chevron_right"
        label="Nächste Seite"
        disabled={offset + PAGE_SIZE >= total}
        onPress={() => onChange(offset + PAGE_SIZE)}
      />
    </View>
  ) : null;
}
export function AquariumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = useAquariumDetail(id),
    c = useTheme(),
    feedback = useFeedback();
  const r = vm.aquarium;
  const edit = () =>
    router.push({ pathname: '/aquarium/edit', params: { id } });
  const capture = () =>
    router.push({ pathname: '/entry/edit', params: { aquariumId: id } });
  if (!r)
    return (
      <Page ready={!vm.loading}>
        <Notice error text={vm.error} />
        {vm.loading ? <Busy /> : <Body>Aquarium nicht gefunden.</Body>}
      </Page>
    );
  return (
    <Page
      ready={!vm.loading}
      fab={
        <Fab
          title="Eintrag erfassen"
          icon="add_a_photo_outlined"
          onPress={capture}
        />
      }
    >
      <Stack.Screen options={{ title: r.name }} />
      <AquariumCover photo={vm.photo} title={r.name} expandable />
      <Card onPress={edit} style={{ margin: 4, padding: 17, gap: 0 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.primary + '1F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="water_drop" color={c.primary} />
          </View>
          <Body
            strong
            style={{
              flex: 1,
              fontSize: 16,
              lineHeight: 24,
              letterSpacing: 0.15,
            }}
          >
            {r.name}
          </Body>
          <Icon name="chevron_right" color={c.muted} />
        </View>
        <Body
          style={{
            marginTop: 14,
            fontFamily: 'RobotoBlack',
            fontSize: 28,
            lineHeight: 36,
            letterSpacing: 0,
          }}
        >
          {entrySummary(vm.entries[0] ?? null)}
        </Body>
        {!!vm.entries[0] && (
          <Body>Zuletzt am {entryDateTime(vm.entries[0])}</Body>
        )}
        <View style={{ marginTop: 10 }}>
          {r.volumeLiters !== null && (
            <Body>Volumen: {r.volumeLiters.toLocaleString('de-DE')} l</Body>
          )}
          {!!r.dimensions && <Body>Maße: {r.dimensions}</Body>}
          {!!r.location && <Body>Standort: {r.location}</Body>}
          <ReminderInfo aquarium={r} status={vm.status} />
        </View>
      </Card>
      <View style={{ gap: 12 }}>
        <Button
          secondary
          icon="edit_outlined"
          title="Aquarium & Erinnerung bearbeiten"
          onPress={edit}
        />
        <Button
          secondary
          danger
          icon="delete_outline"
          title="Aquarium löschen"
          disabled={vm.busy}
          onPress={() =>
            void feedback
              .confirm(
                'Aquarium löschen?',
                'Das Aquarium, seine Pflegeeinträge, Fotos und PDF-Protokolle werden gelöscht. Exportierte Backups bleiben erhalten.',
              )
              .then((ok) => {
                if (ok) void vm.remove();
              })
          }
        />
      </View>
      <Notice error text={vm.error} />
      <View style={{ marginTop: vm.total > 0 ? 6 : 18, gap: 8 }}>
        <Heading>Pflegeverlauf</Heading>
        {vm.total > 0 && (
          <Body style={{ fontFamily: 'RobotoMedium', letterSpacing: 0.1 }}>
            {vm.total === 1
              ? '1 Eintrag'
              : `${vm.entries.length} von ${vm.total} Einträgen`}
          </Body>
        )}
        {!vm.total && (
          <Card
            onPress={capture}
            style={{ margin: 4, padding: 23, gap: 0, alignItems: 'center' }}
          >
            <Icon name="add_a_photo_outlined" size={44} color={c.primary} />
            <Body style={{ marginTop: 10, textAlign: 'center' }}>
              Noch kein Pflegeeintrag. Halte Wasserwechsel, Filterreinigung oder
              Fütterung mit Fotos und Notizen fest.
            </Body>
            <View
              style={{
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Body
                strong
                style={{ color: c.primary, textAlign: 'center', flexShrink: 1 }}
              >
                Ersten Eintrag erfassen
              </Body>
              <Icon name="chevron_right" color={c.primary} />
            </View>
          </Card>
        )}
        <View style={{ gap: 10 }}>
          {vm.historyItems.map((item) => (
            <HistoryTile key={item.entry.id} item={item} />
          ))}
        </View>
      </View>
      {vm.total > PAGE_SIZE && (
        <Button
          secondary
          icon="manage_search_outlined"
          title="Alle Einträge anzeigen"
          onPress={() =>
            router.push({ pathname: '/aquarium/history', params: { id } })
          }
        />
      )}
      <Reports aquariumId={id} hasPhotos={!!vm.photo} />
    </Page>
  );
}
export function AquariumHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = useAquariumDetail(id, true),
    c = useTheme();
  return (
    <Page
      ready={!vm.loading}
      top={
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            gap: 12,
            backgroundColor: c.background,
          }}
        >
          <Body
            style={{
              fontFamily: 'RobotoMedium',
              fontSize: 16,
              lineHeight: 24,
              letterSpacing: 0.15,
            }}
          >
            {vm.aquarium?.name ?? ''}
          </Body>
          <Field
            label="Einträge suchen"
            leading="search"
            value={vm.search}
            onChangeText={vm.setSearch}
            trailing={vm.search ? 'close' : undefined}
            onTrailingPress={() => vm.setSearch('')}
          />
        </View>
      }
      bottom={
        <Pager offset={vm.offset} total={vm.total} onChange={vm.setOffset} />
      }
    >
      <Stack.Screen options={{ title: 'Pflegeverlauf' }} />
      <Notice error text={vm.error} />
      {vm.loading ? (
        <Busy />
      ) : (
        <View style={{ gap: 8 }}>
          <Body style={{ fontFamily: 'RobotoMedium', letterSpacing: 0.1 }}>
            {vm.total === 0
              ? 'Keine Einträge gefunden'
              : vm.total === 1
                ? vm.search.trim()
                  ? '1 Treffer'
                  : '1 Eintrag'
                : `${vm.offset + 1}–${Math.min(vm.offset + PAGE_SIZE, vm.total)} von ${vm.total} ${vm.search.trim() ? 'Treffern' : 'Einträgen'}`}
          </Body>
          <View style={{ gap: 10 }}>
            {vm.historyItems.map((item) => (
              <HistoryTile key={item.entry.id} item={item} />
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}
