#!/usr/bin/env python3
"""Generate FirePresenter's original SVG slides and local deck manifest (MIT)."""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets/bundled'
ASSETS.mkdir(parents=True, exist_ok=True)


def text(value, x, y, size=42, color='#c4cddd', weight='normal'):
    return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}">{escape(value)}</text>'


def card(filename, title, subtitle, body):
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'
    svg += '<rect width="1920" height="1080" fill="#101827"/><g font-family="Arial,sans-serif">'
    svg += '<path fill="#ff943d" d="M140 95L178 118L140 141Z"/>'
    svg += text('FIREPRESENTER', 200, 133, 30, '#f6f4ee', 'bold')
    svg += text(title, 140, 280, 88, '#f6f4ee', 'bold')
    svg += text(subtitle, 140, 356, 36)
    svg += body
    svg += '<path d="M140 940H1780" stroke="#405370" stroke-width="2"/>'
    svg += text('YOUR DECK. YOUR PACE.', 140, 999, 25, '#ff943d')
    svg += text('LEFT / RIGHT: SLIDES    UP / DOWN: LINKS    OK: SELECT    MENU: CONTROLS', 645, 999, 24)
    svg += '</g></svg>'
    (ASSETS / filename).write_text(svg)


def button(label, y):
    return f'<rect x="140" y="{y}" width="860" height="115" rx="14" fill="#1e2d43" stroke="#405370" stroke-width="3"/>' + text(label, 185, y + 74, 42, '#f6f4ee')


card('01-welcome.svg', 'Your presentation, ready.', 'A small demo of graphics, slide links, and video — all on your device.',
     '<rect x="140" y="475" width="1640" height="330" rx="24" fill="#1e2d43"/>' +
     text('No streaming. No account. No internet at the venue.', 210, 590, 50, '#f6f4ee') +
     text('Press Right or OK to begin.', 210, 680, 42, '#ff943d'))
card('02-menu.svg', 'Choose your next stop.', 'Click a card, or use Up / Down and OK on the remote.',
     button('1. Graphics that fill the screen', 440) + button('2. A video that stays in your deck', 590) + button('3. Finish the presentation', 740) +
     text('Slide links let the conversation', 1120, 565, 40) + text('choose the route.', 1120, 625, 40))
card('03-graphics.svg', 'Make room for the idea.', 'Local graphics keep their layout and stay available offline.',
     '<rect x="1120" y="440" width="510" height="370" rx="20" fill="#1e2d43"/>' +
     '<circle cx="1300" cy="600" r="100" fill="#ff943d"/><path d="M1320 755L1520 470L1700 755Z" fill="#f6f4ee"/>' +
     text('Photos · illustrations · diagrams', 140, 550, 46, '#f6f4ee') + text('Bring the visuals with you.', 140, 625, 40) + button('Return to the menu ↗', 740))
card('04-video.svg', 'A clip, inside the story.', 'Press OK or Play / Pause. This original demo clip includes a quiet tone.',
     '<rect x="320" y="420" width="1280" height="480" rx="12" fill="#000"/>')
card('05-hold.svg', 'Let the moment land.', 'The video returns here automatically. This card waits for you.',
     text('Use a holding slide for your story, discussion, or next cue.', 140, 535, 44, '#f6f4ee') +
     button('Return to the menu ↗', 640) + button('Finish the presentation ↗', 790))
card('06-finish.svg', 'Take it to the room.', 'Import a PowerPoint, or build a local deck with your own visuals.',
     text('When Fire TV Home is unavailable offline, launch through:', 140, 505, 38, '#ff943d') +
     text('Settings → Applications → Manage Installed Applications', 140, 585, 40, '#f6f4ee') +
     text('→ FirePresenter → Launch application', 140, 655, 40, '#f6f4ee') + button('Explore the demo again ↗', 770))


def link(label, slide, y):
    return dict(label=label, slide=slide, x=140/1920, y=y/1080, width=860/1920, height=115/1080)


slides = [
    dict(title='Welcome', image='bundled/01-welcome.svg'),
    dict(title='Clickable menu', image='bundled/02-menu.svg', links=[link('Graphics', 3, 440), link('Embedded video', 4, 590), link('Finish', 6, 740)]),
    dict(title='Graphics', image='bundled/03-graphics.svg', links=[link('Return to menu', 2, 740)]),
    dict(title='Embedded video', image='bundled/04-video.svg', video='bundled/demo.mp4', poster='bundled/video-poster.png', advanceOnEnd=True,
         videoRect=dict(x=320/1920, y=420/1080, width=1280/1920, height=480/1080)),
    dict(title='Holding slide', image='bundled/05-hold.svg', links=[link('Return to menu', 2, 640), link('Finish', 6, 790)]),
    dict(title='Finish', image='bundled/06-finish.svg', links=[link('Explore again', 2, 770)])
]
(ASSETS / 'deck.json').write_text(json.dumps(dict(title='FirePresenter demo', width=1920, height=1080, slides=slides), indent=2) + '\n')
