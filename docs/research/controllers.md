# Controller and firmware choices for Omar Keyboard

Research checked November 17, 2026.

**Use the original Raspberry Pi Pico for an unlit, wired prototype and a bare RP2040 for a fully lit PCB.** The current 90-key board has 92 switch contacts and three encoders. With direct wiring, one data line for addressable indicators takes the lit version past the Pico’s 26 exposed GPIO. A bare RP2040 has 30 GPIO and leaves three spare on the proposed allocation. A small wireless module would need a different matrix, an expander or another controller. [Pico board specifications](https://www.raspberrypi.com/products/raspberry-pi-pico/) · [RP2040 chip specifications](https://www.raspberrypi.com/products/rp2040/) · [QMK on RP2040](https://docs.qmk.fm/platformdev_rp2040)

## Which controller boards fit?

The microcontroller scans the switches. A development board packages that chip with power, USB, and accessible pins. Two boards using the same chip can differ enough to change how you wire the keyboard.

| Chip and example board | Firmware and connection | When I’d choose it |
| --- | --- | --- |
| RP2040 · Raspberry Pi Pico | QMK over USB | A hand-wired, single-piece prototype. The original Pico has a Micro-USB connector and 26 exposed GPIO. [Pico specifications](https://www.raspberrypi.com/products/raspberry-pi-pico/) |
| RP2040 · Adafruit KB2040 | QMK over USB | A compact, USB-C build. The board costs $9.95 and exposes 20 GPIO. Eighteen are on the edges and the last two are on the STEMMA QT connector, which matters when laying out the matrix. [Adafruit KB2040](https://www.adafruit.com/product/5302) |
| Nordic nRF52840 · nice!nano v2 | ZMK over USB or Bluetooth Low Energy (BLE) | A rechargeable wireless board. It combines USB-C, a battery charger, and 21 GPIO in a Pro Micro footprint. The smaller Seeed XIAO nRF52840 exposes 11 GPIO on its standard headers and is easier to use on a macropad. [nice!nano](https://nicekeyboards.com/nice-nano/) · [Seeed XIAO](https://wiki.seeedstudio.com/XIAO_BLE/) |
| Microchip ATmega32U4 · SparkFun Pro Micro | QMK over USB | Reusing a classic DIY keyboard PCB designed for this module. Its 32 KB flash budget can force trade-offs as lighting and remapping features accumulate. [QMK controllers](https://docs.qmk.fm/compatible_microcontrollers) · [QMK firmware size guide](https://docs.qmk.fm/squeezing_avr) |
| STM32F411 · WeAct Black Pill | QMK over USB | A wired build using an existing STM32 design. QMK documents which board pins are shared with startup circuitry and onboard components. [QMK Black Pill guide](https://docs.qmk.fm/platformdev_blackpill_f4x1) |
| RP2350 · Raspberry Pi Pico 2, or Espressif ESP32-S3 | RMK over USB, with BLE on Pico 2 W or ESP32-S3 | A Rust-based design. Check the exact chip when picking an ESP32 board. RMK lists USB and BLE for the S3, and BLE for the C3 and C6. Its RP2350 support currently uses the Rust API. [RMK hardware and transport matrix](https://rmk.rs/main/docs/getting_started/supported_hardwares) |

## What the firmware changes

| Firmware | How you would use it on Omar |
| --- | --- |
| **QMK** | Define a keymap in C. A momentary layer, independent modifiers, and modified arrow keys implement the proposed window-manager controls. A VIA-enabled build can expose live remapping. Vial provides another editor with its own QMK fork. [QMK layers](https://docs.qmk.fm/feature_layers) · [Modifier keys](https://docs.qmk.fm/feature_advanced_keycodes) · [VIA](https://www.caniusevia.com/docs/specification/) · [Vial](https://get.vial.today/docs/porting-to-vial.html) |
| **ZMK** | Define the keymap in a declarative file. It supports momentary layers, BLE host profiles, and USB output. Enable ZMK Studio in the build if owners should be able to edit supported keymap settings live. [Layer behaviors](https://zmk.dev/docs/keymaps/behaviors/layers) · [Bluetooth](https://zmk.dev/docs/keymaps/behaviors/bluetooth) · [ZMK Studio](https://zmk.dev/docs/features/studio) |
| **RMK** | Use configuration files on supported chips or write custom behavior in Rust. A good fit if the project already uses Rust or needs a particular supported USB/BLE combination. [RMK documentation](https://rmk.rs/main/docs/getting_started/supported_hardwares) |
| **KMK** | Edit a Python keymap directly on a CircuitPython board. Convenient for a small experiment. The maintainers have paused active development, issues, and pull requests, which weighs against choosing it for a keyboard we plan to maintain. [KMK project status](https://github.com/KMKfw/kmk_firmware) |

## Three decisions specific to Omar

1. **Budget the current switch field.** Use an 8 × 12 electrical matrix with one diode per switch. It accommodates 90 keys and two dial presses, leaving four intersections free. The 20 matrix wires plus two quadrature signals per encoder use 26 GPIO. An addressable LED chain brings that to 27. The roller has no press switch. [QMK switch matrices](https://docs.qmk.fm/how_a_matrix_works) · [QMK encoders](https://docs.qmk.fm/features/encoders)
2. **Separate the momentary function layer from desktop actions.** Caps tap gives Caps Lock and hold gives Fn. Both Super keys remain normal modifiers on every layer. A dedicated Alt key at the bottom right sends Right Alt and replaces the right Ctrl. Fn adds only the printed second legends and Omar has no function keys. Dedicated keys can send stock desktop chords that contain Alt. The [pilot build notes](../build/pilot.md) give the QMK configuration and encoder directions.
3. **Design for the first keystroke after power-on.** Omarchy’s default encrypted install expects a wired keyboard or a USB keyboard receiver at disk unlock. Direct host Bluetooth becomes useful once the OS is running. For a wireless prototype, test passphrase entry after a cold boot over the USB data cable. If cable-free startup becomes a requirement, ZMK also documents a dedicated receiver that runs its own firmware and presents the keyboard over USB. That configuration needs its own cold-boot test. [Omarchy installation manual](https://omarchy.org/manual/getting-started/) · [ZMK keyboard dongle](https://zmk.dev/docs/hardware-integration/dongle)

## Example GPIO schedule

| Signals | Original Pico, unlit prototype | Bare RP2040, lit board |
| --- | --- | --- |
| Eight matrix rows | GP0–GP7 | GP0–GP7 |
| Twelve matrix columns | GP8–GP19 | GP8–GP19 |
| Volume A/B | GP20, GP21 | GP20, GP21 |
| Brightness A/B | GP22, GP26 | GP22, GP23 |
| Page roller A/B | GP27, GP28 | GP24, GP25 |
| Indicator data | None. Armed light on onboard GP25 | GP26 |
| Spare | 0 exposed GPIO | GP27–GP29 |

Pico GP23–GP25 serve onboard functions. The unlit Pico build uses the onboard LED on GP25 as the armed light, lit while a transfer is pending or Focus or Swap is held. It needs a light pipe or case window to be seen. The lit board’s per-key lights still show the five targets. The bare-chip schedule assumes a custom PCB with its own regulator, flash, USB routing, decoupling and boot/debug connections. Pick the LED supply and data-level interface from the actual LED datasheet and check total USB current before routing. An RP2350B offers 48 GPIO for future expansion. Neither a larger chip nor an expander is needed for the stated bare-RP2040 allocation. [Pico board datasheet and pinout](https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf) · [RP2350 specifications](https://www.raspberrypi.com/products/rp2350/)
