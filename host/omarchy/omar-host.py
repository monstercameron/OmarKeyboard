"""Optional Omarchy session actions. Run only the requested action."""
import argparse
import json
import re
import subprocess
from pathlib import Path


def read_json(command):
    return json.loads(subprocess.check_output(command, text=True, timeout=2))


def previous_client(active, clients):
    workspace = active.get("workspace", {}).get("id")
    if workspace is None or not active.get("address"):
        return None
    eligible = [
        client for client in clients
        if client.get("workspace", {}).get("id") == workspace
        and client.get("mapped") and not client.get("hidden")
        and client.get("address") != active["address"]
        and re.fullmatch(r"0x[0-9a-fA-F]+", client.get("address", ""))
        and isinstance(client.get("focusHistoryID"), int)
        and client["focusHistoryID"] >= 0
    ]
    return min(eligible, key=lambda c: c["focusHistoryID"], default=None)


def previous_window():
    active = read_json(["hyprctl", "-j", "activewindow"])
    previous = previous_client(active, read_json(["hyprctl", "-j", "clients"]))
    if previous:
        # Abort if the user moved in the meantime.
        current = read_json(["hyprctl", "-j", "activewindow"])
        if (current.get("address"), current.get("workspace")) == (active.get("address"), active.get("workspace")):
            address = previous["address"]
            subprocess.run(["hyprctl", "dispatch", f'hl.dsp.focus({{ window = "address:{address}" }})'], check=True, timeout=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["guide", "previous-window"])
    args = parser.parse_args()
    if args.action == "guide":
        guide = Path(__file__).resolve().with_name("OMAR-KEYBOARD-PROTOTYPE.html")
        if not guide.is_file():
            parser.exit(1, f"Key guide missing at {guide}\n")
        subprocess.run(["xdg-open", guide.as_uri() + "#guide"], check=True)
    else:
        previous_window()
