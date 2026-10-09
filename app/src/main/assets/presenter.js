'use strict';

const $ = id => document.getElementById(id);
const native = window.AndroidDeck;
const film = $('film');
let mode = 'home';
let deck = null;
let index = 0;
let viewer = null;
let epoch = 0;
let mediaGeneration = 0;
let filmUrl = null;
let importing = false;
let statusTimer = null;

function log(event, details = {}) {
  console.log('FirePresenter ' + event + ' ' + JSON.stringify(details));
}

function notify(message) {
  clearTimeout(statusTimer);
  $('status').textContent = message;
  $('status').hidden = false;
  statusTimer = setTimeout(() => { $('status').hidden = true; }, 4000);
}

function pauseAll() {
  document.querySelectorAll('video,audio').forEach(media => media.pause());
}

function releaseFilm() {
  mediaGeneration++;
  film.pause();
  film.removeAttribute('src');
  film.load();
  if (filmUrl) URL.revokeObjectURL(filmUrl);
  filmUrl = null;
}

function disposePptx() {
  if (viewer) viewer.destroy();
  viewer = null;
  $('pptx').replaceChildren();
}

function hideControls() {
  if ($('toolbar').contains(document.activeElement)) document.activeElement.blur();
  $('toolbar').hidden = true;
}

function setMode(next) {
  pauseAll();
  mode = next;
  for (const id of ['home', 'bundled', 'pptx', 'receive']) $(id).hidden = id !== next;
  hideControls();
  $('status').hidden = true;
  if (next !== 'receive') native?.stopUpload();
}

function home() {
  epoch++;
  importing = false;
  pauseAll();
  disposePptx();
  releaseFilm();
  setMode('home');
  $('resume').disabled = !native?.hasImport();
  $('start').focus();
}

function total() {
  return mode === 'bundled' ? deck.slides.length : viewer?.slideCount || 0;
}

function updateCount() {
  $('count').textContent = `${index + 1} / ${total()}`;
}

function localAsset(path) {
  return typeof path === 'string' && /^bundled\/[a-zA-Z0-9_./-]+$/.test(path) && !path.includes('..');
}

function validRect(rect) {
  return rect && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k])) &&
    rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 &&
    rect.x + rect.width <= 1.000001 && rect.y + rect.height <= 1.000001;
}

function validateDeck(data) {
  if (!data || !Number.isFinite(data.width) || !Number.isFinite(data.height) ||
      data.width <= 0 || data.height <= 0 || !Array.isArray(data.slides) || !data.slides.length) {
    throw Error('The bundled deck needs dimensions and at least one slide.');
  }
  for (const slide of data.slides) {
    if (!localAsset(slide.image) || (slide.video && !localAsset(slide.video)) ||
        (slide.poster && !localAsset(slide.poster))) throw Error('Deck media must use local bundled/ paths.');
    if (slide.videoRect && !validRect(slide.videoRect)) throw Error('Invalid video rectangle.');
    if (slide.links !== undefined && !Array.isArray(slide.links)) throw Error('Slide links must be an array.');
    for (const link of slide.links || []) {
      if (!validRect(link) || !Number.isInteger(link.slide) || link.slide < 1 ||
          link.slide > data.slides.length || typeof link.label !== 'string' || !link.label.trim()) {
        throw Error('Slide links need a label, rectangle, and valid slide number.');
      }
    }
  }
  return data;
}

function fitBundled() {
  if (!deck) return;
  const ratio = Math.min(innerWidth / deck.width, innerHeight / deck.height);
  $('slide').style.width = `${deck.width * ratio}px`;
  $('slide').style.height = `${deck.height * ratio}px`;
}

function positionRect(element, rect) {
  for (const [style, key] of [['left', 'x'], ['top', 'y'], ['width', 'width'], ['height', 'height']]) {
    element.style[style] = `${rect[key] * 100}%`;
  }
}

async function startBundled() {
  const token = ++epoch;
  try {
    const response = await fetch('bundled/deck.json');
    if (!response.ok) throw Error('Could not read the demo deck.');
    const data = validateDeck(await response.json());
    if (token !== epoch) return;
    disposePptx();
    deck = data;
    index = 0;
    setMode('bundled');
    showBundled();
  } catch (error) {
    if (token === epoch) notify(error.message);
  }
}

async function showBundled() {
  pauseAll();
  releaseFilm();
  const slide = deck.slides[index];
  const generation = mediaGeneration;
  document.activeElement?.blur();
  $('poster').src = slide.image;
  $('poster').alt = slide.title || `Slide ${index + 1}`;
  $('links').replaceChildren();
  for (const link of slide.links || []) {
    const button = document.createElement('button');
    button.className = 'hotspot';
    button.setAttribute('aria-label', link.label);
    button.title = link.label;
    positionRect(button, link);
    button.onclick = event => { event.stopPropagation(); goTo(link.slide - 1); };
    $('links').append(button);
  }
  film.hidden = !slide.video;
  if (slide.video) {
    film.poster = slide.poster || slide.image;
    positionRect(film, slide.videoRect || { x: 0, y: 0, width: 1, height: 1 });
  }
  fitBundled();
  updateCount();
  log('slide', { mode, index, title: slide.title });
  if (slide.video) {
    try {
      const response = await fetch(slide.video);
      if (!response.ok) throw Error('Could not read the local video.');
      const blob = await response.blob();
      if (generation !== mediaGeneration || mode !== 'bundled') return;
      filmUrl = URL.createObjectURL(blob);
      film.src = filmUrl;
      film.load();
    } catch (error) {
      if (generation === mediaGeneration) notify(error.message);
    }
  }
}

