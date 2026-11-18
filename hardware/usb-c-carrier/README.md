# T4 USB-C carrier

A reversible USB 2.0 device inlet for the B.2 keyboard. J1 is the GCT USB4105-GF-A on the top face. The protection circuit and four hand-soldered harness lands occupy the underside.

| Fabrication input | File or specification |
| --- | --- |
| Bare PCB | [Gerbers, plated and non-plated Excellon drills, and Gerber job](usb-c-carrier-Gerbers.zip) |
| Editable source | [KiCad project](usb-c-carrier.kicad_pro), [schematic](usb-c-carrier.kicad_sch), [routed PCB](usb-c-carrier.kicad_pcb) |
| PCBA | [Manufacturer BOM](assembly-bom.csv) and [five assembly placements](placement.csv). J1 needs solder on its shell stakes. J2 is four integral lap pads. H1/H2 are bare mechanical holes. |
| CAD and verification | [Populated STEP](usb-c-carrier.step), [KiCad DRC](drc-report.txt) and [assembly specification, sheet 20](../assembly-design-specification.md) |
| Order notes | Finished 20 × 7 × 1.00 mm FR-4, four copper layers, 0.50 mm corner chamfers, 35 µm outer and nominal 17.5 µm inner copper. ENIG finish. Two-sided assembly. Ask the assembler to panelize this small outline. Keep tabs and tooling clear of the connector mouth. |
| Filled vias | [Fabrication notes and selective via coordinates](fabrication-notes.txt) are included in the bare-board ZIP. Specify planar plated-over epoxy-filled vias under the J1 A6 and B6 solder land ends at KiCad X100.25 and X99.25, both Y104.25. Finished holes Ø0.20 mm, lands Ø0.40 mm. Confirm the assembler’s via treatment before purchase. |
| Layout rules | 0.18 mm signal traces, 0.15 mm net clearance, 0.20 mm copper-to-edge and minimum hole clearance. The four coincident-ground designators A1/A12/B1/B12 use 0.60 × 1.11 mm lands. The locators, shell slots and contact centers follow the GCT footprint. |
| Results | 31 connected pin assignments match the schematic. Zero DRC violations, zero open connections and zero footprint errors. The STEP contains the board and five fitted parts. |

J1 A5 and B5 have independent 5.1 kΩ pull-downs. Both plug orientations share D+ and D−. U1 pin 2 goes to ground and pin 5 to raw VBUS. F1 feeds the cable. At J2 the pin order is 1 fused VBUS, 2 D−, 3 D+, 4 ground. Keep the differential pair twisted up to each breakout. The B.2 mainboard provides the two 27 Ω series resistors. A8 and B8 are unconnected.

The STEP origin is the J1 footprint center in plan and the PCB bottom in Z. In the keyboard STEP place the carrier at X95.25, Y+5.65, Z−6.55 mm. The placement CSV instead follows KiCad's unshifted manufacturing origin and uses negative board Y. Verify the assembler's rendered origins and part rotations against the PCB before approving assembly.

For the first article, measure the CC pull-downs and verify cable continuity and VBUS isolation with power off. Then power through a current-limited source, check the voltage at motherboard J1 and test enumeration and keyboard data in both plug orientations. Repeat at the firmware’s maximum allowed LED current and check fuse temperature, cable retention and plug insertion depth. The board has no measured USB signal-integrity or ESD qualification.
