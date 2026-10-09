# Local deck format

For a bundled deck, replace `app/src/main/assets/bundled/deck.json` and add your assets under that same folder, then rebuild the APK. The manifest supports an image on every slide, an optional local video, and clickable links to slides.

```json
{
  "title": "My presentation",
  "width": 1920,
  "height": 1080,
  "slides": [
    {
      "title": "Welcome",
      "image": "bundled/welcome.svg",
      "links": [
        { "label": "Play the clip", "slide": 2,
          "x": 0.1, "y": 0.6, "width": 0.5, "height": 0.15 }
      ]
    },
    {
      "title": "Clip",
      "image": "bundled/video-frame.png",
      "video": "bundled/clip.mp4",
      "poster": "bundled/clip-poster.png",
      "videoRect": { "x": 0.1, "y": 0.2, "width": 0.8, "height": 0.7 },
      "advanceOnEnd": true
    },
    {
      "title": "My experience",
      "image": "bundled/story-card.svg"
    }
  ]
}
```

## Coordinates and links

`width` and `height` set the deck's aspect ratio. Slides are scaled to fit the screen, with letterboxing when needed. Link and video rectangles use fractions of the slide: `x: 0.1` means 10% from the left. Rectangles must stay inside the slide and have positive dimensions.

`slide` uses **one-based numbering**: 1 is the first slide. Links may jump forward or backward. Each link needs a nonempty `label` for remote focus and accessibility. Up / Down cycles through links in manifest order; OK activates the focused link. Left / Right continues from the selected destination. With no link focused, OK plays the video or advances a static slide.

Links are transparent hotspots over your artwork. Draw the visible button or card in the slide image; FirePresenter adds the focus outline. A pointer can also click them. Avoid overlapping hotspots, or covering the video with a hotspot if you want pointer clicks to play/pause it.

## Media

- `image` is required. Supported paths end in local SVG, PNG, JPEG, or WebP files.
- `video` is optional. Use a local MP4 with H.264 video and AAC audio.
- `poster` is an optional still image shown before playing. If omitted, the slide image is used.
- `videoRect` is optional; when omitted the video covers the full slide.
- `advanceOnEnd: true` opens the **next sequential slide** when the clip ends. Otherwise the video slide stays up. The final slide always holds.

Videos do not autoplay on entry. OK or Play / Pause starts them. Leaving a slide stops its video and releases the media URL. Bake fades into the clip itself when needed.

All media paths must begin with `bundled/` and refer to local files; URLs and parent-directory traversal are rejected. SVG images should be self-contained and use fonts available on the TV. There is no runtime JSON/ZIP deck upload in v0.1.0; the Receive screen accepts PowerPoint `.pptx` files only.

The original generator in `scripts/create-demo.py` is a working example of graphics and hotspot coordinates. `scripts/create-pptx-demo.mjs` creates equivalent editable PowerPoint examples with embedded video and internal slide hyperlinks.
