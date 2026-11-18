# Early 99-key concept

Historical layout study. The [revision 3 keymap](../docs/design/keymap.md) documents the current design.

Start with a US ANSI tenkeyless QWERTY keyboard. Give common Omarchy actions their own switches, printed with the words someone would use to describe the task. Where an action needs a destination, put the two choices on the board. A person can read **Send**, then **2**, and move a window out of the way without leaving their current workspace.

## A 99-key first layout

Keep the 87 familiar keys, including F1–F12, the six navigation keys, the inverted-T arrows, Super, and a full-size spacebar. Add ten switches in a row above the function keys. Add two just below the navigation block, immediately above the arrows. The case gains one key row in depth and stays TKL width.

| Physical location | Keycap legends | What the hand does |
| --- | --- | --- |
| Left end of the new row, near the number row | **Desk · Send** | Tap Desk, then a top-row digit to visit that workspace. Tap Send, then a digit to move the focused window there and keep working here. Print a small **10** on the front of the 0 key. |
| Middle of the new row | **Menu · Terminal · Browser · Files** | Tap once to open the Omarchy menu, a terminal, the browser, or the file manager. Use the menu for less frequent commands. |
| Right end of the new row | **Split · Float · Full · Keys** | Tap to flip the current tile split, toggle the active window between tiled and floating, toggle fullscreen, or search the installed shortcut list. Engrave a split-pane symbol beside Split to suggest orientation. |
| In the gap between Home/End and the arrows | **Focus · Swap** | Tap Focus, then an arrow to choose the window that gets your typing. Tap Swap, then an arrow to exchange the focused tile with its neighbor. Both actions use the familiar physical arrows. |

**Desk, Send, Focus, and Swap each apply to one destination.** Engrave **1–0** beneath Desk and Send and four small arrows beneath Focus and Swap. Tap and release the action key. Its light and the valid destination keys illuminate. The next valid tap runs the action and immediately restores ordinary typing. Esc cancels. An unrelated typing key cancels and passes through normally. The lights show which choice is pending and clear when the keyboard sends the command.

## A minute at the keyboard

You have an editor on the left and a browser on the right on workspace 1. With the editor focused, tap **Focus**, then **→**. Your typing now goes to the browser. Tap **Send**, then **2**. The browser goes to workspace 2 and you stay at the editor. Tap **Desk**, then **2** when you want the browser back in view. The next arrow scrolls or moves the cursor as it normally would. **Keys** opens Omarchy’s shortcut finder for the occasional action that does not have a dedicated switch.

## What the firmware sends

This is a proposed QMK keymap targeting stock Omarchy 4.5.0. The dedicated keys work by sending Omarchy’s existing bindings. A machine with personalized bindings may need corresponding edits to the keymap.

| Printed action | Stock binding emitted by the keyboard |
| --- | --- |
| Menu / Terminal / Browser / Files | Super + Space / Super + Enter / Super + Shift + B / Super + Shift + F |
| Split / Float / Full / Keys | Super + J / Super + T / Super + F / Super + K |
| Focus, then arrow / Swap, then arrow | Super + Arrow / Super + Shift + Arrow |
| Desk, then digit / Send, then digit | Super + physical digit / Super + Shift + Alt + physical digit |

Bindings are documented in the tagged [tiling defaults](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/tiling.lua), [application defaults](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/applications.lua), and [utility defaults](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/utilities.lua).

## Two variations worth putting beside it

- **Standard case depth.** Put the same ten top-row actions on F1–F10 as primary legends, with Fn providing the F-keys. Put Focus and Swap in the gap above the arrows. This saves a full row of case depth, at the cost of an extra press for function keys in editors and debuggers.
- **One-touch workspaces.** Give the extra row ten numbered workspace keys. A single tap jumps directly to a workspace. Place Send next to this row so a user can tap Send and a dedicated workspace key to move a window. Keep Focus and Swap above the arrows. App and layout actions would need another home, such as the Omarchy menu. This version favors someone who changes desks more often than they launch apps.

The first paper test is to hand the board to someone who has never used Omarchy. Ask them to open a terminal, focus the browser on its right, and send that browser to desk 2 while staying at the terminal. Watch whether they can distinguish **Focus** from **Swap**, **Desk** from **Send**, and find the next key without an explanation.
