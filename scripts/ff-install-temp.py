#!/usr/bin/env python3
"""Install Tab Hoor as a temporary Firefox add-on via Remote Debugging Protocol.

Temporary add-ons die on browser exit — this script is meant to run on each
Firefox launch (see firefox-tabhoor-wrap.sh) so you never open about:debugging.
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import struct
import sys
import time
from pathlib import Path


def read_msg(sock: socket.socket) -> dict:
    raw_len = b""
    while b":" not in raw_len:
        chunk = sock.recv(1)
        if not chunk:
            raise ConnectionError("Firefox RDP closed")
        raw_len += chunk
    n = int(raw_len[:-1])
    data = b""
    while len(data) < n:
        chunk = sock.recv(n - len(data))
        if not chunk:
            raise ConnectionError("Firefox RDP closed mid-message")
        data += chunk
    return json.loads(data.decode("utf-8"))


def send_msg(sock: socket.socket, msg: dict) -> dict:
    payload = json.dumps(msg).encode("utf-8")
    sock.sendall(f"{len(payload)}:".encode("ascii") + payload)
    # read until we get a reply with matching from/to or just next message
    return read_msg(sock)


def install_temporary(host: str, port: int, addon_path: str, timeout: float = 15.0) -> None:
    path = str(Path(addon_path).resolve())
    if not Path(path).exists():
        raise FileNotFoundError(path)

    deadline = time.time() + timeout
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            sock = socket.create_connection((host, port), timeout=3)
            sock.settimeout(10)
            break
        except OSError as e:
            last_err = e
            time.sleep(0.3)
    else:
        raise ConnectionError(f"Cannot connect to Firefox RDP {host}:{port}: {last_err}")

    with sock:
        # greeting
        greeting = read_msg(sock)
        # request addons actor from root
        # Firefox RDP: listTabs or getRoot
        root = greeting.get("from") or "root"
        # Prefer modern addonManagement
        try:
            resp = send_msg(sock, {"to": "root", "type": "getRoot"})
        except Exception:
            resp = {}

        # Find addon actor
        addon_actor = None
        if isinstance(resp, dict):
            addon_actor = resp.get("addonsActor") or resp.get("addonRegistryActor")

        if not addon_actor:
            # older protocol: requestTypes / listAddons
            resp = send_msg(sock, {"to": "root", "type": "requestTypes"})
            # try listTabs path
            tabs = send_msg(sock, {"to": "root", "type": "listTabs"})
            addon_actor = tabs.get("addonsActor")

        if not addon_actor:
            # last resort: hard-coded process form used by web-ext
            raise RuntimeError(f"No addons actor in RDP greeting/root: {greeting} / {resp}")

        result = send_msg(
            sock,
            {
                "to": addon_actor,
                "type": "installTemporaryAddon",
                "addonPath": path,
                "openDevTools": False,
            },
        )
        if result.get("error"):
            raise RuntimeError(f"installTemporaryAddon failed: {result}")
        addon = result.get("addon") or result
        print(f"Installed temporary add-on: {addon.get('id', addon)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", required=True, help="Unpacked extension directory")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=6000)
    ap.add_argument("--timeout", type=float, default=20.0)
    args = ap.parse_args()
    try:
        install_temporary(args.host, args.port, args.path, args.timeout)
        return 0
    except Exception as e:
        print(f"ff-install-temp: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
