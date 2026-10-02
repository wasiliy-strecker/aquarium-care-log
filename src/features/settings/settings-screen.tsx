import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Body,
  Button,
  BusyOverlay,
  Card,
  Field,
  Heading,
  Notice,
  Page,
  useTheme,
} from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { DialogActions } from '../../core/ui/dialog-actions';
import { useSettings } from './use-settings';
function PasswordDialog({
  confirm,
  close,
}: {
  confirm: boolean;
  close: (value: string | null) => void;
}) {
  const c = useTheme();
  const [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState(''),
    [show, setShow] = useState(false),
    [error, setError] = useState('');
  function submit() {
    Keyboard.dismiss();
    if (
      !password ||
      (confirm && password.length < 6) ||
      password.length > 1024
    ) {
      setError(
        confirm
          ? 'Bitte ein Passwort mit 6 bis 1024 Zeichen eingeben.'
          : 'Bitte ein gültiges Passwort eingeben.',
      );
      return;
    }
    if (confirm && password !== repeat) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    close(password);
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(null)}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.card,
            borderRadius: 28,
            padding: 24,
            gap: 16,
            maxHeight: '85%',
            maxWidth: 560,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: 'Roboto',
              fontSize: 24,
              lineHeight: 32,
              color: c.ink,
            }}
          >
            {confirm ? 'Backup-Passwort festlegen' : 'Backup-Passwort eingeben'}
          </Text>
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingTop: 8 }}
          >
            <Body>
              {confirm
                ? 'Mindestens 6 Zeichen. Ohne dieses Passwort kann das Backup nicht wiederhergestellt werden.'
                : 'Gib das Passwort dieser AquariumLog-Sicherung ein.'}
            </Body>
            <Field
              label="Passwort"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError('');
              }}
              onSubmitEditing={confirm ? undefined : submit}
              returnKeyType={confirm ? undefined : 'done'}
              trailing={
                show ? 'visibility_off_outlined' : 'visibility_outlined'
              }
              onTrailingPress={() => setShow((v) => !v)}
            />
            {confirm && (
              <Field
                label="Passwort wiederholen"
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                value={repeat}
                onChangeText={(value) => {
                  setRepeat(value);
                  setError('');
                }}
                onSubmitEditing={submit}
                returnKeyType="done"
              />
            )}
          </ScrollView>
          <Notice error text={error} />
          <DialogActions
            actions={[
              { label: 'Abbrechen', onPress: () => close(null) },
              {
                label: 'Weiter',
                filled: true,
                onPress: submit,
              },
            ]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function SettingsScreen() {
  const c = useTheme();
  const [prompt, setPrompt] = useState<{ confirm: boolean; id: number }>();
  const resolve = useRef<((value: string | null) => void) | null>(null);
  useEffect(() => () => resolve.current?.(null), []);
  const vm = useSettings(
    (confirm) =>
      new Promise((done) => {
        resolve.current = done;
        setPrompt({ confirm, id: Date.now() });
      }),
  );
  function close(value: string | null) {
    setPrompt(undefined);
    resolve.current?.(value);
    resolve.current = null;
  }
  return (
    <>
      <Page>
        <Notice error text={vm.error} />
        <Heading>Datensicherung</Heading>
        <Card style={{ padding: 0, gap: 0 }}>
          <Pressable
            accessibilityRole="button"
            disabled={vm.busy}
            onPress={() => void vm.create()}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <Icon name="lock_outline" />
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontSize: 16 }}>
                Verschlüsseltes Backup erstellen
              </Body>
              <Body muted>Aquarien, Pflegeeinträge und Fotos</Body>
            </View>
            <Icon name="chevron_right" />
          </Pressable>
          <View style={{ height: 1, backgroundColor: c.border }} />
          <Pressable
            accessibilityRole="button"
            disabled={vm.busy}
            onPress={() => void vm.restore()}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <Icon name="settings_backup_restore_outlined" />
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontSize: 16 }}>Backup wiederherstellen</Body>
              <Body muted>Vorhandene neuere Einträge bleiben erhalten</Body>
            </View>
            <Icon name="chevron_right" />
          </Pressable>
        </Card>
        <View style={{ marginTop: 6 }}>
          <Heading>Datenschutz</Heading>
        </View>
        <Card style={{ padding: 18, gap: 0 }}>
          <Body>
            Fotos und Pflegeeinträge werden lokal auf deinem Gerät verarbeitet.
            Die App überträgt deine Aquariendaten nicht an einen Server.
          </Body>
          <Body style={{ marginTop: 10 }}>
            Deine Daten bleiben lokal auf deinem Gerät gespeichert, bis du sie
            in der App löschst oder die App-Daten entfernst.
          </Body>
          <Body muted style={{ marginTop: 10 }}>
            Entwickler und Datenschutzkontakt{'\n'}
            Wasiliy Strecker · AppFabrik AI
          </Body>
          <View style={{ marginTop: 14 }}>
            <Button
              secondary
              icon="lock_outline"
              title="Datenschutzerklärung öffnen"
              disabled={vm.busy}
              onPress={() => void vm.openPrivacy()}
            />
          </View>
        </Card>
        <View style={{ marginTop: 6 }}>
          <Heading>Über AquariumLog</Heading>
        </View>
        <Card style={{ padding: 0, gap: 0 }}>
          <View style={{ padding: 18, gap: 12 }}>
            <Body strong>AquariumLog 1.0.0</Body>
            <Body muted>Kostenlos. Ohne Konto. Ohne Werbung.</Body>
            <Body muted>
              Eigenständige lokale Android-App. Backups bis 128 MB.
              Formularentwürfe gehören nicht zum Backup.
            </Body>
          </View>
        </Card>
      </Page>
      <BusyOverlay visible={!!vm.phase} label={vm.phase} />
      {prompt && (
        <PasswordDialog
          key={prompt.id}
          confirm={prompt.confirm}
          close={close}
        />
      )}
    </>
  );
}
