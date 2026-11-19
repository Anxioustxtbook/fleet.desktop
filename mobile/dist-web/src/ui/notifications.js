import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  late: true,
  booking: true,
  sound: true,
  vibrate: true,
  bookingTime: 'Evening before'
};

export const normalizeNotificationSettings = value => ({
  ...DEFAULT_NOTIFICATION_SETTINGS,
  ...(value && typeof value === 'object' ? value : {}),
  enabled: !!(value && value.enabled),
  late: !(value && value.late === false),
  booking: !(value && value.booking === false),
  sound: !(value && value.sound === false),
  vibrate: !(value && value.vibrate === false),
  bookingTime: value && value.bookingTime === 'Morning of' ? 'Morning of' : 'Evening before'
});

const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const atTime = (date, hour, minute = 0) => {
  if (!isDate(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
};
const vehicleName = (vehicles, id) => (vehicles.find(vehicle => String(vehicle.id) === String(id)) || {}).reg || 'Vehicle';
const clientName = (clients, id) => (clients.find(client => String(client.id) === String(id)) || {}).name || 'Client';
const channelId = settings => `fleetpilot-${settings.sound ? 'sound' : 'silent'}-${settings.vibrate ? 'vibrate' : 'quiet'}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  const result = current.granted ? current : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true }
  });
  return result.granted || result.status === 'provisional';
}

async function prepareChannel(settings) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId(settings), {
    name: 'FleetPilot reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: settings.vibrate ? [0, 250, 250, 250] : [],
    lightColor: '#F6B94A',
    sound: settings.sound ? 'default' : null
  });
}

export async function sendTestNotification(settings) {
  if (Platform.OS === 'web') throw new Error('Notifications can only be tested on an Android or iOS phone.');
  if (!(await requestNotificationPermission())) throw new Error('Allow FleetPilot notifications in your phone settings first.');
  await prepareChannel(settings);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'FleetPilot',
      body: 'Phone notifications are working.',
      sound: settings.sound ? 'default' : null,
      data: { fleetpilotManaged: true, kind: 'test' },
      ...(Platform.OS === 'android' ? { channelId: channelId(settings) } : {})
    },
    trigger: null
  });
}

export async function refreshScheduledNotifications(app, settings) {
  if (Platform.OS === 'web') return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing
    .filter(item => item.content.data && item.content.data.fleetpilotManaged)
    .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  if (!settings.enabled) return;
  if (!(await requestNotificationPermission())) return;
  await prepareChannel(settings);

  const [rentals, bookings, vehicles, clients] = await Promise.all([
    app.records.all('rentals'), app.records.all('bookings'), app.records.all('vehicles'), app.records.all('clients')
  ]);
  const now = new Date(), horizon = new Date(now.getTime() + 30 * 86400000), scheduled = [], newlyLate = [];
  const lateSent = await app.db.getMeta('notificationLateSent', {});

  if (settings.late) {
    rentals.filter(rental => rental.status === 'Active' && isDate(rental.return)).forEach(rental => {
      const due = atTime(rental.return, 18);
      if (!due) return;
      const reg = vehicleName(vehicles, rental.vehicleId), client = clientName(clients, rental.clientId);
      if (due > now && due <= horizon) {
        scheduled.push({ date: due, title: 'Car return due', body: `${reg} · ${client}`, kind: 'late', id: rental.id });
      } else if (due <= now && lateSent[String(rental.id)] !== rental.return) {
        scheduled.push({ date: new Date(now.getTime() + 1500), title: 'A car is late', body: `${reg} · ${client} was due back ${rental.return}.`, kind: 'late', id: rental.id });
        newlyLate.push([String(rental.id), rental.return]);
      }
    });
  }

  if (settings.booking) {
    bookings.filter(booking => !/cancel|declin/i.test(String(booking.status || '')) && isDate(booking.pickup)).forEach(booking => {
      const pickup = atTime(booking.pickup, settings.bookingTime === 'Morning of' ? 7 : 18, settings.bookingTime === 'Morning of' ? 30 : 0);
      if (!pickup) return;
      if (settings.bookingTime !== 'Morning of') pickup.setDate(pickup.getDate() - 1);
      if (pickup <= now || pickup > horizon) return;
      const reg = vehicleName(vehicles, booking.vehicleId), client = clientName(clients, booking.clientId);
      scheduled.push({
        date: pickup,
        title: settings.bookingTime === 'Morning of' ? 'Booking today' : 'Booking tomorrow',
        body: `${reg} · ${client}`,
        kind: 'booking',
        id: booking.id
      });
    });
  }

  await Promise.all(scheduled.slice(0, 100).map(item => Notifications.scheduleNotificationAsync({
    content: {
      title: item.title,
      body: item.body,
      sound: settings.sound ? 'default' : null,
      data: { fleetpilotManaged: true, kind: item.kind, id: item.id, screen: item.kind === 'booking' ? 'bookings' : 'rentals' },
      ...(Platform.OS === 'android' ? { channelId: channelId(settings) } : {})
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: item.date
    }
  })));
  if (newlyLate.length) {
    const updated = { ...lateSent };
    newlyLate.forEach(([id, date]) => { updated[id] = date; });
    await app.db.setMeta('notificationLateSent', updated);
  }
}
