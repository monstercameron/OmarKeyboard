# Omar Keyboard pilot

Use a spare QMK keyboard or macropad to test the design before ordering the custom PCB. This kit supplies key-handling code, an optional Omarchy host profile and a host-to-keyboard indicator protocol. A board-specific matrix layout and a QMK build for the chosen test board are still required.

## 1. Map an existing QMK board

Work in a separate keymap for your test board. Include [omar-controls.h](../../firmware/qmk/omar-controls.h) once in `keymap.c` after `#include QMK_KEYBOARD_H`. The header allocates custom keycodes starting at `SAFE_RANGE`. Start any additional user codes at `OM_KEYCODE_END`, or merge the enums if your keymap already allocates that range. Copy the required headers from `firmware/qmk/` into that keymap directory and integrate these calls with any existing hooks.

```c
bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    return omar_process_record(keycode, record);
}
void keyboard_post_init_user(void) {
    omar_init();
}
void matrix_scan_user(void) {
    omar_scan();
}
void suspend_power_down_user(void) {
    omar_reset_input();
}
```

| Position | Base keycode | Fn keycode |
| --- | --- | --- |
| Caps | `LT(1, KC_CAPS)` | Transparent Caps position |
| Super left/right | `KC_LGUI`, `KC_RGUI` | Transparent, transparent |
| Alt (bottom right, replaces right Ctrl) | `KC_RALT` | Transparent |
| Digits 1–0, minus, equals | Normal typing keys | Transparent. Omar has no function keys |
| Left, Right, Up, Down, Delete | Standard keycodes | `KC_HOME`, `KC_END`, `KC_PGUP`, `KC_PGDN`, `KC_INS` |
| Five desks, former desk | `OM_DESK1` through `OM_DESK5`, `OM_LAST_DESK` | Transparent |
| Transfer and direction controls | `OM_STAY`, `OM_GO`, `OM_FOCUS`, `OM_SWAP` | Transparent |
| Window cycle and menu | `OM_NEXT`, `OM_MENU` | Private code `KC_F14` for last window, transparent Menu |
| Guide, Mic Mute, Screenshot | Private codes `KC_F13` and `KC_F15`, then `KC_PSCR` | Transparent |
| Layout and speaker-mute dial presses | `LGUI(KC_L)`, `KC_MUTE` | Transparent |

