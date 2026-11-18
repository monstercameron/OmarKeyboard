# Alps roller encoder mounting card · T3

This two-layer 1.00 mm FR4 board supports the EC11E15204A3 perpendicular to its shaft. Solder the three active terminals, both dummy terminals and both metal lugs. The two dummy terminals and the two lug lands are electrically isolated. The three insulated leads leave lap pads on the back face. [Alps drawing and mounting-side view](https://tech.alpsalpine.com/e/products/detail/EC11E15204A3/)

| Feature | Design dimensions in mm |
| --- | --- |
| Board envelope | 15.20 × 23.40 × 1.00, including 35 µm outer copper per side. ENIG. The two-segment corner relief clears the plate. |
| Board datum | Shaft centre at KiCad X30.00 Y25.00. In the mounting-side view local u is PCB X minus 30 and v is PCB Y minus 25. In the assembly +u points +Z and +v points toward the spacebar. |
| A, common, B | u = −2.50, 0, +2.50 at v = +7.50. Finished plated bores Ø1.08, land Ø1.72. |
| D and E | u = −2.50 and +2.50 at v = −7.00, same bores. Clip only these two dummy tails to a maximum 0.96 beyond the back pad after soldering to clear the H4 driver. |
| Two mechanical lugs | Centres at u = ±5.50, v = 0. Finished plated obround slots 1.60 along u × 4.20 along v. Land 2.25 × 4.90. The slots extend the supplier’s rectangular opening for a routed tool and the flared metal tabs. Check retention and full solder wetting on the first article. |
| Harness | Lap pads 2.40 along u × 1.05 along v on B.Cu at u = −5.60. Pad 1 at v4.40 carries A, pad 2 at v8.85 carries common, pad 3 at v13.60 carries B. Trace width 0.30. |

Use stranded, insulated conductors fitting Ø0.60 maximum jacket and Ø0.30 maximum bare bundle. Dress each jacket toward the relieved lower edge. Use a flexible electronics-compatible strain-relief bead on the stationary card inside the modeled envelope. The routed centreline uses two 1.80 mm bends per lead. Qualify the insulation, bead adhesion and static bend radius using the actual wire lot. Tin and fit each stripped tail through its Ø0.65 J2 hole. The nominal dressed centreline lengths from card lap to the modeled tail end are 15.83 mm (A), 11.84 mm (GND) and 10.81 mm (B). Cut long for forming, trim to fit and check the dressed bundle against the opening. Release J2 before separating the plate.

KiCad 7.0.11 shows zero DRC violations, unconnected pads and footprint errors. All six active pad assignments match the schematic. The STEP came directly from the KiCad outline, five round holes, two routed slots and 1.00 mm layer stack.

[KiCad project](roller-encoder.kicad_pro) · [Schematic](roller-encoder.kicad_sch) · [PCB](roller-encoder.kicad_pcb) · [Board STEP](roller-encoder.step) · [Gerbers and plated drills](roller-encoder-Gerbers.zip) · [DRC report](drc-report.txt) · [Cable routing and service](../mechanical-rfq/rev-b2-t3/README.md)
