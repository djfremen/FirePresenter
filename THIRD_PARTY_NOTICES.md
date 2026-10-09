# Third-party notices

This app bundles the standalone browser distribution of
[@aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer), version 1.3.0,
licensed under Apache-2.0. It is used without modification. Its license is
included in `app/src/main/assets/vendor/pptx-renderer-LICENSE.txt`.

The standalone renderer contains JSZip (MIT), ECharts (Apache-2.0), and
mtx-decompressor 1.4.2 (MPL-2.0). Their license texts and the renderer's
full third-party notices are included with the vendored distribution.
The unmodified MPL-covered source is available at
https://github.com/ChristopherVR/mtx-decompressor/tree/v1.4.2.
The renderer also includes an ECMA-376 geometry subset with its notice.

The application shell and presenter code are MIT licensed. The original bundled demo graphics and video are also MIT licensed.
User-imported presentations retain their existing rights.

The Gradle wrapper is distributed under Apache-2.0. Its distribution license
and notice are preserved in `gradle/wrapper/LICENSE.txt` and `NOTICE.txt`.
Build and test dependencies downloaded by Gradle/npm retain their own licenses;
they are not bundled as application content.
