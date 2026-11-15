"""Fake soil probe for building the website without the hardware.

Speaks the same protocol as the ESP32: a WebSocket server that sends one JSON
reading every 200 ms. Python 3 standard library only.

    python3 device/web-client/mock_probe.py          # ws://localhost:8081/
    python3 device/web-client/mock_probe.py 9000     # another port

In the website use "localhost:8081" as the probe address.
"""
import base64
import hashlib
import json
import math
import random
import socket
import struct
import sys
import threading
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def handshake(conn):
    request = conn.recv(4096).decode(errors="ignore")
    key = next((line.split(":", 1)[1].strip() for line in request.split("\r\n")
                if line.lower().startswith("sec-websocket-key:")), None)
    if key is None:
        return False
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    conn.sendall((
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
    return True


def text_frame(text):
    data = text.encode()
    if len(data) < 126:
        return struct.pack("!BB", 0x81, len(data)) + data
    return struct.pack("!BBH", 0x81, 126, len(data)) + data


def reading(t):
    """Slowly drifting soil with sensor noise, like a probe sitting in a field."""
    return {
        "temp": round(18 + 2 * math.sin(t / 60) + random.gauss(0, 0.05), 2),
        "ph": round(6.8 + 0.3 * math.sin(t / 90) + random.gauss(0, 0.15), 2),
        "tds": max(0, int(420 + 60 * math.sin(t / 45) + random.gauss(0, 25))),
        "moist": max(0, min(100, int(38 + 8 * math.sin(t / 30) + random.gauss(0, 1)))),
        "fw": 2,
    }


def serve(conn, addr):
    try:
        if not handshake(conn):
            return
        print(f"client connected: {addr[0]}")
        conn.sendall(text_frame(json.dumps({"hello": "probe online"})))
        while True:
            conn.sendall(text_frame(json.dumps(reading(time.time()))))
            time.sleep(0.2)
    except OSError:
        pass
    finally:
        conn.close()


def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", PORT))
    server.listen()
    print(f"mock probe on ws://localhost:{PORT}/  (Ctrl+C to stop)")
    while True:
        conn, addr = server.accept()
        threading.Thread(target=serve, args=(conn, addr), daemon=True).start()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
