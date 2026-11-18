# Omar-Keyboard T2 parts and placement review

18 November 2026 · Rev B.1 mainboard · T2 plate and roller · Independent engineering review

**Release decision.** The plate pattern registers to the mainboard and the selected Alps encoder provides the intended axial engagement. Hold the production roller and recheck the encoder opening after laying out its mounting card. The current plate remains suitable for quoting and prototype fit checks.

## Findings

| Priority | Finding and evidence | Change to verify |
| --- | --- | --- |
| High | Alps requires soldering the encoder's metal lugs to a substrate. The T2 cradle supports the bushing and housing, but the design specifies three individual wires and omits the substrate. On the actual encoder at X381.50, the upper signal terminal spans Z8.05–8.95. There is 0.375 mm clearance outboard at that height. The hood notch ends at Z7.00 and the existing wire envelope is Ø0.44 before adding a solder joint. | Model a small encoder PCB or another mounting arrangement approved by Alps. Include lug solder, strain relief and wire bends. Check the rear stops, which start 0.15 mm behind the housing. Repeat the plate and hood clearance tests. |
| High | ROLL_A and ROLL_B each connect only the RP2040 and J2. The internal 50–80 kΩ pull-ups give approximately 41–66 µA at 3.3 V. Alps specifies a 1 mA minimum resistive operating current. The J2 order of A, ground, B and the firmware assignments GP24/GP25 agree. | Size an external 3.3 V pull-up for each channel, allowing for supply and resistor tolerance. A 2.7 kΩ example supplies about 1.22 mA nominal per closed contact. Putting the pull-ups on the mainboard preserves the three-wire harness. Verify counts in both directions. |
| High | The Ø6.00 MR63ZZ bearing cannot lift vertically past the 4.923 mm opening in the rigid R04 carrier. A 0.50 mm lift produces 0.854 mm³ of interference with the bearing envelope and 0.214 mm³ with the core journal. The service drawing instructs the builder to lift the coupled roller out of its saddles. | Test the sequence with R04 coming up with the rotor, followed by axial separation. Alternatively make the carrier split. Check axial capture and that the fixed shoulder touches only the outer race of the purchased bearing. |
| Medium | In the positioned STEP, the drive flat faces +Y and the tapped hole faces +Z. The 5 mm flat-point screw would stand about 1.00 mm proud of the core against the shaft's round surface. Turned onto the flat, the screw would sit about 0.50 mm below the core surface. | Correct the rotational mate and show the screw in place before fitting the silicone sleeve. The turned core and the shaft length can be retained for this correction. |
| Medium | Exact nominal distances are 0.433 mm from tread to hood and 0.485 mm from tread to plate. The encoder clears its hood and cradle by 0.050 mm at the closest surfaces and clears the plate by 0.253 mm. The Ø6.04 bearing seat gives 0.020 mm radial allowance. JLC publishes 0.6 mm moving clearance and ±0.3 mm dimensional tolerance at these printed part sizes in 1172 Pro. | Define finished fits or use a printed coupon and secondary sizing. Check the tread through a full revolution under end load. Obtain supplier acceptance of the finished 14.00–14.05 mm plate windows before ordering a production plate. |
| Documentation | The Rev B.1 purchasing BOM still describes the Alps unit as a bench sample subject to the older 7.50 mm bay. Sheet 18 and the T2 parts place it in an extended bay. | Update the purchasing record and service drawing when the corrected module is released. |

Manufacturer references are the [Alps Alpine EC11E15204A3 ratings, mounting and soldering instructions](https://tech.alpsalpine.com/e/products/detail/EC11E15204A3/), [RP2040 pull-up specifications, page 617](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf#page=617), [JLC SLS design rules](https://jlc3dp.com/3d-printing/selective-laser-sintering) and [1172 Pro material tolerances](https://jlc3dp.com/help/article/precimid-1172-pro).

## Checks that passed

- All 92 plate openings for switches and corner dials and all 12 shared deck holes match their KiCad centers to better than 0.001 mm. The front face of the delivered plate STEP has 123 contours including the perimeter and 6,893.994 mm total cut length.
- All 90 PCB emitter centers match the intended optical position 5.08 mm toward the rear of their respective MX stations. This checks position only. Actual light transmission and solder-joint quality require a populated sample.
- The Bourns corner dial pattern uses the correct nominal 11.40 mm anchor center spacing. The 13.20 mm dimension on the supplier's diagram spans the outside edges of the two 1.80 mm nominal openings. The board uses 2.00 × 4.40 mm plated obround slots. Fit and solder retention still need an actual encoder and board. [Bourns drawing, page 2](https://www.bourns.com/docs/Product-Datasheets/PEC11R.pdf#page=2)
- The uncut Alps shaft reaches 12.00 mm into the 14.00 mm full-diameter bore. The 2.00 mm tip allowance and 9.00 mm axial distance from tip to set screw are consistent. The revised opening leaves 3.059 mm to M4 and 2.920 mm to H4.

## Scope and evidence

The independent reviewer used the released T2 solids, the exact Alps solid, the Rev B.1 board and the mechanical drawings. A second check extracted the loops directly from the delivered plate STEP and matched them to placed KiCad footprints. Static clearance, an extraction motion and set-screw orientation were evaluated separately. Physical print shrinkage, board assembly, operating force, loaded runout, harness routing, the USB carrier and the entire populated keyboard have not been demonstrated by this review.
