"""Run in the Omarchy user session with the actual keyboard VID and PID."""
import argparse
import contextlib
import json
import os
import selectors
import socket
import subprocess
import time
from pathlib import Path


def read(command):
    try:
        return subprocess.check_output(command, text=True, stderr=subprocess.DEVNULL, timeout=0.6).strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def packet(slot, volume):
    desk = int(slot) if slot in {"1", "2", "3", "4", "5"} else 0
    known = volume.startswith("Volume:")
    flags = (1 if desk else 0) | (2 if known else 0) | (4 if known and "[MUTED]" in volume else 0)
    return bytes([0, 0x4f, 1, flags, desk]) + bytes(28)  # report ID then 32 data bytes


def desk_slot(workspace_json):
    """Omarchy uses 10 slots per monitor block; return 1-10, or 0 if unknown."""
    try:
        number = json.loads(workspace_json).get("id")
    except (ValueError, AttributeError):
        return 0
    if isinstance(number, int) and not isinstance(number, bool) and number > 0:
        return (number - 1) % 10 + 1
    return 0


def should_query(now, last_query, event):
    """Re-query hyprctl and wpctl on a relevant event or after 5 s."""
    return event or now - last_query >= 5


def snapshot():
    slot = desk_slot(read(["hyprctl", "-j", "activeworkspace"]))
    return packet(str(slot), read(["wpctl", "get-volume", "@DEFAULT_AUDIO_SOURCE@"]))


def open_device(hid, vid, pid, serial):
    matches = [i for i in hid.enumerate(vid, pid)
               if i.get("usage_page") == 0xff60 and i.get("usage") == 0x61
               and (serial is None or i.get("serial_number") == serial)]
    if len(matches) != 1:
        raise OSError("Expected one matching Omar raw HID interface. Check IDs, serial and hidraw access.")
    device = hid.device()
    device.open_path(matches[0]["path"])
    return device


@contextlib.contextmanager
def notifications():
    # Periodic snapshots keep the bridge usable if a subscription ends.
    with contextlib.ExitStack() as cleanup:
        selector = cleanup.enter_context(selectors.DefaultSelector())
        try:
            path = Path(os.environ["XDG_RUNTIME_DIR"], "hypr", os.environ["HYPRLAND_INSTANCE_SIGNATURE"], ".socket2.sock")
            sock = cleanup.enter_context(socket.socket(socket.AF_UNIX))
            sock.connect(str(path))
            selector.register(sock, selectors.EVENT_READ, "desktop")
        except (KeyError, OSError):
            pass
        try:
            audio = subprocess.Popen(["pactl", "subscribe"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            cleanup.callback(audio.wait)
            cleanup.callback(audio.terminate)
            cleanup.callback(audio.stdout.close)
            selector.register(audio.stdout, selectors.EVENT_READ, "audio")
        except OSError:
            pass
        yield selector


def wait_for_change(selector):
    """Wait up to 1 s (the heartbeat period); return True if a relevant event arrived."""
    deadline = time.monotonic() + 1
    while (remaining := deadline - time.monotonic()) > 0:
        for key, _ in selector.select(timeout=remaining):
            event = os.read(key.fd, 65536)
            if not event:
                selector.unregister(key.fileobj)
            elif key.data == "audio" and (b"source" in event or b"server" in event):
                return True
            elif key.data == "desktop" and any(name in event for name in (b"workspace", b"focusedmon", b"monitor", b"activespecial")):
                return True
    return False


def serve(hid, args):
    last_error = ""
    while True:
        try:
            with contextlib.closing(open_device(hid, args.vid, args.pid, args.serial)) as device, notifications() as selector:
                last_error = ""
                report, last_query, event = None, 0, True
                while True:
                    now = time.monotonic()
                    if report is None or should_query(now, last_query, event):
                        report, last_query = snapshot(), now
                    if device.write(report) != 33:  # resent every second as a heartbeat
                        raise OSError("Short HID write")
                    event = wait_for_change(selector)
                    if event:
                        time.sleep(0.10)  # batch workspace and audio event bursts
        except OSError as exc:
            if str(exc) != last_error:
                print(exc, flush=True)
                last_error = str(exc)
            time.sleep(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vid", required=True, type=lambda s: int(s, 0))
    parser.add_argument("--pid", required=True, type=lambda s: int(s, 0))
    parser.add_argument("--serial")
    args = parser.parse_args()
    if not all(0 < n <= 0xffff for n in [args.vid, args.pid]):
        parser.error("Use the nonzero VID and PID assigned to your device.")
    import hid  # Python package hidapi, Linux hidraw backend
    try:
        serve(hid, args)
    except KeyboardInterrupt:
        pass
