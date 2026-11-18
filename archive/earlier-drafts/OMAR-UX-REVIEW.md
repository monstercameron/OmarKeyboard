# Omar Keyboard UX review

Historical draft. [Current revision](../../docs/design/validation.md).

The costs that matter most are typing into the wrong window, moving a tile by accident, and discovering a missing key in the middle of work. The design gives ordinary typing and window focus immediate recovery paths. The hold timing and reach dimensions remain hypotheses until someone uses a physical sample.

## Review decisions

| Concern | Decision | How to check it |
| --- | --- | --- |
| 1. Applications need F1–F12 | Hold Caps/Fn and use 1–0, minus, equals. Each position carries its F legend. | Rename with F2, reload with F5, use a debugger or terminal program with F10–F12. |
| 2. Alt and AltGr | Fn + left/right Super produce independent left/right Alt. Either can remain held when Fn is released. Both base Super keys remain immediately usable. | Try shell Alt+B/F/period, browser Alt+Left, Alt+Print, a third-level AltGr character and, with a configured backend, push-to-talk. |
| 3. Stock compatibility | Desks, movement, window cycling, clipboard, menu and app grid emit stock Omarchy input. Super + Tab keeps its workspace action. | Test on an unmodified v4.5.0 install before loading the optional bindings. |
| 4. Accidental Focus or Swap | Both work only while held. If both are down, Focus takes priority. A brief touch cannot redirect the next arrow. | Brush each key, then arrow through a line in an editor. Repeat with the backlight off and while holding Shift to select text. |
| 5. Stale transfer | The only destinations are the five labeled desks. The three-second timer and local lights clear together. Arrow cancels and passes through. Last Desk cancels and visits history. | Check just before and at expiry, Esc, repeated arm, replacement arm, ordinary digit, Last Desk, arrow and sleep/wake. The stock move-to-monitor command has separate follow behavior. |
| 6. Window cycling and reach | Next Window taps forward, Shift reverses, Fn recalls the previous distinct window on this desk. Its cap center is about 12 mm closer to the typing area. Right Super remains immediate. | With three windows, distinguish reverse cycling from returning to the editor used last. Compare thumb reach across hand sizes. Trial tap-for-Next/hold-for-Super only if reach still fails. |
| 7. Navigation cluster | Fn + arrows give Home/End and PgUp/PgDn. Fn + Delete gives Insert. Delete stays above Backspace. | Select to end of line with Shift + Fn + Right. Page through a terminal pager and toggle overwrite in a supporting editor. |
| 8. Pinky misses at the rails | Half-unit separation on each side. Menu and Focus have tactile bars. | Alternate Caps/Menu and Ctrl/Files without looking. Record wrong launches. Repeat around the arrow cluster. |
| 9. Dials | Volume press mutes speakers, Shift + Menu opens Apps. Brightness stays on the right dial. Fn + turn resizes a split and press selects Layout. | Test laptop panel and external DDC/CI display separately. Turn the right dial fast and count accidental Lock presses. |
| 10. Pins | 92 switch contacts fit 8 × 12. Three encoders and a light chain bring the total to 27 GPIO. | Cross-check the wiring and scan all positions and encoder directions before populating lights. |
| 11. Roller and pointer | Normal wheel follows desktop routing. Fn + roller pages in the focused app. The 57 mm dimension includes the whole module. | Park the pointer in pane A, keyboard-focus pane B and roll with and without Fn. Repeat across two monitors and try a supported bearing/axle mockup. |
| 12. Five desks and state lights | Five physical targets, stock ten-slot compatibility, optional five-desk navigation. Desk and microphone indicators accept only fresh host reports. | Change desk or microphone from another device, move between monitors, disconnect the host bridge and wake the board. Unknown state should clear within three seconds. |

## Before committing the plate

1. **Paper fit.** Use the [full-size template](../../docs/prototype/OMAR-KEYBOARD-PROTOTYPE.html). Check both 100 mm scale marks. Ask at least one newcomer and one experienced tiling user to find Next Window, send a browser to Desk 3, then continue working in the editor. Record first key, wrong transfers, hand lift and gaze shifts. Compare both Super positions.
2. **Firmware pilot.** Exercise a real QMK board with the [pilot instructions](OMAR-BUILD-PILOT.md). Check that Fn can be released before Alt, Ctrl/Shift remain independently usable and a held direction never sticks. Disconnect and reconnect after arming Send & Stay.
3. **Live Omarchy.** Repeat the review’s tests with three windows on one desk, a second monitor and a different window under the pointer. Exercise copy/paste in GUI and terminal, keyboard screenshot selection, mic changes and a supported DDC display. Cold-boot on wired USB. Exercise letters, punctuation, digits and required modifiers in the actual unlock flow, using a separate visible input check for F-keys.
4. **Roller sample.** Roll near the center and each end. Check for skipped detents, shaft deflection, bearing drag, cap contact and unintended arrow or Lock presses. Use the measured clearances to select the barrel and plate cutout.

## What has been verified

The browser checks cover the 92 switch positions, secondary F and navigation legends, real-modifier gestures in simulation, hold-only Focus/Swap, both transfer outcomes, cancellation, expiry, reverse cycling, last-window recall, split resizing, focused paging, mute, capture and Guide. The print drawing renders on two landscape sheets at a 19.05 mm key pitch. No physical reach time or error rate has been measured. Browser results establish the interaction rules. The acceptance tests above establish whether the finished hardware and OS deliver them.
