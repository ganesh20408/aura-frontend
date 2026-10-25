import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  StyleSheet,
  Pressable
} from 'react-native';
import { ORDERED_TABS } from '../constants/auraData';
import { useAuraTheme } from '../theme/ThemeContext';

export default function AdaptiveNavigation({
  isLargeScreen,
  sidebarExpanded,
  setSidebarExpanded,
  offCanvasVisible,
  setOffCanvasVisible,
  activeTabKey,
  onSelectTab,
  user
}) {
  const { theme, isDark, toggleTheme } = useAuraTheme();
  const slideAnim = useRef(new Animated.Value(-320)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (offCanvasVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -320,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [offCanvasVisible]);

  const renderTabItems = (isExpandedView, closeAfterPress = false) =>
    ORDERED_TABS.map((tab) => {
      const isActive = activeTabKey === tab.key;
      const isLogout = tab.key === 'logout';
      return (
        <TouchableOpacity
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
          accessibilityLabel={`${tab.label}. ${tab.desc}`}
          style={[
            styles.navButton,
            {
              backgroundColor: isActive
                ? theme.primary
                : isLogout
                ? 'rgba(239, 68, 68, 0.12)'
                : 'transparent',
              justifyContent: isExpandedView ? 'flex-start' : 'center'
            }
          ]}
          onPress={() => {
            if (closeAfterPress) setOffCanvasVisible(false);
            onSelectTab(tab);
          }}
        >
          <Text style={[styles.navIcon, { marginRight: isExpandedView ? 12 : 0 }]}>
            {tab.icon}
          </Text>
          {isExpandedView && (
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.navTitle,
                  { color: isActive ? '#ffffff' : isLogout ? theme.danger : theme.text }
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: isActive ? '#dbeafe' : theme.textMuted,
                  marginTop: 1
                }}
                numberOfLines={1}
              >
                {tab.desc}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    });

  return (
    <>
      {/* DYNAMICALLY SIZED STICKY SIDEBAR (Visible on Wide/Tablet/Desktop Screens) */}
      {isLargeScreen && (
        <View
          style={[
            styles.stickySidebar,
            {
              width: sidebarExpanded ? 268 : 78,
              backgroundColor: theme.surface,
              borderRightColor: theme.border
            }
          ]}
        >
          <View style={styles.sidebarHeader}>
            {sidebarExpanded && (
              <View style={{ flex: 1 }}>
                <Text style={[styles.brandLogo, { color: theme.primary }]}>AURA</Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '600' }}>
                  {user.role} • {user.department} {user.year ? `(Yr ${user.year})` : ''}
                </Text>
              </View>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={sidebarExpanded ? 'Collapse sticky sidebar' : 'Expand sticky sidebar'}
              style={[styles.iconButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setSidebarExpanded(!sidebarExpanded)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 14 }}>
                {sidebarExpanded ? '◀' : '▶'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Off-Canvas Quick Launcher + Theme Toggle */}
          <View style={styles.sidebarActionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open Off-Canvas Navigation Overlay"
              style={[
                styles.utilityBtn,
                { backgroundColor: theme.primarySoft, borderColor: theme.primary, flex: 1 }
              ]}
              onPress={() => setOffCanvasVisible(true)}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>
                {sidebarExpanded ? '🧭 Off-Canvas Hub' : '🧭'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: isDark }}
              accessibilityLabel="Toggle Dark or Light Mode"
              style={[styles.iconButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginLeft: 6 }]}
              onPress={toggleTheme}
            >
              <Text style={{ fontSize: 15 }}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {renderTabItems(sidebarExpanded, false)}
          </ScrollView>
        </View>
      )}

      {/* OFF-CANVAS OVERLAY / MODAL DRAWER FOR TABBED NAVIGATION TRANSITIONS */}
      <Modal
        visible={offCanvasVisible}
        transparent
        animationType="none"
        onRequestClose={() => setOffCanvasVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
            <Pressable
              style={{ flex: 1 }}
              accessibilityLabel="Close navigation drawer"
              onPress={() => setOffCanvasVisible(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.offCanvasDrawer,
              {
                backgroundColor: theme.surface,
                borderRightColor: theme.border,
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            <View style={[styles.drawerHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.brandLogo, { color: theme.primary }]}>AURA NEXUS</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {user.name} • {user.department} {user.year ? `Year ${user.year}` : user.role}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close Off-Canvas Menu"
                style={[styles.iconButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                onPress={() => setOffCanvasVisible(false)}
              >
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityState={{ checked: isDark }}
                style={[
                  styles.utilityBtn,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginBottom: 8 }
                ]}
                onPress={toggleTheme}
              >
                <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 12 }}>
                  {isDark ? '☀️ Switch to Clean Light Mode' : '🌙 Switch to Deep Slate Dark Mode'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {renderTabItems(true, true)}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  stickySidebar: {
    borderRightWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  sidebarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  brandLogo: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  utilityBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 5
  },
  navIcon: {
    fontSize: 18
  },
  navTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.68)'
  },
  offCanvasDrawer: {
    width: 300,
    maxWidth: '86%',
    height: '100%',
    borderRightWidth: 1,
    elevation: 20
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1
  }
});