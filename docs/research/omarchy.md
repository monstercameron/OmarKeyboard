# Omarchy desktop and shortcut patterns

Omarchy is David Heinemeier Hansson’s opinionated Linux distribution built on Arch Linux, with Hyprland for window management and Quickshell for the desktop shell. It ships a curated set of terminal tools, desktop apps, and themes. The desktop opens with automatic tiling and supports scrolling and floating layouts per workspace. Each monitor has ten of its own workspaces. [Omarchy manual](https://omarchy.org/manual/) · [Navigation](https://omarchy.org/manual/navigation/) · [v4.5.0 release](https://github.com/omacom/omarchy/releases/tag/v4.5.0)

## Desktop surfaces

| Surface | What users see and do |
| --- | --- |
| **Work area** | Dwindle, the default, splits the screen as windows open and keeps the tiles visible. Scrolling arranges windows in a horizontal strip that can extend beyond the screen. Floating gives overlapping windows themed titlebars and a dock with pinned apps, running apps, and an app grid. The choice persists per workspace. |
| **Top bar** | The launcher and current monitor’s workspace indicators sit on the left. The center shows clock and status information. The right groups system controls such as network, audio, display, and power. The workspace layout marker uses a square for tiling, a circle for scrolling, and a triangle for floating. |
| **Omarchy menu and app grid** | The menu opens from the bar logo or `Super + Space`. Start typing to filter apps and actions. The menu also leads to settings, capture, installation, and updates. `Super + Alt + Space` opens the separate app grid for browsing installed apps. |
| **System panels and notifications** | Bar icons open compact panels with controls such as volume, Wi-Fi, and display scaling. Panels accept arrows, Enter, Tab, and Esc. Notifications group by sender, collapse identical repeats, and expose actions on the card. |

[Workspace layouts and dock](https://omarchy.org/manual/navigation/#dwindle-vs-scrolling-layout) · [Top bar and panels](https://omarchy.org/manual/the-top-bar/) · [Menu and app grid](https://omarchy.org/manual/coming-from-mac-or-windows/#super-is-the-center-of-everything) · [Notifications in 4.5](https://omarchy.org/news/2026/11/omarchy-4-5/#notifications-rebuilt)

## Tiling, focus and layout

Omarchy uses Hyprland for window management. In its default Dwindle layout, the workspace is a set of nested splits. An editor might occupy the left half, while a browser and a terminal share the right half vertically. Hyprland calculates the rectangles. The user decides which window gets keyboard input, which windows belong together, and how much room each needs. [Hyprland’s Dwindle layout](https://wiki.hypr.land/configuring/layouts/dwindle-layout/)

**Focus, placement, and layout are separate decisions.** Focus the terminal and your next command goes there. Swap it with the browser and the two exchange places. Toggle their split with `Super + J` and they can sit side by side so each gets more height for reading logs. The same windows support three different intentions without anyone dragging a corner. [Omarchy navigation](https://omarchy.org/manual/navigation/) · [Window bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/tiling.lua)

**Scope matters.** `Super + T` toggles floating for the focused window. `Super + L` cycles the current workspace through Dwindle, scrolling, and floating. That workspace remembers the choice. For example, you can tile an editor and terminal on workspace 1 and keep overlapping reference windows on workspace 2. [Workspace layouts](https://omarchy.org/manual/navigation/#dwindle-vs-scrolling-layout)

## Letters take their meaning from the modifiers

Omarchy calls the modifier combinations *planes*. With letters, **Super** usually controls the desktop, **Super + Shift** launches apps, **Super + Ctrl** opens panels and menus, and **Super + Ctrl + Alt** triggers actions or notices directly. On a typical PC keyboard, Super is the Windows-logo key. [Omarchy’s hotkey conventions](https://github.com/omacom/omarchy/blob/v4.5.0/manual/07-hotkeys.md#how-hotkeys-are-laid-out)

| Hold these modifiers and tap C | What happens |
| --- | --- |
| Super | Copy the selection. |
| Super + Shift | Open the calendar app. |
| Super + Ctrl | Open the capture menu so you can choose an operation. |
| Super + Ctrl + Alt | Start a screenshot directly. |

The letter can stand for *copy*, *calendar*, or *capture*. In the last two rows, adding Alt takes a particular route through the same task. Browser and email follow that pattern too. Add Alt to the browser chord for a private window, or to the email chord to start composing a message. [Clipboard bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/clipboard.lua) · [Application bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/applications.lua) · [Capture bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/utilities.lua)

## Numbers select a place and arrows select a direction

Imagine a browser on workspace 1. You want to put it on workspace 2 and keep writing in the editor on workspace 1. The digit gives you the destination. What you hold with it determines whether the window moves and whether you follow.

| Intention | Default chord | Result |
| --- | --- | --- |
| Look at workspace 2 | `Super + 2` | Your view switches to workspace 2. |
| Take the browser there | `Super + Shift + 2` | The focused browser moves to workspace 2 and your view follows. |
| Send the browser ahead | `Super + Shift + Alt + 2` | The focused browser moves to workspace 2 and your view stays on workspace 1. |

Each monitor has its own workspaces 1–10. The numbered bindings use the ten physical positions across the top number row, ending at the US `0` position for workspace 10. On a compact board, a number layer needs to let you hold Super, Shift, and Alt while you select the digit if you want all three behaviors. [Workspace navigation](https://omarchy.org/manual/navigation/) · [Physical key bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/tiling.lua)

Arrows extend the same idea across displays. `Super + Shift + Ctrl + Right` sends the active **window** to the monitor on the right. Replacing Ctrl with Alt sends the entire **workspace** there. Those chords differ by one modifier and act on very different amounts of work. They make a good test of whether Ctrl and Alt can be distinguished by touch. [Monitor bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/tiling.lua)

## Tab cycles through a set

With Tab, the question is *which things am I cycling through?* `Alt + Tab` cycles windows on the current workspace. `Super + Tab` cycles workspaces on the current monitor. `Ctrl + Alt + Tab` cycles monitors. Adding Shift reverses each cycle. Ctrl also gives you a way back to the *last visited* workspace. If you jump directly from workspace 2 to 7, `Super + Ctrl + Tab` takes you back to 2. [Tab bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/tiling.lua)

## A dedicated key can carry a whole family

Print Screen is a good example for a custom keyboard. Press it alone for a screenshot, hold Alt to record, hold Super to pick a color, or hold Super + Ctrl to extract text. A programmable key that sends **Print Screen** makes all four available. A key programmed to send the screenshot chord `Super + Ctrl + Alt + C` gives you the direct screenshot action. The choice matters even if both keycaps say “Capture.” [Shipped capture bindings](https://github.com/omacom/omarchy/blob/v4.5.0/default/hypr/bindings/utilities.lua)

## Visual language

Themes are system-wide. A theme can recolor the window treatment, shell, terminal, Neovim, and supported apps, along with the app icons when a theme-aware icon set is active. The Appearance menu also controls independent choices such as wallpaper, bar, dock, window corners, transparency, and animations. Theme intros can be disabled. This makes the desktop recognizable through its layout and controls across both dark and light palettes. [Themes and icon sets](https://omarchy.org/manual/themes/) · [Appearance changes in 4.5](https://omarchy.org/news/2026/11/omarchy-4-5/)

**Reference palette.** Tokyo Night defines background `#1A1B26`, foreground `#A9B1D6`, and accent `#7AA2F7`. These were references for early keycap studies. The revision 3 palette is recorded in the [hardware specification](../../hardware/specification.md). [Tokyo Night palette source](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/themes/tokyo-night/colors.toml) · [Tokyo Night preview](https://omarchy.org/manual/images/tokyo-night-preview.webp) · [Flexoki Light preview](https://omarchy.org/manual/images/flexoki-light-preview.webp)

**Official screenshots.** [Tiled workspace](https://omarchy.org/manual/images/navigation-dwindle-layout.webp) · [Scrolling workspace](https://omarchy.org/manual/images/navigation-scrolling-layout.webp) · [Themed notification cards](https://omarchy.org/news/2026/11/omarchy-4-5/omarchy-4-5-notifications.webp)

## How people learn and navigate

- **Discover an action, then learn the chord.** The menu supports recognition by name, while `Super + K` shows the main bindings on the machine. Recurring actions graduate to direct chords. The documented pattern groups window and workspace actions under Super, app launches under Super + Shift, and panels under Super + Ctrl. New users still need a prompt to find the menu or shortcut list. [Hotkey conventions](https://omarchy.org/manual/hotkeys/#how-hotkeys-are-laid-out) · [Coming from Mac or Windows](https://omarchy.org/manual/coming-from-mac-or-windows/)
- **Focus is part of the command.** `Super + Arrow` follows the spatial arrangement of windows and can cross to an adjacent monitor. `Super + 2` goes to workspace 2 on whichever monitor has focus. With two screens, a workspace number alone can be ambiguous. A fixed “Workspace 2” key would still inherit that behavior. [Navigation](https://omarchy.org/manual/navigation/)
- **The same shell can support pointer use.** Floating workspaces provide a dock and familiar window controls. Bar widgets also expose secondary actions on right-click, middle-click, or scroll. Those actions are less obvious from the icon alone, so a labeled keyboard route can help frequent users. [Floating workspaces](https://omarchy.org/manual/navigation/#floating-workspaces) · [Bar interactions](https://omarchy.org/manual/the-top-bar/#clicking-around)

## What carried into Omar

The arrow cluster gives a physical direction to Focus and Swap. The five Desk keys serve as both direct destinations and targets for a transfer. Menu and Guide provide two entry points for newcomers. The early thumb-held WM layer was explored during research. Revision 3 uses dedicated hold keys on the right rail and keeps both Super keys under the thumbs. These findings come from upstream documentation and examples. The [validation plan](../design/validation.md) describes the physical trials.

[Stock shortcut catalog](stock-shortcuts.md) · [Omar keymap](../design/keymap.md)
