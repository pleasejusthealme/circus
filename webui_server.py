#!/usr/bin/env python3
import asyncio
import base64
import hashlib
import json
import os
import re
import ssl
import traceback
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import aiohttp
import nacl.signing
from aiohttp import web
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import secrets


MICRO = 1_000_000
ADDRESS_RE = re.compile(r"^oct[1-9A-HJ-NP-Za-km-z]{44}$")


def derive_encryption_key(privkey_b64: str) -> bytes:
    privkey_bytes = base64.b64decode(privkey_b64)
    salt = b"octra_encrypted_balance_v2"
    return hashlib.sha256(salt + privkey_bytes).digest()[:32]


def encrypt_client_balance(balance_raw: int, privkey_b64: str) -> str:
    key = derive_encryption_key(privkey_b64)
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)
    plaintext = str(balance_raw).encode()
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return "v2|" + base64.b64encode(nonce + ciphertext).decode()


class OctraBridge:
    def __init__(self) -> None:
        self.priv: Optional[str] = None
        self.addr: Optional[str] = None
        self.rpc: Optional[str] = None
        self.sk: Optional[nacl.signing.SigningKey] = None
        self.pub: Optional[str] = None
        self.session: Optional[aiohttp.ClientSession] = None

    def load_wallet(self) -> None:
        wallet_path = Path.home() / ".octra" / "wallet.json"
        if not wallet_path.exists():
            wallet_path = Path("wallet.json")

        with wallet_path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        self.apply_wallet_data(data)

    def apply_wallet_data(self, data: Dict[str, Any]) -> None:
        priv = data.get("priv")
        addr = data.get("addr")
        rpc = data.get("rpc", "https://octra.network/")

        if not priv or not addr:
            raise RuntimeError("wallet.json missing priv/addr")

        try:
            self.sk = nacl.signing.SigningKey(base64.b64decode(priv))
        except Exception as exc:
            raise RuntimeError("invalid private key format") from exc

        self.pub = base64.b64encode(self.sk.verify_key.encode()).decode()
        self.priv = priv
        self.addr = addr
        self.rpc = rpc.rstrip("/")

    def is_ready(self) -> bool:
        return bool(self.priv and self.addr and self.rpc and self.sk and self.pub)

    async def start(self) -> None:
        if not self.session:
            ssl_context = ssl.create_default_context()
            connector = aiohttp.TCPConnector(ssl=ssl_context, force_close=True)
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=12),
                connector=connector,
                json_serialize=json.dumps,
            )

    async def close(self) -> None:
        if self.session:
            await self.session.close()
            self.session = None

    async def req(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        private: bool = False,
    ) -> Tuple[int, str, Optional[Dict[str, Any]]]:
        if not self.session:
            raise RuntimeError("HTTP session not started")
        if not self.rpc:
            raise RuntimeError("RPC not configured")

        url = f"{self.rpc}{path}"
        kwargs: Dict[str, Any] = {}
        if method.upper() == "POST" and data is not None:
            kwargs["json"] = data
        if private and self.priv:
            kwargs["headers"] = {"X-Private-Key": self.priv}

        try:
            async with getattr(self.session, method.lower())(url, **kwargs) as resp:
                text = await resp.text()
                try:
                    payload = json.loads(text) if text.strip() else None
                except Exception:
                    payload = None
                return resp.status, text, payload
        except asyncio.TimeoutError:
            return 0, "timeout", None
        except Exception as exc:
            return 0, str(exc), None

    async def get_balance_nonce(self) -> Dict[str, Any]:
        assert self.addr
        status, text, payload = await self.req("GET", f"/balance/{self.addr}")
        if status == 200 and payload:
            return {
                "ok": True,
                "balance": float(payload.get("balance", 0)),
                "nonce": int(payload.get("nonce", 0)),
            }
        if status == 404:
            return {"ok": True, "balance": 0.0, "nonce": 0}
        return {"ok": False, "error": payload.get("error", text) if payload else text}

    async def get_encrypted_balance(self) -> Dict[str, Any]:
        assert self.addr
        status, text, payload = await self.req(
            "GET",
            f"/view_encrypted_balance/{self.addr}",
            private=True,
        )
        if status != 200 or not payload:
            return {"ok": False, "error": payload.get("error", text) if payload else text}

        try:
            return {
                "ok": True,
                "public": float(payload.get("public_balance", "0").split()[0]),
                "public_raw": int(payload.get("public_balance_raw", "0")),
                "encrypted": float(payload.get("encrypted_balance", "0").split()[0]),
                "encrypted_raw": int(payload.get("encrypted_balance_raw", "0")),
                "total": float(payload.get("total_balance", "0").split()[0]),
            }
        except Exception:
            return {"ok": False, "error": "invalid encrypted balance payload"}

    async def get_pending_private_transfers(self) -> Dict[str, Any]:
        assert self.addr
        status, text, payload = await self.req(
            "GET",
            f"/pending_private_transfers?address={self.addr}",
            private=True,
        )
        if status == 200 and payload:
            return {
                "ok": True,
                "pending_transfers": payload.get("pending_transfers", []),
            }
        return {"ok": False, "error": payload.get("error", text) if payload else text}

    async def get_history(self, limit: int = 20) -> Dict[str, Any]:
        assert self.addr
        status, text, payload = await self.req("GET", f"/address/{self.addr}?limit={limit}")
        if status != 200 or not payload:
            return {"ok": False, "error": payload.get("error", text) if payload else text}

        refs = payload.get("recent_transactions", [])
        result = []
        for ref in refs:
            tx_hash = ref.get("hash")
            if not tx_hash:
                continue
            s2, t2, p2 = await self.req("GET", f"/tx/{tx_hash}")
            if s2 != 200 or not p2:
                continue
            parsed = p2.get("parsed_tx")
            if not parsed:
                continue
            amount_raw = parsed.get("amount_raw", parsed.get("amount", "0"))
            amount = float(amount_raw) if "." in str(amount_raw) else int(amount_raw) / MICRO
            result.append(
                {
                    "hash": tx_hash,
                    "type": "in" if parsed.get("to") == self.addr else "out",
                    "from": parsed.get("from"),
                    "to": parsed.get("to"),
                    "amount": amount,
                    "nonce": parsed.get("nonce", 0),
                    "timestamp": parsed.get("timestamp", 0),
                    "epoch": ref.get("epoch", 0),
                }
            )
        return {"ok": True, "items": result}

    def build_signed_tx(self, to_addr: str, amount: float, nonce: int, message: Optional[str]) -> Dict[str, Any]:
        assert self.addr and self.sk and self.pub
        tx: Dict[str, Any] = {
            "from": self.addr,
            "to_": to_addr,
            "amount": str(int(amount * MICRO)),
            "nonce": int(nonce),
            "ou": "1" if amount < 1000 else "3",
            "timestamp": __import__("time").time(),
        }
        if message:
            tx["message"] = message

        base_payload = json.dumps({k: v for k, v in tx.items() if k != "message"}, separators=(",", ":"))
        signature = base64.b64encode(self.sk.sign(base_payload.encode()).signature).decode()
        tx.update(signature=signature, public_key=self.pub)
        return tx