For the other labeled keys, use the [stock output map](../design/keymap.md). For example, Browser is `LGUI(LSFT(KC_B))` and Grab Text is `LGUI(LCTL(KC_PSCR))`. Leave unspecified Fn positions transparent. Use layer 1 for Fn or adjust `LT` to match your board. In `config.h` set `TAPPING_TERM 200`, `HOLD_ON_OTHER_KEY_PRESS` and `QUICK_TAP_TERM 0`. If the target already uses tap-hold keys, apply those settings per key to Caps where supported. Alternate finger rolls, repeated Caps taps and holding Alt with the right hand on the arrows are part of the trial. [QMK tap-hold behavior](https://docs.qmk.fm/tap_hold) · [Layer tap and transparent keys](https://docs.qmk.fm/feature_layers)

For a three-encoder board enable `ENCODER_ENABLE`, `ENCODER_MAP_ENABLE`, `EXTRAKEY_ENABLE` and `MOUSEKEY_ENABLE` in `rules.mk`. Define A/B pins in the keyboard definition. An encoder map uses these detent pairs. A macropad without encoders can use spare switches for the same outputs.

| Encoder | Base counterclockwise / clockwise | Fn counterclockwise / clockwise |
| --- | --- | --- |
| Volume | `KC_VOLD` / `KC_VOLU` | Same |
| Brightness | `KC_BRID` / `KC_BRIU` | `LGUI(KC_MINS)` / `LGUI(KC_EQL)` |
| Roller | Push away `MS_WHLU` / pull toward user `MS_WHLD` | Push away `KC_PGUP` / pull toward user `KC_PGDN` |

Reverse the pair if the mechanical orientation is reversed. With Fn held, confirm the first detent after a quick press uses the Fn layer. QMK’s encoder map generates press and release events. Detents do not cancel a pending transfer. A custom encoder callback must likewise leave the pending state alone, and so must modifier presses and the Caps/Fn layer-tap key. Build using `qmk compile -kb <target> -km <pilot-keymap>` after filling in the target’s actual names and physical layout. [QMK encoders](https://docs.qmk.fm/features/encoders) · [Mouse wheel codes](https://docs.qmk.fm/features/mouse_keys)

## 2. Optional Omarchy host bindings

The labeled workspace, transfer, window, clipboard and launcher commands use Omarchy v4.5.0 defaults directly. `Super+Tab` retains workspace travel. For the additional guide, per-workspace window history and QMK microphone fallback, run the following commands from the repository root on the **target Linux machine**.

```sh
install -d "$HOME/.local/share/omar-keyboard"
install -m 644 docs/prototype/OMAR-KEYBOARD-PROTOTYPE.html host/omarchy/omar-host.py host/omarchy/omar-bindings.lua "$HOME/.local/share/omar-keyboard/"
```

Add this one line to the end of the user's `~/.config/hypr/bindings.lua`, then reload with `hyprctl reload` and check `hyprctl configerrors`. The local Guide uses the default browser and opens directly to a keyboard-scrollable guide. Esc collapses the guide. Super + K opens Omarchy’s live bindings.

```lua
dofile(os.getenv("HOME") .. "/.local/share/omar-keyboard/omar-bindings.lua")
```

Three private input codes (F13, F14 and F15 to the host, never labeled for the user) open the Guide, return to the most recently focused eligible window on the same workspace and run Omarchy’s microphone toggle. The last-window code filters by workspace, mapped/visible state and focus history. With three windows, use the directional controls to change focus out of cycle order and then confirm the code toggles between the last pair. [Omarchy binding template](https://github.com/omacom/omarchy/blob/v4.5.0/config/hypr/bindings.lua) · [Omarchy use of focusHistoryID](https://github.com/omacom/omarchy/blob/v4.5.0/bin/omarchy-hyprland-focus-app)

**Optional five-desk mode.** Set `omar_five_desks = true` immediately *before* the `dofile` line. Numbered visit/move/send bindings for 6–10 are removed from the Omarchy session. Super + Tab, Shift + Super + Tab and Super + vertical wheel wrap over slots 1–5 on the active monitor. Last Desk uses the last eligible slot visited there since reload. The setting applies to all keyboards attached to that session. Applications and unrelated input bindings can still create other workspaces. Remove the setting and reload for stock workspace behavior. [Omarchy per-monitor slot mapping](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/monitor-workspaces.lua)

## 3. Optional desk and microphone lights

**Local lights.** During a transfer, light its key and the five valid targets from `omar_transfer`. While Focus or Swap is held, light the arrows using `omar_focus_held` and `omar_swap_held`. Call `omar_scan()` once each matrix scan. Local gesture feedback takes visual priority over the active-desk light.

**Armed light on an unlit build.** Define `OMAR_ARMED_LED_PIN` (for example `GP25` on the Pico) in `config.h`. `omar_init()`, called from `keyboard_post_init_user`, sets the pin as an output and drives it low using QMK’s `gpio_set_pin_output` and `gpio_write_pin_low`. `omar_scan()` drives it high with `gpio_write_pin` while a transfer is pending or Focus or Swap is held, and low otherwise. Without the define, `omar_init()` is empty. The Pico’s onboard LED needs a light pipe or case window to be visible.

**Host state.** Enable `RAW_ENABLE = yes` on a test keymap with an available Raw HID interface. Include [omar-indicators.h](../../firmware/qmk/omar-indicators.h) after the QMK headers, call `omar_scan_indicators()` in the matrix scan and `omar_clear_indicators()` on suspend. If the keymap already owns Raw HID, integrate or allocate a distinct interface before enabling this receiver. In the board’s LED callback, light desk `omar_lit_desk` only for 1–5 and show mic mute only when `omar_mic_known && omar_mic_muted`. Physical LED index mapping belongs to the chosen PCB.

The optional [indicator bridge](../../host/omarchy/omar-indicators.py) runs as the logged-in Omarchy user. It needs Python 3, the Python `hidapi` package with hidraw access to this keyboard, `hyprctl` and `wpctl`. It listens to Hyprland's event socket and to `pactl subscribe` when available, then derives the desk slot from `hyprctl -j activeworkspace`, using Omarchy’s ten-slot per-monitor numbering (slot = (id − 1) mod 10 + 1), and reads the default input source with `wpctl`. It re-sends the cached packet every second as a heartbeat and queries `hyprctl` and `wpctl` again only when an event arrives or five seconds have passed. Start it with `python3 host/omarchy/omar-indicators.py --vid <actual-vendor-id> --pid <actual-product-id>` using hexadecimal numbers with a `0x` prefix. Add `--serial` if two devices match. No identities or LED indexes are assumed.

The bridge matches VID, PID, usage page `0xFF60` and usage `0x61`. For HIDAPI writes it prefixes report ID zero to a 32-byte payload. Payload bytes 0–3 are signature `0x4F`, version `1`, flags and desk slot. Flag bit 0 means desk known, bit 1 means microphone known and bit 2 means muted. Other bytes are zero. Unknown or out-of-bank desks (slots 6–10) clear the desk light. The receiver expires both host indicators after three seconds without a valid report, which is why the one-second heartbeat is required. On unplug, device access failure or restart the bridge retries. Typing and local gesture feedback work independently. [QMK Raw HID](https://docs.qmk.fm/features/rawhid) · [Hyprland CLI](https://wiki.hypr.land/configuring/core/advanced-configuration/using-hyprctl/)

## 4. Release checks

The C test harness, the mock host test and the browser check were updated for revision 3 (no function keys, Alt key, revised transfer cancel rule, armed light, indicator bridge) and all three pass. The harness and host tests use simulated QMK and compositor APIs and cover the timing boundary, Focus and Swap overlap, modifier restoration, timer wraparound, per-workspace focus history, indicator packets and both Lua workspace profiles.

Use the [UX acceptance tests](../design/validation.md) before selecting switches or ordering a plate. The [wiring schedule](../research/controllers.md) gives an unlit Pico allocation and a lit bare-RP2040 allocation. The host profile and pilot are provided as source for that trial. The armed light, the bridge against a live Hyprland session, USB cold boot, firmware timing on the final board, actual LED ordering and microphone/display behavior need a connected target.
