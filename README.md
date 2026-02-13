# Circus: Local Web UI for Octra

A local web interface for managing an Octra wallet without exposing a public web service.

## Overview

This project runs a local HTTP server and serves a browser-based wallet UI.

Key behavior:
- Binds to `127.0.0.1:8765` by default.
- Loads wallet configuration from:
  - `~/.octra/wallet.json`, or
  - local `wallet.json` (fallback).
- Uses the same RPC endpoint model as the CLI.
- Signs standard transactions locally (private key remains on your machine).

## Features

- Public balance and nonce
- Encrypted balance
- Pending private transfers
- Transaction history
- Standard transaction sending
- Encrypt / Decrypt balance operations
- Private transfers
- Claim pending private transfers

## Requirements

- Python 3.10+ (recommended)
- Dependencies from `requirements.txt`

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run (Windows, recommended)

```bat
run_webui.bat
```

Then open:

`http://127.0.0.1:8765`

## Run (manual)

```bash
python webui_server.py
```

## Environment Variables

- `OCTRA_WEBUI_HOST` (default: `127.0.0.1`)
- `OCTRA_WEBUI_PORT` (default: `8765`)

Example:

```bash
OCTRA_WEBUI_HOST=127.0.0.1 OCTRA_WEBUI_PORT=9000 python webui_server.py
```

## Security Notes

- This UI is intended for local use only.
- Never share `wallet.json` or your private key.
- Keep the server bound to `127.0.0.1` unless you fully understand the security implications.
- Your OS/user account security directly affects wallet safety.

## Troubleshooting

- `wallet is not configured`:
  - Create/configure wallet via the setup screen, or place a valid `wallet.json` in an expected location.
- `Python not found` when running `run_webui.bat`:
  - Install Python 3 and ensure it is available in `PATH` (or use a virtual environment).
- Connection/API errors:
  - Verify the RPC URL in wallet settings and confirm network reachability.
