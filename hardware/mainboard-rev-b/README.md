# Omar-Keyboard mainboard Rev B.1

Rev B.1 is the two-layer, USB-powered 90-key backlit prototype. Open [the KiCad 7 project](omar-mainboard.kicad_pro) to inspect the routed board and 14-sheet schematic. Sections 07A and 07B of the [assembly specification](../assembly-design-specification.md) describe the optical stack, power sequencing, controls and first-article measurements.

| Design check | Result |
| --- | --- |
| PCB outline | 405.81 × 120.06 × 1.60 mm. The original 90 hot-swap socket positions, mount pattern and controller bay are retained. |
| LED apertures | 90 rear-mounted SK6812MINI-E parts and 90 milled optical windows, one per MX position. |
| Electrical consistency | Native KiCad schematic and PCB agree on 1,078 connected pad assignments across 235 named nets. All 90 pixel addresses match the compiled QMK target and the serial chain. |
| Copper and DRC | 4,744 trace segments, 522 vias and two ground pours. KiCad found zero rule violations, zero unconnected pads and zero footprint errors. [Native report](drc-report.txt) |
| Dial encoders | Bourns PEC11R-4220F-S0024 (C143797), 24 pulses and detents per turn. Both soldered anchors use 2.00 × 4.40 mm slots on 11.40 mm centers. |
| USB data | D+ 11.85 mm and D− 11.56 mm on the mainboard, including both sides of the 27 Ω series parts. Neither line uses a via. The carrier and harness add to these lengths. |
| Parts | 403 fitted components per board, 29 on top and 374 on the bottom. The two dial encoders have through-hole pins. Switches and keycaps install afterward. |
| Optical and power validation | The capped-white current estimate is 393 mA including the logic allowance. Measure inrush, worst-case white current, far-end voltage, suspend, and legend legibility with purchased parts before production. The separate USB-C inlet carrier is still a development item. |

**Historical B.1 configuration.** The pull-ups and separate roller card are implemented in [Rev B.2](../mainboard-rev-b2/README.md). This B.1 directory preserves the earlier quote and board. The quoted Rev B.1 board routes J2 pins 1/2/3 to GP24 (A), GND and GP25 (B). Each input relies on the RP2040 internal pull-up. For the selected Alps encoder, add two 2.7 kΩ ±1% 0603 pull-ups from ROLL_A and ROLL_B to 3V3, one per channel. The separate encoder card carries its soldered lugs, terminals and three-wire pigtail. Both additions need implementation and bench verification. The quote covers 403 placements. [Electrical acceptance, sheet 18A](../assembly-design-specification.md) · [Purchasing BOM](purchasing-bom.csv)

**For a fabrication estimate.** Upload the [Gerber and drill ZIP](Omar-Keyboard-Rev-B.1-Gerbers.zip), then the [assembly BOM](JLCPCB-BOM.csv) and [placement file](JLCPCB-CPL.csv). Check both board faces, socket pickup centers, diode cathodes, the encoder orientation and LED pin 1 in the assembly preview. Part codes identify the exact design selections. A match in the catalog does not reserve inventory. [Five-board fully populated quote](quotes/2026-11-18-bourns/Omar-Keyboard-Rev-B.1-JLCPCB-quote.md) · [Earlier Rev B partial quote](quotes/2026-11-18/Omar-Keyboard-Rev-B-JLCPCB-quote.md).

**For assembly.** The [complete purchasing BOM](purchasing-bom.csv) includes off-board items. The [per-key light register](backlight-map.csv) gives data-in/data-out, matrix address and optical center, viewed from the switch side with Y toward the typist. Existing indicators retain their original PCB designators. The serial chain runs from Esc to Files.

**Firmware.** The default target builds on QMK 0.31.0. Copy the rev_b directory into keyboards/omar_keyboard/ in that checkout, then copy the shared omar-controls.h and omar-indicators.h from firmware/qmk into the target's keymaps/default/ directory. Build with `qmk compile -kb omar_keyboard/rev_b -km default`. The [compiled RP2040 image](../../firmware/builds/omar_keyboard_rev_b_default.uf2) targets Rev B. The prototype retains the project's provisional USB VID/PID.

[QMK target](../../firmware/qmk/omar_keyboard/rev_b/) · [OPSCO emitter data](https://cdn-shop.adafruit.com/product-files/4960/4960_SK6812MINI-E_REV02_EN.pdf) · [TI load switch at JLCPCB](https://jlcpcb.com/partdetail/TPS22919DCKR/C2149796)