// Shape and picture hyperlinks are clickable in the renderer; make them
// focusable as well, so Fire TV's remote can activate them without a mouse.
function decoratePptxLinks(root = $('pptx')) {
  root.querySelectorAll('[role="link"],a,[title]').forEach(element => {
    // Text boxes may have a hyperlink both on the box and its text run.
    // Keep the text run as one remote stop instead of duplicating the link.
    if (element.querySelector('[role="link"],a')) return;
    if (element.matches('[role="link"],a') || element.style.cursor === 'pointer') {
      element.tabIndex = 0;
      element.setAttribute('role', 'link');
      if (!element.getAttribute('aria-label')) {
        element.setAttribute('aria-label', element.title || element.parentElement?.closest('[title]')?.title || element.textContent || 'Slide link');
      }
    }
  });
}

function pptxZoom(presentation) {
  return Math.min($('pptx').clientWidth / presentation.width,
    $('pptx').clientHeight / presentation.height) * 100;
}

async function openImported() {
  if (importing) return;
  const token = ++epoch;
  importing = true;
  pauseAll();
  releaseFilm();
  disposePptx();
  setMode('pptx');
  notify('Opening your PowerPoint…');
  try {
    const { PptxViewer, parseZipLazyMedia, buildPresentation, RECOMMENDED_ZIP_LIMITS } =
      await import('./vendor/pptx-renderer-1.3.0.js');
    const response = await fetch('/import/current.pptx?v=' + Date.now());
    if (!response.ok) throw Error('No imported PowerPoint is available.');
    const files = await parseZipLazyMedia(await response.arrayBuffer(), RECOMMENDED_ZIP_LIMITS);
    // Some Office exports include a UTF-8 BOM in XML parts.
    for (const key of Object.keys(files)) {
      const value = files[key];
      if (typeof value === 'string') files[key] = value.replace(/^\uFEFF/, '');
      else if (value instanceof Map) value.forEach((text, path) => {
        if (typeof text === 'string') value.set(path, text.replace(/^\uFEFF/, ''));
      });
    }
    const presentation = buildPresentation(files, { lazySlides: true });
    if (!presentation.slides.length) throw Error('This PowerPoint has no slides.');
    if (token !== epoch) return;
    viewer = new PptxViewer($('pptx'), {
      fitMode: 'none', zoomPercent: pptxZoom(presentation), pdfjs: false,
      onRenderStart: pauseAll,
      onSlideChange: nextIndex => { pauseAll(); index = nextIndex; updateCount(); },
      onSlideRendered: (nextIndex, element) => {
        index = nextIndex;
        updateCount();
        // The renderer emits this before mounting the new element.
        decoratePptxLinks(element);
        log('slide', { mode: 'pptx', index });
      },
      onNodeError: (id, error) => log('nodeError', { id, message: String(error) })
    });
    viewer.load(presentation);
    await viewer.renderSlide(0);
    if (token !== epoch) return;
    index = 0;
    updateCount();
    $('status').hidden = true;
    log('pptxReady', { total: total() });
  } catch (error) {
    if (token === epoch) { home(); notify('Could not open the deck: ' + error.message); }
  } finally {
    if (token === epoch) importing = false;
  }
}

async function goTo(target) {
  if (importing || !['bundled', 'pptx'].includes(mode)) return;
  if (target < 0 || target >= total()) { notify(target < 0 ? 'First slide' : 'Last slide'); return; }
  pauseAll();
  index = target;
  $('status').hidden = true;
  hideControls();
  try {
    if (mode === 'bundled') await showBundled();
    else await viewer.goToSlide(index);
    updateCount();
  } catch (error) { notify('Could not display the slide: ' + error.message); }
}

function activeMedia() {
  return mode === 'bundled' ? (!film.hidden && film.hasAttribute('src') ? film : null) :
    (mode === 'pptx' ? $('pptx').querySelector('video,audio') : null);
}

async function playback(forcePlay = false) {
  const media = activeMedia();
  if (!media) { notify('No video on this slide. Right advances; Up / Down selects a slide link.'); return; }
  try {
    if (forcePlay || media.paused) {
      if (media.ended) media.currentTime = 0;
      await media.play();
    } else media.pause();
  } catch (error) { notify('Could not play this media. Use an embedded H.264/AAC MP4.'); log('mediaError', { message: String(error) }); }
}

