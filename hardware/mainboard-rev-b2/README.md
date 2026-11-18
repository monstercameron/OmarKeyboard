# Omar-Keyboard mainboard Rev B.2

[Populated B.2 STEP](omar-mainboard-populated.step) includes all 405 installed references. [T4 full assembly and interference checks](../mechanical-rfq/rev-b2-t4/README.md).

Rev B.2 adds two independent roller encoder pull-ups to the routed 90-LED RP2040 board. It uses the same three-wire J2 pinout and existing Rev B QMK target. The historical B.1 supplier price covers 403 placements. B.2 has 405 placements and needs its own price and first-article test.

| Reference | Connection | Footprint centre in board coordinates | Side |
| --- | --- | --- | --- |
| R12 | +3V3 to ROLL_A, J2.1 and GP24 | X366.90 Y52.80 | Front |
| R13 | +3V3 to ROLL_B, J2.3 and GP25 | X352.50 Y44.10 | Back |

Both parts are UNI-ROYAL 0603WAF2701T5E, 2.7 kΩ ±1%, 0603, 100 mW. The resistor alone supplies 1.22 mA at 3.30 V through a closed contact. J2.2 is common ground. On a populated board measure both closed-contact currents against 1–10 mA and confirm clean logic transitions and 30 scroll events per turn in each direction. [Resistor listing](https://jlcpcb.com/partdetail/C13167) · [Encoder rating](https://tech.alpsalpine.com/e/products/detail/EC11E15204A3/)

KiCad 7.0.11 reports zero DRC violations, unconnected pads and footprint errors. The schematic and PCB agree on all 1,082 connected pad assignments. The assembly BOM and CPL contain the same 405 distinct references. Both new placement centres, rotations and sides match the native placement export. The R13 bottom-side and R12 top-side fit envelopes appear in the roller STEP.

[KiCad project](omar-mainboard.kicad_pro) · [Schematic](omar-mainboard.kicad_sch) · [Routed PCB](omar-mainboard.kicad_pcb) · [DRC report](drc-report.txt)

[Gerbers and drills](omar-mainboard-Gerbers.zip) · [JLCPCB BOM](JLCPCB-BOM.csv) · [JLCPCB CPL](JLCPCB-CPL.csv) · [Purchasing BOM](purchasing-bom.csv) · [Roller card](../roller-encoder-card/README.md) · [Positioned assembly](../mechanical-rfq/rev-b2-t3/README.md)
