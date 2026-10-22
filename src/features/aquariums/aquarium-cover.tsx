import { messages } from '../../core/texts';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { AquariumPhoto } from '../../core/domain/models';
import { useServices } from '../../core/composition';
import { Body, useTheme } from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { PhotoViewer } from '../media/photo-viewer';

export function AquariumCover({
  photo,
  title,
  expandable = false,
}: {
  photo: AquariumPhoto | null;
  title: string;
  expandable?: boolean;
}) {
  const { aquariumService } = useServices();
  const c = useTheme();
  const [failedUri, setFailedUri] = useState<string>();
  const [viewing, setViewing] = useState(false);
  if (!photo) return null;
  const uri = aquariumService.vault.uri(photo.photo.file);
  const failed = failedUri === uri;
  const content = (
    <View
      style={{
        width: '100%',
        aspectRatio: expandable ? 4 / 3 : 16 / 9,
        backgroundColor: c.input,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {failed ? (
        <>
          <Icon name="broken_image_outlined" color={c.muted} size={32} />
          <Body muted>{messages.aquariumPhoto.unavailable}</Body>
        </>
      ) : (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="cover"
          resizeMethod="resize"
          accessible={false}
          style={StyleSheet.absoluteFill}
          onError={() => setFailedUri(uri)}
        />
      )}
      {expandable && !failed && (
        <View
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            padding: 8,
            borderRadius: 12,
            backgroundColor: '#000000B3',
          }}
        >
          <Icon name="zoom_in" color="#FFFFFF" />
        </View>
      )}
    </View>
  );
  return (
    <>
      {expandable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            failed
              ? messages.aquariumPhoto.unavailableLabel.replace(
                  '{title}',
                  title,
                )
              : messages.aquariumPhoto.enlargeLabel.replace('{title}', title)
          }
          disabled={failed}
          onPress={() => setViewing(true)}
          style={({ pressed }) => ({
            margin: 4,
            borderRadius: 18,
            overflow: 'hidden',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
      {viewing && (
        <PhotoViewer
          images={[{ id: photo.photo.id, uri }]}
          initialIndex={0}
          close={() => setViewing(false)}
        />
      )}
    </>
  );
}
