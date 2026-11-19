/* The ONLY file that touches Expo and React Native. Everything else asks this object for what it needs
   (a database, a secure store, files, random ids, the network), so the same code runs in tests with plain
   Node stand-ins (see test/helpers.js).

   NOTE: this file could not be run in the chat where it was written (Expo cannot be installed there).
   It is short on purpose. If a newer Expo SDK renamed something, this is the only file to adjust. */

import { Buffer } from 'buffer';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform } from 'react-native';
import { ANDROID_PACKAGE } from './config.js';

if (typeof global.Buffer === 'undefined') global.Buffer = Buffer;      // the UDP library needs it
const { Directory, File, Paths } = Platform.OS === 'web' ? {} : require('expo-file-system');

/* The UDP library is old. If it cannot load on this phone, the only loss is searching the network for the computer
   after its address changed; the app itself still starts, and scanning or typing the address again works. */
let dgram = null;
try { const lib = require('react-native-udp'); dgram = lib.default || lib; } catch (e) { dgram = null; }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const AWAKE_TAG = 'fleetpilot-sync';

const toUri = p => (String(p).startsWith('file://') ? String(p) : 'file://' + p);
const toPlain = p => String(p).replace(/^file:\/\//, '');

async function shareText(name, contents, mimeType, dialogTitle) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(contents);
  if (!(await Sharing.isAvailableAsync())) throw new Error('This phone cannot share files right now.');
  return Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

async function shareExcel(name, contents) {
  const bytes = contents instanceof Uint8Array ? contents : new Uint8Array(contents);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('This phone cannot share files right now.');
  return Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Save or share FleetPilot Excel backup'
  });
}

/* The app's own folder that a developer can reach by USB or `adb pull`:
   Android/data/<package>/files. If it cannot be used, the app's private document folder is used instead. */
async function developerFolder() {
  if (Platform.OS === 'web') throw new Error('Phone-local Backup is available on Android. Use Save archive in the web preview.');
  try {
    const dir = new Directory(toUri(`/storage/emulated/0/Android/data/${ANDROID_PACKAGE}/files`));
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return toPlain(dir.uri);
  } catch (e) {
    const dir = new Directory(Paths.document, 'developer');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return toPlain(dir.uri);
  }
}

export function createPlatform() {
  return {
    isWeb: Platform.OS === 'web',
    now: () => new Date(),
    fetchFn: (...args) => fetch(...args),

    /* the phone's database, and a second one at a given folder (to check a backup copy) */
    openDb: fileName => SQLite.openDatabaseAsync(fileName),
    openDbAt: (folder, fileName) => SQLite.openDatabaseAsync(fileName, undefined, toPlain(folder)),

    /* the key the computer gives at pairing */
    secure: {
      get: key => SecureStore.getItemAsync(key),
      set: (key, value) => SecureStore.setItemAsync(key, value),
      remove: key => SecureStore.deleteItemAsync(key)
    },

    fs: {
      backupFolder: developerFolder,
      shareCsv: (name, contents) => shareText(name, contents, 'text/csv', 'Share FleetPilot CSV'),
      shareJson: (name, contents) => shareText(name, contents, 'application/json', 'Save FleetPilot archive'),
      pickJson: async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
        if (result.canceled) return null;
        const asset = result.assets && result.assets[0];
        if (!asset || !asset.uri) throw new Error('The selected file could not be opened.');
        const text = asset.file ? await asset.file.text() : Platform.OS === 'web'
          ? await (await fetch(asset.uri)).text()
          : await new File(asset.uri).text();
        return { name: asset.name || 'FleetPilot archive', text };
      },
      pickExcel: async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          copyToCacheDirectory: true,
          multiple: false
        });
        if (result.canceled) return null;
        const asset = result.assets && result.assets[0];
        if (!asset || !asset.uri) throw new Error('The selected workbook could not be opened.');
        const bytes = asset.file && typeof asset.file.arrayBuffer === 'function'
          ? new Uint8Array(await asset.file.arrayBuffer())
          : Platform.OS === 'web'
            ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer())
            : await new File(asset.uri).bytes();
        return { name: asset.name || 'FleetPilot Excel backup.xlsx', bytes };
      },
      shareExcel,
      join: (dir, name) => `${dir.replace(/\/$/, '')}/${name}`,
      plainPath: toPlain,
      exists: async p => new File(toUri(p)).exists,
      read: async p => new File(toUri(p)).text(),
      write: async (p, text) => { const f = new File(toUri(p)); if (!f.exists) f.create(); f.write(text); },
      append: async (p, text) => { const f = new File(toUri(p)); const old = f.exists ? await f.text() : ''; if (!f.exists) f.create(); f.write(old + text); },
      remove: async p => { const f = new File(toUri(p)); if (f.exists) f.delete(); },
      move: async (from, to) => new File(toUri(from)).move(new File(toUri(to)))
    },

    randomId: length => Array.from(Crypto.getRandomBytes(length), b => ALPHABET[b % ALPHABET.length]).join(''),
    deviceName: () => Device.deviceName || Device.modelName || 'Android phone',

    /* stay awake while syncing */
    keepAwake: {
      on: () => activateKeepAwakeAsync(AWAKE_TAG),
      off: () => deactivateKeepAwake(AWAKE_TAG)
    },

    /* find the computer again with a UDP broadcast; resolves with the addresses that answered */
    udp: !dgram ? undefined : {
      broadcast: (message, port, waitMs) => new Promise(resolve => {
        const found = new Set();
        let socket;
        try { socket = dgram.createSocket({ type: 'udp4' }); } catch (e) { return resolve([]); }
        const finish = () => { try { socket.close(); } catch (e) { /* closed */ } resolve([...found]); };
        socket.on('message', data => {
          try { (JSON.parse(data.toString()).a || []).forEach(a => found.add(String(a))); } catch (e) { /* not ours */ }
        });
        socket.bind(0, err => {
          if (err) return finish();
          try {
            socket.setBroadcast(true);
            const out = Buffer.from(message);
            socket.send(out, 0, out.length, port, '255.255.255.255', () => {});
          } catch (e) { return finish(); }
          setTimeout(finish, waitMs);
        });
      })
    }
  };
}
