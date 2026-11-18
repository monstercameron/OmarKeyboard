# Omar-Keyboard mechanical quotation package

Rev B.1 mainboard · Mechanical prototype T1 · 18 November 2026 · All dimensions in millimetres.

## Live quote results

| Part, quantity one | Supplier result in USD |
| --- | --- |
| One-piece tray | JLC3DP accepted the 422.80 × 139.43 × 32.04 mm STL in white SLS 1172Pro nylon, no finish. Standard build $110.79, 4 days. Displayed shipping estimate $18.12, Global Standard Direct Line, 8–10 business days. Combined estimate $128.91 before any tax, duties or subsequent review charges. [Quote capture](JLC3DP-tray-quote.jpg) |
| P01 switch plate | JLCCNC parsed 405.81 × 120.06 × 1.50, 5052 aluminum, no finish, quantity one, and requires a manual quote. Submission of a review request was not confirmed by the portal. No plate price has been issued. The $26.08 displayed on the page is shipping only. [Portal capture](JLCCNC-plate-manual-review.jpg) |
| R01 roller core | JLCCNC parsed 46.19 × 14.00 × 14.00 including the journal. Configured 6061 aluminum, bare, threads required, drawing attached, closest portal tolerance class ±0.02. Standard $40.84 for 5 days, economy $36.12 for 10 days. Displayed standalone shipping estimate $26.08 via UPS Express Saver (DDP), 2–4 business days. Standard plus that shipping estimate is $66.92. Drawing-specific bearing fit still needs supplier acceptance. [Portal capture](JLCCNC-roller-estimate.jpg) |

These are independent quote lines. Freight, discounts and taxes on a combined order may differ. No payment or production was authorized. Bezel, supports, sample coupon, silicone, bearings, encoder and screws are outside the two priced items.

## Files to send

| ID | Quantity and operation | Files |
| --- | --- | --- |
| P01 | 1 flat plate, deburred 5052 sheet, 1.50 thick | [STEP](P01-Switch-plate.step) · [Drawing and opening coordinates](P01-Switch-plate.pdf) |
| P02 | 1 optional first-article coupon, same 5052 stock, cut and finish as P01 | [STEP](P02-Fit-coupon.step) · [Drawing](P02-Fit-coupon.pdf) |
| R01 | 1 turned 6061-T6 core with integral bearing journal and a radial tapped hole | [STEP](R01-Scroll-roller-core.step) · [Section and machining drawing](R01-Scroll-roller-core.pdf) |
| R02 | 1 silicone tread. Nominal stock Ø14 ID × Ø16 OD × 42 long | [Stock reference STEP](R02-Silicone-sleeve-reference.step) · [Drawing, sheet 2](R02-R05-Roller-support-drawings.pdf) |
| R03 | 1 nylon trial bezel with wheel clearance and raised end covers | [STEP](R03-Bezel-trial.step) · [Drawing, sheet 1](R02-R05-Roller-support-drawings.pdf) |
| R04 | 1 nylon trial bearing carrier with integral left clamp foot | [STEP](R04-Bearing-carrier-trial.step) · [Drawing, sheet 2](R02-R05-Roller-support-drawings.pdf) |
| R05 | 1 nylon encoder-side clamp foot | [STEP](R05-Encoder-side-foot.step) · [Drawing, sheet 2](R02-R05-Roller-support-drawings.pdf) |

For a repeat quote, upload each custom part and its corresponding drawing together. For the sheet-metal line, ask the shop to price the 92 finished 14.00–14.05 square windows and the nominal R0.18 inside corners explicitly. Ask them to confirm the narrow metal web between the lead passage and the nearby Ø2.20 module fixing, or mark up an alternative. The nominal web is 0.388 mm to the rounded corner. M4 on the drawing is a location ID. [Sheet-metal quote](https://jlccnc.com/sheet-metal-quote) · [CNC quote](https://jlccnc.com/cnc-machining-quote) · [3D print quote](https://jlc3dp.com/3d-printing-quote)

## Assembly and verification

- P01 uses Rev B.1 switch and mount coordinates. Its 122 through-cuts comprise 92 switch/dial windows, 12 stabilizer windows, 12 shared mounting holes, four module fixings and two roller-related slots. The tabulated plan Y grows toward the user. In the STEP, CAD Y grows toward the rear. H13/H14 and the omitted Enter boss stay off the plate.
- The T1 core uses a 4.19-long integral Ø3 journal and a Ø6.05 × 6-deep drive bore. Select an encoder with at least 4.50 of usable shaft engagement for the proposed M3 screw position. The reference shaft enters 1.79. The radial screw goes in before fitting the silicone sleeve. Check sleeve retention, bearing seating, axial retention and return under end load.
- The reference bezel intersects the bearing and both supports. T1 adds raised end hoods to z +10.60, underside reliefs, and a wider lower window. Top window remains 46 × 17 at X −2.075 from bezel center. The central upper skin remains at z +8.00. R04 adds a provisional Ø6.04 × 3.21 bearing pocket and 0.50 running gap at the tread's left end. R05 is the foot for the future encoder adapter. The attachment geometry, shims and retention depend on the actual encoder.
- All seven STEP files reopened as one valid solid each. Dimensions and solid volume survived export and reimport. The plate volume also matched the sum of its analytic section areas. Boolean interference checks found zero solid overlap between the revised bezel and the tread, bearing, left carrier, right foot and nominal sensor envelope. Physical fit, loaded rotation, minimum wall capability, thread strength and keyboard-wide collision checks remain first-article work.
- The tray quote is a price for the existing STL. Ask the printer to review the 0.35 keeper, the 0.60 shelf, tray bow and the plate opening clearance before releasing the tray.
