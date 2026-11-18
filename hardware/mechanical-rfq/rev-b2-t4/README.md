# T4 closed keyboard assembly

Open the [complete STEP](Omar-Keyboard-full-T4.step) in SolidWorks or the [complete Blender model](Omar-Keyboard-full-T4.blend) to isolate the tray, keys, plate, roller and boards. The [electronics and plate STEP](Boards-plate-and-roller-T4.step) is a smaller import with original CAD faces for the two populated boards, T3 roller and encoder card. [One-piece tray for printing](T4-One-piece-tray.stl).

The assemblies use millimetres with the top of the plate at Z0. X follows the keyboard from left to right. Positive CAD Y points rearward. The specification’s field Y points toward the typist. The tray STL uses the original desk orientation for printing.

The full STEP contains 783 physical instances. The KiCad boards, installed components and T3 module use native CAD faces. The enclosure, switches, caps, spacers, harnesses and feet use faceted reference geometry. Cosmetic legends are visible in Blender. The socket, reverse LED and two dial encoders use simplified package geometry based on their dimensional drawings. Contact springs, thread forms, microscopic solder films and internal switch mechanisms are simplified.

[Static contact screen](assembly-contact-screen.csv) · [Key and dial shell travel screen](actuation-screen.csv) · [Clearance and service specification](../../assembly-design-specification.md) · [Closed view](T4-closed-assembly.png) · [USB carrier underside](T4-carrier-underside.png)

[Measured carrier distances, collar dimensions and verification counts](verification.json).

[All 405 component clearances to tray and plate](mainboard-clearances.csv) · [Vertical clearance below every socket and LED](underside-vertical-clearances.csv).

[Rear-pocket and H7 fastener coupon](T4-rear-pocket-and-deck-boss-coupon.stl) is a solid section of the T4 tray, in its desk printing orientation. It includes the USB opening, both webbed carrier posts and one deck boss. Use the intended tray material and process to qualify the Ø1.60 USB pilots and a retention method for the Ø2.24 H7 pilot. Use the actual R03/R04/R05 parts for the encoder and bearing fit trial. Record results on specification sheet 22A.

## High-detail print master

`Omar-Keyboard-full-T4-SolidCraft.stl` in this folder is the SolidCraft export that prints are made from. It has 25.0 million triangles in 1,694 bodies, including every keycap legend as raised geometry, in millimetres with Z up and the case floor at Z0. At 1.25 GB it is over GitHub’s 100 MB file limit, so `.gitignore` keeps it out of the repository. Keep the file here, at this name, beside the other T4 files.

The site shows a simplified, compressed copy with colors added from the keycap groups: [docs/assets/omar-print-model.glb](../../../docs/assets/omar-print-model.glb), 5.0 million triangles, 10.8 MB. After a new SolidCraft export, rebuild it with `python tools/build-print-model.py`. The script needs numpy, scipy and Node.js. [View it on the site](https://monstercameron.github.io/OmarKeyboard/#print)