bridge = OctraBridge()


def json_error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"ok": False, "error": message}, status=status)


async def handle_index(_: web.Request) -> web.Response:
    index_path = Path(__file__).with_name("webui") / "index.html"
    return web.FileResponse(index_path)


async def handle_wallet(_: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)
    return web.json_response(
        {
            "ok": True,
            "address": bridge.addr,
            "public_key": bridge.pub,
            "rpc": bridge.rpc,
        }
    )


async def handle_state(_: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    balance_data, encrypted_data, pending_data, history_data = await asyncio.gather(
        bridge.get_balance_nonce(),
        bridge.get_encrypted_balance(),
        bridge.get_pending_private_transfers(),
        bridge.get_history(),
    )

    return web.json_response(
        {
            "ok": True,
            "balance": balance_data,
            "encrypted": encrypted_data,
            "pending_private": pending_data,
            "history": history_data,
        }
    )


async def handle_send(request: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    payload = await request.json()
    to_addr = (payload.get("to") or "").strip()
    amount = payload.get("amount")
    message = (payload.get("message") or "").strip() or None

    if not ADDRESS_RE.match(to_addr):
        return json_error("invalid recipient address")
    try:
        amount = float(amount)
    except Exception:
        return json_error("amount must be a number")
    if amount <= 0:
        return json_error("amount must be > 0")
    if message and len(message) > 1024:
        message = message[:1024]

    bn = await bridge.get_balance_nonce()
    if not bn.get("ok"):
        return json_error(f"failed to get nonce/balance: {bn.get('error', 'unknown')}", 502)
    balance = float(bn.get("balance", 0))
    nonce = int(bn.get("nonce", 0)) + 1
    if balance < amount:
        return json_error(f"insufficient balance ({balance:.6f} < {amount:.6f})")

    tx = bridge.build_signed_tx(to_addr, amount, nonce, message)
    status, text, data = await bridge.req("POST", "/send-tx", tx)
    if status == 200:
        tx_hash = ""
        accepted = False
        if data and data.get("status") == "accepted":
            tx_hash = data.get("tx_hash", "")
            accepted = True
        elif text.lower().startswith("ok"):
            tx_hash = text.split()[-1]
            accepted = True
        if accepted:
            return web.json_response({"ok": True, "tx_hash": tx_hash, "rpc_response": data})

    return json_error(data.get("error", text) if data else text, 502)


async def handle_encrypt(request: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    payload = await request.json()
    amount = payload.get("amount")
    try:
        amount = float(amount)
    except Exception:
        return json_error("amount must be a number")
    if amount <= 0:
        return json_error("amount must be > 0")

    enc_data = await bridge.get_encrypted_balance()
    if not enc_data.get("ok"):
        return json_error(enc_data.get("error", "cannot get encrypted balance"), 502)

    current_encrypted_raw = int(enc_data.get("encrypted_raw", 0))
    new_encrypted_raw = current_encrypted_raw + int(amount * MICRO)
    encrypted_value = encrypt_client_balance(new_encrypted_raw, bridge.priv or "")

    body = {
        "address": bridge.addr,
        "amount": str(int(amount * MICRO)),
        "private_key": bridge.priv,
        "encrypted_data": encrypted_value,
    }
    status, text, data = await bridge.req("POST", "/encrypt_balance", body)
    if status == 200:
        return web.json_response({"ok": True, "rpc_response": data})
    return json_error(data.get("error", text) if data else text, 502)


async def handle_decrypt(request: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    payload = await request.json()
    amount = payload.get("amount")
    try:
        amount = float(amount)
    except Exception:
        return json_error("amount must be a number")
    if amount <= 0:
        return json_error("amount must be > 0")

    enc_data = await bridge.get_encrypted_balance()
    if not enc_data.get("ok"):
        return json_error(enc_data.get("error", "cannot get encrypted balance"), 502)

    current_encrypted_raw = int(enc_data.get("encrypted_raw", 0))
    required_raw = int(amount * MICRO)
    if current_encrypted_raw < required_raw:
        return json_error("insufficient encrypted balance")

    new_encrypted_raw = current_encrypted_raw - required_raw
    encrypted_value = encrypt_client_balance(new_encrypted_raw, bridge.priv or "")
    body = {
        "address": bridge.addr,
        "amount": str(required_raw),
        "private_key": bridge.priv,
        "encrypted_data": encrypted_value,
    }
    status, text, data = await bridge.req("POST", "/decrypt_balance", body)
    if status == 200:
        return web.json_response({"ok": True, "rpc_response": data})
    return json_error(data.get("error", text) if data else text, 502)


async def handle_private_transfer(request: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    payload = await request.json()
    to_addr = (payload.get("to") or "").strip()
    amount = payload.get("amount")
    if not ADDRESS_RE.match(to_addr):
        return json_error("invalid recipient address")
    try:
        amount = float(amount)
    except Exception:
        return json_error("amount must be a number")
    if amount <= 0:
        return json_error("amount must be > 0")

    status_info, text_info, address_info = await bridge.req("GET", f"/address/{to_addr}")
    if status_info != 200 or not address_info or not address_info.get("has_public_key"):
        return json_error("recipient has no public key yet", 400)

    status_key, text_key, key_payload = await bridge.req("GET", f"/public_key/{to_addr}")
    if status_key != 200 or not key_payload:
        return json_error(key_payload.get("error", text_key) if key_payload else text_key, 502)

    to_public_key = key_payload.get("public_key")
    body = {
        "from": bridge.addr,
        "to": to_addr,
        "amount": str(int(amount * MICRO)),
        "from_private_key": bridge.priv,
        "to_public_key": to_public_key,
    }
    status, text, data = await bridge.req("POST", "/private_transfer", body)
    if status == 200:
        return web.json_response({"ok": True, "rpc_response": data})
    return json_error(data.get("error", text) if data else text, 502)


async def handle_claim(request: web.Request) -> web.Response:
    if not bridge.is_ready():
        return json_error("wallet is not configured", 409)

    payload = await request.json()
    transfer_id = (payload.get("transfer_id") or "").strip()
    if not transfer_id:
        return json_error("transfer_id is required")

    body = {
        "recipient_address": bridge.addr,
        "private_key": bridge.priv,
        "transfer_id": transfer_id,
    }
    status, text, data = await bridge.req("POST", "/claim_private_transfer", body)
    if status == 200:
        return web.json_response({"ok": True, "rpc_response": data})
    return json_error(data.get("error", text) if data else text, 502)


@web.middleware
async def error_middleware(request: web.Request, handler):
    try:
        return await handler(request)
    except web.HTTPException as exc:
        return exc
    except json.JSONDecodeError:
        return json_error("invalid JSON payload")
    except Exception:
        traceback.print_exc()
        return json_error("internal server error", 500)


async def on_startup(_: web.Application) -> None:
    try:
        bridge.load_wallet()
        await bridge.start()
    except FileNotFoundError:
        pass


async def handle_setup_status(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "configured": bridge.is_ready()})


async def handle_setup_wallet(request: web.Request) -> web.Response:
    payload = await request.json()
    priv = (payload.get("priv") or "").strip()
    addr = (payload.get("addr") or "").strip()
    rpc = (payload.get("rpc") or "https://octra.network/").strip()

    if not priv:
        return json_error("private token is required")
    if not ADDRESS_RE.match(addr):
        return json_error("invalid address")
    if not (rpc.startswith("http://") or rpc.startswith("https://")):
        return json_error("rpc must start with http:// or https://")

    wallet_data = {"priv": priv, "addr": addr, "rpc": rpc}
    try:
        bridge.apply_wallet_data(wallet_data)
    except Exception as exc:
        return json_error(str(exc) or "invalid wallet data")

    with Path("wallet.json").open("w", encoding="utf-8") as file:
        json.dump(wallet_data, file, ensure_ascii=False, indent=2)

    if bridge.session:
        await bridge.close()
    await bridge.start()

    return web.json_response({"ok": True, "configured": True})


async def on_cleanup(_: web.Application) -> None:
    await bridge.close()


def create_app() -> web.Application:
    app = web.Application(middlewares=[error_middleware])
    webui_dir = Path(__file__).with_name("webui")
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    app.router.add_get("/", handle_index)
    app.router.add_static("/static/", str(webui_dir), show_index=False)

    app.router.add_get("/api/setup-status", handle_setup_status)
    app.router.add_post("/api/setup-wallet", handle_setup_wallet)

    app.router.add_get("/api/wallet", handle_wallet)
    app.router.add_get("/api/state", handle_state)
    app.router.add_post("/api/send", handle_send)
    app.router.add_post("/api/encrypt", handle_encrypt)
    app.router.add_post("/api/decrypt", handle_decrypt)
    app.router.add_post("/api/private-transfer", handle_private_transfer)
    app.router.add_post("/api/claim", handle_claim)

    return app


if __name__ == "__main__":
    host = os.getenv("OCTRA_WEBUI_HOST", "127.0.0.1")
    port = int(os.getenv("OCTRA_WEBUI_PORT", "8765"))
    web.run_app(create_app(), host=host, port=port)
