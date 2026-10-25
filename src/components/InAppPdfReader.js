import React from 'react';
import { Modal, View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuraTheme } from '../theme/ThemeContext';

export default function InAppPdfReader({ visible, pdfUrl, title, onClose }) {
  const { theme } = useAuraTheme();
  if (!visible || !pdfUrl) return null;

  const viewerUrl =
    Platform.OS === 'android'
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}`
      : pdfUrl;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.badge, { color: theme.accent }]}>
              ZERO-DOWNLOAD IN-APP PDF READER
            </Text>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {title || 'Academic Resource'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close PDF Reader"
            style={[styles.closeBtn, { backgroundColor: theme.danger }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {Platform.OS === 'web' ? (
            <iframe
              src={pdfUrl}
              title={title}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <WebView
              source={{ uri: viewerUrl }}
              style={{ flex: 1, backgroundColor: theme.bg }}
              startInLoadingState={true}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  badge: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  closeBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 }
});