function focusCycle(elements, delta) {
  if (!elements.length) return false;
  const current = elements.indexOf(document.activeElement);
  const next = current < 0 ? (delta > 0 ? 0 : elements.length - 1) : (current + delta + elements.length) % elements.length;
  elements[next].focus();
  return true;
}

function slideLinks() {
  return Array.from((mode === 'bundled' ? $('links') : $('pptx')).querySelectorAll('button.hotspot,[role="link"]'))
    .filter(element => element.getClientRects().length > 0);
}

function controls() {
  if (!$('toolbar').hidden) { hideControls(); return; }
  $('toolbar').hidden = false;
  $('next').focus();
}

function receive() {
  epoch++;
  importing = false;
  disposePptx();
  releaseFilm();
  setMode('receive');
  $('address').textContent = 'Starting the file receiver…';
  $('cancel').focus();
  if (native) native.startUpload();
  else $('address').textContent = 'File transfer is available in the Android app.';
}

function command(action) {
  if (action === 'pause') { pauseAll(); return; }
  if (action === 'back') {
    if (!$('toolbar').hidden) hideControls();
    else if (mode === 'home') native?.exit();
    else home();
    return;
  }
  if (mode === 'home') {
    if (['next', 'previous', 'up', 'down'].includes(action)) {
      focusCycle(Array.from(document.querySelectorAll('.choices button:not(:disabled)')), ['next', 'down'].includes(action) ? 1 : -1);
    } else if (action === 'select') document.activeElement?.click();
    return;
  }
  if (mode === 'receive') { if (['select', 'menu'].includes(action)) home(); return; }
  if (action === 'menu') { controls(); return; }
  if (action === 'playpause' || action === 'play') { playback(action === 'play'); return; }
  if (action === 'first') { goTo(0); return; }
  if (!$('toolbar').hidden) {
    if (['next', 'previous', 'up', 'down'].includes(action)) {
      focusCycle(Array.from($('toolbar').querySelectorAll('button')), ['next', 'down'].includes(action) ? 1 : -1);
    } else if (action === 'select') document.activeElement?.click();
    return;
  }
  if (action === 'next') goTo(index + 1);
  else if (action === 'previous') goTo(index - 1);
  else if (action === 'up' || action === 'down') {
    if (!focusCycle(slideLinks(), action === 'down' ? 1 : -1)) controls();
  } else if (action === 'select') {
    const focused = document.activeElement;
    if (slideLinks().includes(focused)) focused.click();
    else if (activeMedia()) playback();
    else goTo(index + 1);
  }
}

$('start').onclick = startBundled;
$('open').onclick = () => native ? native.pickPptx() : notify('File import is available in the Android app.');
$('resume').onclick = openImported;
$('send').onclick = receive;
$('cancel').onclick = home;
$('prev').onclick = () => goTo(index - 1);
$('next').onclick = () => goTo(index + 1);
$('play').onclick = () => playback();
$('homeButton').onclick = home;
film.onended = () => {
  if (mode === 'bundled' && deck.slides[index].advanceOnEnd && index + 1 < total()) goTo(index + 1);
  else notify('Video finished. Right advances; OK replays.');
};
film.onerror = () => { if (!film.hidden && film.hasAttribute('src')) notify('Could not play this local video.'); };

document.addEventListener('click', event => {
  if (mode === 'pptx' && event.target.closest('a[href]')) {
    event.preventDefault();
    event.stopPropagation();
    notify('External web links are unavailable. Use links to slides in this deck.');
  }
}, true);
document.addEventListener('click', event => {
  if (!['bundled', 'pptx'].includes(mode)) return;
  if (event.target.closest('button,a,[role="link"],#toolbar')) return;
  if (event.target.closest('video,audio')) { playback(); return; }
  goTo(index + 1);
});
document.addEventListener('keydown', event => {
  const action = { ArrowRight: 'next', ArrowLeft: 'previous', ArrowDown: 'down', ArrowUp: 'up',
    Enter: 'select', ' ': 'playpause', Escape: 'back', Home: 'first', m: 'menu',
    MediaPlayPause: 'playpause' }[event.key];
  if (action) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) command(action); }
}, true);
window.addEventListener('resize', () => {
  fitBundled();
  if (mode === 'pptx' && viewer) viewer.setZoom(pptxZoom(viewer.presentationData));
});

// External links cannot open web pages from an offline deck.
window.open = () => { notify('External web links are unavailable. Use links to slides in this deck.'); return null; };
window.presenter = {
  command, openImported,
  showError: message => notify(message),
  uploadAddress: address => { $('address').textContent = address; },
  uploadError: message => { $('address').textContent = message; },
  getState: () => {
    const media = activeMedia();
    return { mode, index, total: total(), importing,
      media: media ? { time: media.currentTime, paused: media.paused, ended: media.ended, error: media.error?.code || null } : null };
  }
};
home();
log('ready', { userAgent: navigator.userAgent });
