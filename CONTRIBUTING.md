# Contributing to Omar-Keyboard

Use the [revision 3 keymap](docs/design/keymap.md) for what a control does and the [hardware specification](hardware/specification.md) for where it sits. The research explains the decisions. Earlier drafts in `archive/` are historical references.

## Where to make a change

| Change | Edit | Verify |
| --- | --- | --- |
| Switch position, key size or matrix assignment | [Layout generator](tools/generate-layout.py) and the affected dimensions in the specification | Regenerate the CSV, Keyboard Layout Editor JSON, dimension drawing and embedded matrix table. Compare the diff and print the fit template. |
| An interaction or key legend | [Keymap](docs/design/keymap.md), [browser prototype](docs/prototype/OMAR-KEYBOARD-PROTOTYPE.html) and corresponding [QMK logic](firmware/qmk/) or [host binding](host/omarchy/) | Run the pilot and browser checks. Update the [validation tasks](docs/design/validation.md) when behavior changes. |
| Geometry, materials or camera | [Blender generator](tools/build-model.py) | Regenerate the assembly, render and GLB. Check the model and repackage the offline viewer. |
| Public project site | [Page](docs/index.html), [styles](docs/styles.css), [interaction script](docs/site.js) | Serve `docs/` locally and inspect the desktop and narrow layouts. The site, specification and README share the assets in `docs/assets/`. |

## Run the checks

Run commands from the repository root. Layout generation and link checks use Python 3.11 or later with the standard library. The C pilot runs on a desktop compiler with a small QMK test shim.

```sh
python tools/generate-layout.py
python tools/check-repository.py
git diff --exit-code -- hardware/specification.md hardware/layout docs/assets/omar-dimensions.svg

mkdir -p build
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/qmk -Itests tests/pilot.c -o build/omar-pilot
./build/omar-pilot
```

On Windows, create the `build` directory, compile the same source with `clang` and use `build/omar-pilot.exe` as the output. For the host checks, install `lupa==2.8` in a Python virtual environment, then run `python tests/check-host.py`. These tests exercise the Python helpers and Lua configuration with simulated desktop state. A real device and Omarchy session are covered by the [build pilot](docs/build/pilot.md).

The browser checks use Node.js 20 or later and Chromium. They exercise transfers, modifier behavior, the print layout and the self-contained 3D viewer with networking disabled.

```sh
npm ci
npx playwright install chromium
npm test
```

After a visible layout change, run `node tests/check-prototype.cjs --update-keymap` and inspect [the updated keymap](docs/assets/omar-keymap.png).

## Rebuild the 3D assets

The checked-in Blender assembly can be opened directly. To rebuild the assembly and studio render from the layout, use Blender 5.2 and install Pillow in the Python environment used for packaging. Run these in order.

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/build-model.py
blender --background --factory-startup --python-exit-code 1 --python tests/check-model.py
python tools/package-viewer.py
python tools/check-repository.py
node tests/check-viewer.cjs
```

The model builder uses Segoe UI Bold when available on Windows and Blender’s built-in font elsewhere. Set `OMAR_LEGEND_FONT` to an installed font file to choose the legend face. The saved legends are meshes. If the render changes, also refresh the site's WebP and social preview in `docs/assets/`. Keep the GLB at its shared path so the site, README and offline viewer use the same model.

Include the checks you ran with a proposed change. For physical trials, record the board, switch and encoder models, Omarchy version, measured result and any deviation from the [trial criteria](docs/design/validation.md).
