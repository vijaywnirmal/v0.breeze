import asyncio
import logging
from fastapi import WebSocket
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections = {}
        self.candle_data_store = {}

    async def connect(self, websocket: WebSocket, subscription_id: str):
        await websocket.accept()
        self.active_connections[subscription_id] = websocket
        logging.info(f"WebSocket connected: {subscription_id}")

    async def disconnect(self, subscription_id: str):
        websocket = self.active_connections.pop(subscription_id, None)
        if websocket:
            await websocket.close()
        self.candle_data_store.pop(subscription_id, None)
        logging.info(f"WebSocket disconnected: {subscription_id}")

    async def send_heartbeat(self, websocket: WebSocket):
        while True:
            try:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "heartbeat", "timestamp": datetime.now().isoformat()})
            except Exception as e:
                logging.error(f"Heartbeat error: {e}")
                break

    async def handle_ticks(self, subscription_id: str, tick_queue: asyncio.Queue, websocket: WebSocket, interval: str):
        self.candle_data_store[subscription_id] = {}
        interval_map = {"1minute": 60, "5minute": 300, "30minute": 1800, "1day": 86400}
        interval_seconds = interval_map.get(interval, 60)
        while True:
            try:
                tick = await tick_queue.get()
                logging.info(f"Received tick: {tick}")
                if not isinstance(tick, dict) or 'open' not in tick or 'close' not in tick or 'high' not in tick or 'low' not in tick or 'volume' not in tick or 'datetime' not in tick:
                    logging.warning(f"Malformed tick skipped: {tick}")
                    continue
                price = float(tick['close'])
                volume = float(tick.get('volume', 0))
                try:
                    timestamp = datetime.fromisoformat(tick['datetime'].replace("Z", "+00:00"))
                except Exception as e:
                    logging.error(f"Failed to parse tick timestamp: {tick.get('datetime')}, error: {e}")
                    timestamp = datetime.utcnow()
                candle_time = int(timestamp.timestamp() // interval_seconds * interval_seconds)
                if candle_time not in self.candle_data_store[subscription_id]:
                    self.candle_data_store[subscription_id][candle_time] = {
                        "time": candle_time,
                        "open": float(tick['open']),
                        "high": float(tick['high']),
                        "low": float(tick['low']),
                        "close": float(tick['close']),
                        "volume": volume,
                        "datetime": datetime.fromtimestamp(candle_time).isoformat()
                    }
                    logging.info(f"New candle started: {self.candle_data_store[subscription_id][candle_time]}")
                else:
                    candle = self.candle_data_store[subscription_id][candle_time]
                    candle['high'] = max(candle['high'], float(tick['high']))
                    candle['low'] = min(candle['low'], float(tick['low']))
                    candle['close'] = float(tick['close'])
                    candle['volume'] += volume
                    logging.info(f"Candle updated: {candle}")
                await websocket.send_json({
                    "type": "ohlcv",
                    **self.candle_data_store[subscription_id][candle_time]
                })
                logging.info(f"Sent candle to frontend: {self.candle_data_store[subscription_id][candle_time]}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"Error aggregating candle: {e}")

websocket_manager = WebSocketManager() 