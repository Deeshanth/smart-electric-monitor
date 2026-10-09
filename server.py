"""
Python Standalone Backend API & Static HTTP Server for Smart Energy Monitor
Runs out-of-the-box with Python standard library. No pip install required!
"""

import http.server
import socketserver
import json
import os
import sys
from datetime import datetime

PORT = 5000
PARENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Latest Meter State
latest_meter_reading = {
    "voltage": 5.02,
    "current": 0.42,
    "power": 2.11,
    "energy": 0.0042,
    "tamper": False,
    "meter_id": "TN-MTR-001",
    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}


class SmartEnergyAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PARENT_DIR, **kwargs)

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/meter-data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(latest_meter_reading).encode("utf-8"))
        else:
            super().do_GET()

    def do_POST(self):
        global latest_meter_reading

        if self.path == "/api/meter-data":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            
            try:
                data = json.loads(body_bytes.decode("utf-8"))
                latest_meter_reading["voltage"] = float(data.get("voltage", 5.02))
                latest_meter_reading["current"] = float(data.get("current", 0.42))
                latest_meter_reading["power"] = float(data.get("power", 2.11))
                latest_meter_reading["energy"] = float(data.get("energy", 0.0042))
                latest_meter_reading["tamper"] = bool(data.get("tamper", False))
                latest_meter_reading["meter_id"] = data.get("meter_id", "TN-MTR-001")
                latest_meter_reading["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                print(f"[ESP32 POST Received] V: {latest_meter_reading['voltage']}V | I: {latest_meter_reading['current']}A | P: {latest_meter_reading['power']}W | Tamper: {latest_meter_reading['tamper']}")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                response_data = {
                    "success": True,
                    "message": "Meter data received successfully",
                    "timestamp": latest_meter_reading["timestamp"]
                }
                self.wfile.write(json.dumps(response_data).encode("utf-8"))

            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def run_server(port=5000):
    server_address = ("", port)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(server_address, SmartEnergyAPIHandler)
    local_ip = get_local_ip()
    print("===========================================================")
    print(f"[*] Smart Energy Monitor Python Backend Server running on port {port}")
    print(f"[*] Dashboard Local Link:   http://localhost:{port}")
    print(f"[*] Dashboard Network Link: http://{local_ip}:{port}")
    print(f"[*] ESP32 API Endpoint:     POST http://{local_ip}:{port}/api/meter-data")
    print("===========================================================")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    run_server(port)
