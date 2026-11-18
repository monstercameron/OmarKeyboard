<div align="center">

# Omar-Keyboard

**A keyboard made for [Omarchy](https://omarchy.org/).** Desks, windows and launchers get labeled keys of their own, arranged around a standard US layout.

[**Visit the site**](https://monstercameron.github.io/OmarKeyboard/) &nbsp;·&nbsp; [Try it in your browser](https://monstercameron.github.io/OmarKeyboard/prototype/OMAR-KEYBOARD-PROTOTYPE.html) &nbsp;·&nbsp; [Configure the firmware](https://monstercameron.github.io/OmarKeyboard/#configure) &nbsp;·&nbsp; [Read the assembly spec](hardware/assembly-design-specification.pdf)

![Three-quarter view of Omar-Keyboard showing the five desk keys, the outer control rails, two dials and the wide scroll roller](docs/assets/omar-render.webp)

</div>

## What it does

Omarchy runs on keyboard shortcuts. Omar-Keyboard puts the most-used ones on keys that say what they do, so you don't need to remember a chord.

- **Five desk keys** above the number row. Tap **Desk 3** to go there. Press **Send & Stay**, then **Desk 3**, to move the window and keep working where you are.
- **Launchers on the left edge.** Terminal, Browser, Files, Guide and Menu each have a key. Menu sits at home-row height.
- **Window controls on the right edge.** Hold **Focus** or **Swap** and press an arrow to move between tiles. Float, Fullscreen and Flip Split have keys of their own.
- **A wide roller** in place of the navigation block. Pull it toward you to scroll down. Hold Fn while rolling to move a page at a time.
- **Two dials.** The left one sets volume and mutes when pressed. The right one sets brightness.
- **A light under every key.** The 90 per-key lights show the active desk, a muted microphone and Caps Lock.

The typing block is an ordinary US QWERTY layout, with the full number row, two Super keys and Right Alt. Caps works as Fn when held. The [full keymap](docs/design/keymap.md) covers alternate legends and cancelling a move.

![Top-down keymap with desk keys in amber, launchers in green and window controls in blue](docs/assets/omar-keymap.png)

## Rev B.1 hardware

| | |
| --- | --- |
| Controller | RP2040 reading an 8 × 12 key matrix, with USB-C at the rear |
| Switches | 89 Gateron G Pro 3.0 Brown, and a Cherry MX Grey for Lock |
| Dials | Two Bourns PEC11R encoders with 24 detents |
| Lights | 90 SK6812MINI-E per-key LEDs on one chain, starting at Esc. A load switch turns the light rail off. |
| Power | About 292 mA at the default brightness, and under 450 mA at the brightness ceiling |
| Board | 4,744 copper segments, 522 vias, 235 nets and 403 parts. The design passes DRC. |
| Cost | JLCPCB quotes $277.81 for five assembled boards, or $55.56 each |
| Firmware | QMK, target `omar_keyboard/rev_b` |

Rev B.1 is a complete design and has not been fabricated yet. Fit, roller feel and electrical behavior still need a bench trial. The [Rev B package](hardware/mainboard-rev-b/README.md) has the KiCad sources, Gerbers, BOM and placement files. The [roadmap](https://monstercameron.github.io/OmarKeyboard/#roadmap) lists what comes next.

## Try it

- **In a browser.** The [interactive keyboard](https://monstercameron.github.io/OmarKeyboard/prototype/OMAR-KEYBOARD-PROTOTYPE.html) simulates the desks and windows. Try **Send & Stay** and then **Move & Go** with the same desk to compare them. **Print full-size fit template** prints the layout at true scale. Measure both 100 mm bars on the printout before you judge the fit.
- **In 3D.** The [site](https://monstercameron.github.io/OmarKeyboard/) has an orbiting model and the internal assembly. The [offline viewer](hardware/model/View-Omar-Keyboard.html) works without a network connection. The [Blender assembly](hardware/model/Omar-Keyboard.blend) and the [GLB](docs/assets/omar-keyboard.glb) are editable.
- **On a keyboard you already own.** The [build pilot](docs/build/pilot.md) maps the controls onto an existing QMK board. The [Omarchy bindings](host/omarchy/) target Omarchy v4.5.0.
- **With your own keymap.** The [firmware configurator](https://monstercameron.github.io/OmarKeyboard/#configure) changes key assignments and brightness, then writes a `keymap.c` you can compile with QMK.

To run the site locally, serve `docs/` from the repository root:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Then open `http://127.0.0.1:8000/`.

## Inside the repository

| To do this | Start here |
| --- | --- |
| Build or review the full assembly | [Assembly design specification](hardware/assembly-design-specification.md) · [Illustrated PDF](hardware/assembly-design-specification.pdf) |
| Order or review the Rev B.1 board | [KiCad project, BOM and quotes](hardware/mainboard-rev-b/README.md) · [Rev B firmware](firmware/qmk/omar_keyboard/rev_b/) |
| Look at the earlier Rev A board | [Rev A mainboard](hardware/mainboard/README.md) · [Verification report](hardware/mainboard/verification.md) · [Rev A firmware](firmware/qmk/omar_keyboard/rev_a/) |
| Check dimensions, switch positions or parts | [Hardware specification](hardware/specification.md) · [Parts and cost plan](hardware/parts-plan.md) · [Switch coordinates](hardware/layout/omar-switches.csv) · [Dimensioned drawing](docs/assets/omar-dimensions.svg) |
| See inside the case | [Internal assembly](hardware/model/internals/README.md) · [Offline internal viewer](hardware/model/internals/View-Internals.html) · [Tray STL](hardware/model/Omar-Keyboard-Tray.stl) |
| Run a reach or usability session | [Validation tasks and acceptance criteria](docs/design/validation.md) |
| Understand the design decisions | [Omarchy interaction patterns](docs/research/omarchy.md) · [Stock shortcuts](docs/research/stock-shortcuts.md) · [Keyboard market study](docs/research/keyboards.md) · [Controllers and firmware](docs/research/controllers.md) |
| Change the layout, model or site | [Contributor and verification guide](CONTRIBUTING.md) |
| See how the design started | [First layout](archive/first-layout.md) · [Earlier drafts](archive/earlier-drafts/) |

## License

The original code, hardware designs and documentation are released under the [MIT License](LICENSE). The bundled 3D viewer runtime has its own license, listed in the [third-party notices](THIRD_PARTY_NOTICES.md).
