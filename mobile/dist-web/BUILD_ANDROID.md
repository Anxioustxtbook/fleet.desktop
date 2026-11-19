# Building the FleetPilot phone app (Android)

## Once, on the computer you build on
1. Install **Node 22.13 or newer** (`node -v`).
2. Install **Android Studio** (it brings the Android SDK) and **JDK 17**. In Android Studio's SDK Manager install an Android SDK platform and the command-line tools. Set `ANDROID_HOME` to the SDK folder.
3. On the phone: Settings, About phone, tap *Build number* 7 times; then Developer options, turn on **USB debugging**. Connect by USB and accept the prompt. `adb devices` should list it.

## Run it on your phone (to test)
```
cd fleetpilot-mobile
npm install
npm test            # optional: add FP_DESKTOP=<desktop project folder> to include the desktop comparisons
npm run android     # builds the first time (several minutes) and installs on the phone
```
Expo may ask to create the `android` folder the first time; say yes.

## A file you can hand to the other phones (APK)
```
npx expo prebuild --platform android
cd android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
```
The APK is in `android/app/build/outputs/apk/release/`. Copy it to a phone and open it (allow "install unknown apps" once). A release build needs a signing key for the Play Store; for your own phones the debug-signed file Gradle makes is enough.

## First use
1. Desktop: open FleetPilot, **Connect phone**; it shows a QR code and a PIN. Phone and computer must be on the **same Wi-Fi**. Allow FleetPilot through the Windows firewall when asked.
2. Phone: open **File & Backup → Connect to desktop**, scan the code (or type the address and PIN), then approve on the computer.
3. Do the **first copy**, then use **Sync now** in **File & Backup** whenever you want both sides to match.

## If something fails
- *Cannot reach the computer*: same Wi-Fi? firewall prompt answered? the phone's guide in *Connect to desktop* lists the usual causes.
- Developer backup on the phone: `adb pull /sdcard/Android/data/com.fleetpilot.mobile/files` then open the `.db` in DB Browser for SQLite.
- Tell me the exact message shown; the phone words its errors in plain language.
