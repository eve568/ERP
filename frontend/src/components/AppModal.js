import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '../theme';

/**
 * Modal animado multiplataforma (web + Android).
 * Controla internamente la animación de entrada y salida para que
 * el cierre nunca sea un corte seco.
 */
export default function AppModal({
  visible = false,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 520,
}) {
  const [rendered, setRendered] = useState(visible);
  const shownRef = useRef(visible);

  const backdrop = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const enter = () =>
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(contentY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
    ]);

  const exit = () =>
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(contentY, {
        toValue: 24,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: false,
      }),
    ]);

  useEffect(() => {
    if (visible) {
      shownRef.current = true;
      setRendered(true);
      backdrop.setValue(0);
      contentY.setValue(24);
      contentOpacity.setValue(0);

      const timer = setTimeout(() => {
        enter().start();
      }, 20);

      return () => clearTimeout(timer);
    }

    if (shownRef.current) {
      exit().start(({ finished }) => {
        if (finished) {
          shownRef.current = false;
          setRendered(false);
        }
      });
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function requestClose() {
    if (!shownRef.current) {
      return;
    }

    exit().start(({ finished }) => {
      if (finished) {
        shownRef.current = false;
        setRendered(false);
        onClose?.();
      }
    });
  }

  if (!rendered) {
    return null;
  }

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={styles.backdropPress}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar ventana"
        />

        <Animated.View
          style={[
            styles.card,
            { maxWidth, opacity: contentOpacity, transform: [{ translateY: contentY }] },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>

              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <Pressable
              onPress={requestClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },

  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },

  card: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.medium,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extraBold,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  close: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  closePressed: {
    opacity: 0.7,
  },

  closeText: {
    color: colors.textSecondary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: typography.weight.bold,
  },

  body: {
    maxHeight: 420,
  },

  bodyContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },

  footer: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
});
