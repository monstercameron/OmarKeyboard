# Stock Omarchy shortcuts

Reference for the v4.5.0 defaults used by the Omar pilot. [How the desktop works](omarchy.md) explains the patterns. The [Omar keymap](../design/keymap.md) lists the corresponding physical controls.

## Menus, apps, and agents

| Keys | Action |
| --- | --- |
| `Super + Space` | Open the main Omarchy menu |
| `Super + K` | Search the active desktop shortcuts |
| `Super + Alt + Space` | Open the app grid |
| `Super + Esc` | Open power and session options |
| `Super + Enter` | Open the terminal |
| `Super + Shift + Enter` or `Super + Shift + B` | Open the browser |
| `Super + Shift + Alt + B` | Open a private browser window |
| `Super + Shift + F` | Open the file manager |
| `Super + Shift + Alt + F` | Open the file manager at the terminal’s working directory |
| `Super + Shift + N` | Open the configured editor |
| `Super + Shift + T` | Show system activity in btop |
| `Super + Shift + Q` | Open the calculator |
| `Super + Shift + E` / `Super + Shift + Alt + E` | Open email / compose a new message |
| `Super + Shift + A` / `Super + Shift + Alt + A` | Open ChatGPT / Grok |
| `Super + Shift + Ctrl + A` | Choose an AI agent |
| `Super + Grave` | Show or hide the drop-down console |
| `Super + Shift + Grave` | Send the active window to the drop-down console |
| `Super + Alt + Enter` / `Super + Ctrl + Enter` | Open tmux / Herdr |
| `Super + Alt + K` / `Super + Ctrl + K` | Show tmux / Herdr shortcuts |

`Grave` is the backtick key, typically below Esc on a US layout. The release’s app bindings also include shortcuts for music, messaging, and web apps. Some require the preinstalled app bindings to be enabled. [Application bindings](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/applications.lua) · [Utility bindings](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/utilities.lua)

## Windows, workspaces, and monitors

| Keys | Action |
| --- | --- |
| `Super + Arrow` | Focus a window in that direction, crossing to another monitor at the edge |
| `Super + Shift + Arrow` | Swap the active window in that direction |
| `Super + Shift + Ctrl + Arrow` | Send the active window to the monitor in that direction |
| `Super + Shift + Alt + Arrow` | Move the whole workspace to the monitor in that direction |
| `Super + 1…0` | Go to workspace 1 through 10 on the focused monitor |
| `Super + Shift + 1…0` | Move the window to that workspace and follow it |
| `Super + Shift + Alt + 1…0` | Move the window to that workspace and stay here |
| `Super + Tab` / `Super + Shift + Tab` | Go to the next / previous workspace on this monitor |
| `Super + Ctrl + Tab` | Return to the last workspace on this monitor |
| `Alt + Tab` / `Alt + Shift + Tab` | Cycle forward / backward through windows on this workspace |
| `Ctrl + Alt + Tab` / `Ctrl + Alt + Shift + Tab` | Cycle focus forward / backward through monitors |
| `Super + W` or `Super + Q` | Close the active window |
| `Ctrl + Alt + Delete` | Close all windows |
| `Super + J` | Switch the active split between horizontal and vertical |
| `Super + T` | Switch the active window between tiled and floating |
| `Super + L` / `Super + Alt + L` | Cycle workspace layouts forward / backward |
| `Super + F` / `Super + Alt + F` / `Super + Ctrl + F` | Full screen / full width / full screen within the tile |
| `Super + M` | Minimize the active window to the dock |
| `Super + S` / `Super + Alt + S` | Show or hide the scratchpad / send the active window there |
| `Super + G` / `Super + Alt + G` | Toggle window grouping / take the active window out of its group |
| `Super + Alt + Tab` / `Super + Alt + Shift + Tab` | Cycle forward / backward within a window group |
| `Super + -` / `Super + =` | Expand left / shrink left |
| `Super + Shift + -` / `Super + Shift + =` | Shrink up / expand down |

`1…0` refers to the physical top-row positions in US order. The last position selects workspace 10. Resize also uses physical positions immediately to the right of `0`, labeled `-` and `=` on US boards. [Window and workspace bindings](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/tiling.lua) · [Navigation manual](https://omarchy.org/manual/navigation/)

## Clipboard, capture, and dictation

| Keys | Action |
| --- | --- |
| `Super + A` / `Super + C` / `Super + V` | Select all / copy / paste |
| `Super + X` | Send the app’s cut shortcut. In a terminal, the shell may handle it differently |
| `Super + Ctrl + V` | Open clipboard history |
| `Print Screen` or `Super + Ctrl + Alt + C` | Start a screenshot capture |
| `Super + Ctrl + C` | Open capture options |
| `Alt + Print Screen` | Start or stop screen recording |
| `Super + Print Screen` | Open the color picker |
| `Super + Ctrl + Print Screen` | Capture text from the screen to the clipboard |
| `Alt + Space` / hold `Right Alt` | Toggle dictation / dictate while held when configured |

Omarchy sends `Ctrl + Shift + C/V` for copy and paste in recognized terminals. [Clipboard implementation](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/clipboard.lua) · [Capture and dictation manual](https://omarchy.org/manual/hotkeys/#capture)

## Panels, notifications, and media

| Keys | Action |
| --- | --- |
| `Super + Ctrl + A` / `B` / `N` | Open the audio / Bluetooth / network panel |
| `Super + Ctrl + D` / `P` / `E` | Open the display panel / power panel / emoji picker |
| `Super + Ctrl + Alt + D` / `E` | Open the calendar / world clock panel |
| `Super + Ctrl + L` | Lock the session |
| `Super + Ctrl + T` / `W` | Choose a desktop theme / background |
| `Super + Shift + Space` | Show or hide the top bar |
| `Super + ,` | Act on the latest notification |
| `Super + Ctrl + ,` / `Super + Shift + Alt + ,` | Navigate notifications with keys / open notification history |
| `Super + Alt + ,` / `Super + Shift + ,` | Dismiss the latest notification / dismiss all notifications |
| `Super + Ctrl + Alt + ,` | Toggle notification silencing |
| `Super + Ctrl + Alt + T` / `B` / `W` | Show time / show battery level / toggle the weather notice |
| `Alt + Volume Up/Down` / `Alt + Brightness Up/Down` | Adjust volume / display brightness by 1% |
| `Alt + Play` / `Alt + Shift + Play` | Skip to the next / previous track |
| `Shift + Mute` / `Shift + Play` | Cycle audio outputs / media sources |

When a row lists several letters after one modifier group, hold the same modifiers for each letter. [Utility bindings](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/utilities.lua) · [Media bindings](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/default/hypr/bindings/media.lua)

## Check the target installation

These are v4.5.0 defaults. To confirm your machine’s bindings, open `Super + K` or run `omarchy menu keybindings --print`. Omarchy 4.x keeps personal overrides in `~/.config/hypr/bindings.lua`. For 3.x, see the legacy manual and its `~/.config/hypr/bindings.conf` path. [v4.5.0 configuration template](https://raw.githubusercontent.com/omacom/omarchy/v4.5.0/config/hypr/bindings.lua) · [Omarchy 3 manual](https://learn.omacom.io/2/the-omarchy-manual)
