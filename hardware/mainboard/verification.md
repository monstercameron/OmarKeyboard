# Rev A verification

**Engineering prototype.** This directory contains editable KiCad 7 sources, an eight-sheet [schematic PDF](schematic.pdf), the [board preview](board-preview.png), a fitted [BOM](bom.csv) and the [full KiCad DRC report](drc-report.txt).

All named pad connections have copper continuity. KiCad reported zero rule violations.

| Check | Observed result |
| --- | --- |
| Schematic to PCB | All 613 connected reference/pad-number pairs match across 157 named nets and 257 electrical footprints. Three spare GPIOs and the regulator NC pad are explicitly unconnected. |
| Position and matrix | All 92 contacts match the layout CSV in position, key name, matrix address and diode orientation. All 15 LED indices and chain connections match the QMK target. |
| Copper | 2,277 trace segments, 180 through vias, 2 filled ground zones. KiCad reports **0 outstanding connections**. |
| Mainboard USB data | Copper centreline lengths on both sides of the 27 Ω series resistors total 11.85 mm on D+ and 11.56 mm on D−. Difference 0.30 mm, 0 data vias. The carrier and harness add to the physical channel. |
| Firmware | Compiled and linked the default keymap on QMK 0.31.0 with the Arm embedded toolchain. UF2 size is 82,944 bytes. |
| Physical testing | First-article power, USB enumeration, scan, dial, roller, indicator and case-fit tests are pending. |

### Native KiCad findings

| Report category | Count |
| --- | ---: |
| Findings | 0 |

### Before releasing fabrication files

1. Review USB D+/D− geometry with the fabricator for the actual stack-up, and verify the return path across the harness and carrier. Review crystal load and loop area, QSPI timing, regulator bypassing, exposed-pad grounding and the 5 V drop to the farthest indicator. After any change rerun the schematic/PCB comparison and KiCad DRC.
2. Verify the hot-swap contact land orientation, bottom-side LED pin 1, and encoder retention slots against purchased samples at 1:1. Test the two remaining trial mounts, the removed Enter-side support, underside clearances and plate-to-PCB spacing in the assembled case.
3. Complete the rear USB-C carrier and compare its numbered pads with J1. Inspect the assembler’s Gerber, drill, paste and placement previews for both sides before the first order.
4. On one assembled board, check for power shorts before applying current-limited power. Measure 5 V, 3.3 V and 1.1 V. Confirm boot drive recovery, flash the tested UF2, exercise all 92 inputs, rotate each encoder one detent in both directions, test the 15 lights and verify suspend current and full-load input current. Record results before buying a full assembled batch.

UF2 SHA-256: `70fbdbb864ca5f43fb3c7e7e7146b436db597a30a8ceab83b922089685ae0db0`.
