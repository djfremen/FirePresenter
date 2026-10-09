# Contributing to FirePresenter

Start with an issue describing the presentation behavior you want to improve. Pull requests should explain the trigger, resulting behavior, and checks performed. Keep sample files small and include only content you have permission to distribute.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/src/main/java/org/firepresenter/app/MainActivity.java` | Native WebView host, remote keys, private file storage, and local Wi-Fi receiver |
| `app/src/main/assets/presenter.js` | Deck navigation, video lifecycle, remote link focus, and PowerPoint integration |
| `app/src/main/assets/index.html`, `presenter.css` | TV interface |
| `app/src/main/assets/bundled/` | Original local demo |
| `app/src/main/assets/vendor/` | Pinned renderer distribution and complete notices |
| `examples/` | Original editable PowerPoint examples |
| `tests/` | Browser tests with external requests blocked |
| `scripts/` | Demo generation |

## Checks

```sh
./gradlew assembleDebug lintDebug
npm ci
npx playwright install chromium
npm test
```

Presenter changes should include a meaningful regression test where practical. Native lifecycle, upload, remote key routing, and Fire OS launcher changes require device or emulator checks in addition to browser tests. State which device, OS, and WebView you used. Do not present inherited prototype coverage as a test of the current release.

With the debug APK installed on an explicitly selected test device, you can
run the native smoke test. It opens the app, exercises DPAD keys and video,
uploads the example PowerPoint, and replaces that device's last imported deck:

```sh
FIREPRESENTER_ADB_SERIAL=YOUR_TEST_DEVICE_SERIAL node tests/android-smoke.mjs
```

This test uses Node's WebSocket API and ADB port forwarding. It does not
disconnect the device's network. Offline launcher rehearsal still uses the
physical Fire TV remote and the Settings route in `docs/OFFLINE.md`.

Keep the renderer unmodified unless the change is needed and its upstream/version/license implications are documented. Do not commit private decks, log files containing personal data, `local.properties`, build outputs, signing keys, or `node_modules`. Release APKs belong in GitHub Releases.

Application code and original demo assets are MIT licensed. Third-party code retains its existing notices. By submitting a contribution, you agree to distribute it under the relevant project license.
