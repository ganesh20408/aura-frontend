import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Configure in-app & background presentation rules
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Initializes notification channels, permissions, and returns the device Expo Push Token.
 */
export async function initNotificationsAsync() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('aura_alerts', {
        name: 'AURA Academic Alerts',
        description: 'Real-time department, club, and academic notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted.');
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch (pushErr) {
      // Physical devices get standard tokens; simulators log gracefully
      console.log('Device push token note:', pushErr.message);
      return null;
    }
  } catch (err) {
    console.log('Notification initialization error:', err.message);
    return null;
  }
}

/**
 * Immediately displays a native notification in the device's notification bar (outside app).
 */
export async function displaySystemNotification({ title, body, data = {} }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title.startsWith('📢') ? title : `📢 ${title}`,
        body,
        data,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: 'aura_alerts',
      },
      trigger: null, // triggers immediately
    });
  } catch (err) {
    console.log('System notification error:', err.message);
  }
}

/**
 * Checks fetched notifications against previously seen alerts and triggers system notifications
 * in the phone notification bar for any new incoming alert.
 */
export async function syncIncomingNotifications(notifications = []) {
  if (!Array.isArray(notifications) || notifications.length === 0) return;
  try {
    const rawSeen = await AsyncStorage.getItem('@aura_seen_notification_ids');
    let seenIds = rawSeen ? JSON.parse(rawSeen) : null;

    // First run baseline: memorize existing notifications so user isn't spammed with old history
    if (!seenIds) {
      const initialIds = notifications.map((n) => String(n._id));
      await AsyncStorage.setItem('@aura_seen_notification_ids', JSON.stringify(initialIds));
      return;
    }

    const newAlerts = notifications.filter((n) => !seenIds.includes(String(n._id)));
    for (const n of newAlerts) {
      await displaySystemNotification({
        title: n.title,
        body: n.message,
        data: { notificationId: String(n._id) }
      });
      seenIds.push(String(n._id));
    }

    if (newAlerts.length > 0) {
      await AsyncStorage.setItem('@aura_seen_notification_ids', JSON.stringify(seenIds));
    }
  } catch (err) {
    console.log('Notification sync error:', err.message);
  }
}
