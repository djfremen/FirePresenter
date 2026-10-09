// Original editable PowerPoint fixture and example, licensed under MIT.
import pptxgen from 'pptxgenjs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'examples'), { recursive: true });
const videoCover = 'data:image/png;base64,' + (await readFile(path.join(root, 'app/src/main/assets/bundled/video-poster.png'))).toString('base64');

for (const [layout, name] of [['LAYOUT_WIDE', 'FirePresenter-Demo'], ['FOUR_THREE', 'FirePresenter-4x3']]) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'FOUR_THREE', width: 10, height: 7.5 });
  pptx.layout = layout;
  pptx.author = 'FirePresenter contributors';
  pptx.subject = 'Original offline presentation demo';
  pptx.title = name;
  pptx.lang = 'en-US';
  const wide = layout === 'LAYOUT_WIDE';
  const base = title => {
    const slide = pptx.addSlide();
    slide.background = { color: '101827' };
    slide.addText(title, { x: 0.7, y: 0.6, w: wide ? 12 : 8.6, h: 0.8, fontFace: 'Arial', fontSize: 34, color: 'F6F4EE', bold: true });
    return slide;
  };
  let slide = base('FirePresenter · PowerPoint demo');
  slide.addText('Local graphics, embedded video, and clickable slide links.', { x: 0.7, y: 1.7, w: wide ? 12 : 8.6, h: 0.8, fontSize: 22, color: 'C4CDDD' });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 3, w: 6, h: 1, fill: { color: 'FF943D' }, line: { color: 'FF943D' }, hyperlink: { slide: 3, tooltip: 'Jump to graphics' } });
  slide.addText('Select the orange card to jump to slide 3.', { x: 0.7, y: 4.5, w: 8.5, h: 0.6, fontSize: 20, color: 'F6F4EE' });
  slide.addText('Or jump to the final slide.', { x: 0.7, y: 5.6, w: 8, h: 0.6, fontSize: 22, color: 'FF943D', hyperlink: { slide: 4, tooltip: 'Jump to finish' } });
  slide = base('Embedded local video');
  slide.addMedia({ type: 'video', path: path.join(root, 'app/src/main/assets/bundled/demo.mp4'),
    cover: videoCover, x: 0.7, y: 1.9, w: 8, h: 4.5 });
  slide = base('Graphics, with a way back');
  slide.addImage({ path: path.join(root, 'app/src/main/assets/bundled/video-poster.png'), x: 0.7, y: 1.9, w: 6.4, h: 3.6,
    hyperlink: { slide: 1, tooltip: 'Return to start' } });
  slide = base('Ready for an offline rehearsal');
  slide.addText('Up / Down selects a link. OK follows it.', { x: 0.7, y: 1.9, w: 8.5, h: 0.8, fontSize: 22, color: 'F6F4EE' });
  slide.addText('Return to start', { x: 0.7, y: 3.2, w: 7, h: 0.6, fontSize: 24, color: 'FF943D', hyperlink: { slide: 1, tooltip: 'Return to start' } });
  slide.addText('External links stay offline', { x: 0.7, y: 4.4, w: 7, h: 0.6, fontSize: 22, color: 'C4CDDD', hyperlink: { url: 'https://example.com/', tooltip: 'External link' } });
  await pptx.writeFile({ fileName: path.join(root, 'examples', name + '.pptx') });
}
