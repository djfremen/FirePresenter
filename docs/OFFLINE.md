# Offline operation

## Launch from Settings / Apps

**Settings → Applications → Manage Installed Applications → FirePresenter → Launch application**

Use this route when internet is unavailable. Amazon Home may show “Home is Currently Unavailable” instead of the installed apps. FirePresenter cannot replace Amazon's launcher or intercept the Fire TV remote's Home button. If Home takes you out of the presentation, reopen FirePresenter from Settings.

On supported Fire TV devices, holding Home opens Quick Settings; choose Settings there. Menu locations can vary. Amazon documents the app-launch route in [Install and Run Your App](https://developer.amazon.com/docs/fire-tv/installing-and-running-your-app.html).

## What remains on the device

The bundled deck, graphics, MP4, and rendering library are inside the APK. The last imported PowerPoint is stored in the app's private local files. Turning off Wi-Fi or disconnecting the internet does not remove these files. Clearing FirePresenter's app data or uninstalling it removes the imported deck.

No CDN scripts, cloud sign-in, streaming, or remote fonts are required. The native WebView serves `https://deck.local` from local app assets; this is an internal address, not a website on the internet. External network resources and web navigation are blocked.

**Receive a deck** requires a shared local network for transferring a file. It works without internet, but cannot work with the Fire TV's Wi-Fi turned off. Once transferred, playback can run with networking disabled. Restarting the app returns to its deck menu; choose **Last imported deck** to start that deck at slide one.

## Rehearsal

1. Install the APK and import your finished deck before traveling.
2. Restart the Fire TV with its network disconnected.
3. Use the remote to launch via Settings, then open the deck.
4. Check every graphic, slide link, video, sound level, pause/resume, and return card.
5. Leave a holding slide up for at least the longest break in the meeting.
6. Press Home once and practice returning through Settings.

FirePresenter uses Android's keep-screen-on flag while foregrounded. The TV itself can still have a separate sleep timer, eco setting, or automatic power-off option; check those on the venue's TV. The app does not alter device-wide power settings. A system interruption can pause media; resume using OK or Play / Pause.

The predecessor prototype was launched through Settings with networking off on a Fire TV Stick 4K. FirePresenter's renamed package and new link controls still require that same physical-device rehearsal; browser tests alone do not establish launcher behavior on every Fire OS version.
