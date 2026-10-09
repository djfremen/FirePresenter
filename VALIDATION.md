# Validation

## FirePresenter 0.1.0 — October 8, 2026

The current project was tested separately from the earlier meeting prototype.

| Check | Result |
| --- | --- |
| Android debug build | Passed with JDK 21, Gradle 8.13, AGP 8.13.1, SDK 35 |
| Android lint | Passed: 0 errors, 7 warnings |
| APK signature verification | Passed, Android APK Signature Scheme v2 |
| Browser presenter tests | All 3 groups passed in desktop Chrome and Playwright Chromium 151.0.7922.34; all external network requests blocked |
| Native Android smoke test | Passed on an Android 12 / API 31 arm64 emulator with WebView 91.0.4472.114 |
| Physical Fire TV test of this renamed package | Pending |

Browser checks cover remote and pointer navigation, first/last boundaries,
hotspot links, focusable controls, local video play/pause, cleanup when leaving
media, automatic return to a holding card, PPTX shape/picture/text slide links,
slide counter synchronization, embedded graphics and MP4, blocked external
links, resizing, and 4:3 slide bounds/aspect ratio. No external request was
needed in these cases. Screenshots were rendered and visually inspected.

The native smoke test exercises actual Android DPAD key events, bundled links,
local video playback, pause, cleanup, Menu/Back, the HTTP receiver page,
invalid-file rejection, accepted and saved PPTX import, rendering, and embedded
MP4 playback, plus native remote activation of picture, shape, and text slide
links. Its test device is selected explicitly using
`FIREPRESENTER_ADB_SERIAL`; it never chooses a connected device automatically.

Lint warnings concern the pinned SDK/Gradle versions, a large vector banner,
fixed landscape orientation on newer Android, the required JavaScript-enabled
WebView, and Android 12 backup configuration. None was reported as an error.
The app is an early sideloading preview, not an Appstore-certified release.

## Required Fire TV rehearsal

The prototype predecessor was previously used on a Fire TV Stick 4K running
Fire OS with Android 11 APIs and WebView 150. The presenter confirmed launching
it from Settings with the network off. That evidence explains the documented
offline launch route; it does not establish that this new package has passed
physical Fire TV testing.

Before a live event, use the release APK on your Fire TV: restart with networking
disconnected, launch through **Settings → Applications → Manage Installed
Applications → FirePresenter → Launch application**, test remote link focus,
play every clip with audible sound, and leave a holding card up for the longest
planned break. Browser tests and Android emulator tests do not emulate
Amazon's Home screen, the Fire TV remote's system Home button, or the TV's
own power settings.

## Limits

- PPTX rendering is approximate; fonts and unsupported Office effects can differ.
- Only `.pptx` files up to 64 MB can be imported. The most recent deck replaces
  the previously imported deck.
- Only the first media element on an imported slide is controlled by the remote.
- Imported video slides advance manually; bundled decks can opt into advancing
  after a video.
- Linked online media and web links are unavailable. Google Slides must first
  be exported as PowerPoint.
- Bundled JSON decks are build-time assets. Runtime JSON/ZIP imports, a deck
  library, an authoring UI, and native PowerPoint animations are not implemented.
- FirePresenter keeps its foreground display awake, but cannot disable the TV's
  own sleep timer or replace Fire OS's offline launcher.

See `README.md` and `CONTRIBUTING.md` for repeatable build/test commands.
