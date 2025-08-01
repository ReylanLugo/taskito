import logging
import requests

class LokiHandler(logging.Handler):
    def __init__(self, url, tags=None):
        super(LokiHandler, self).__init__()
        self.url = url
        self.tags = tags or {}

    def emit(self, record):
        log_entry = self.format(record)
        payload = {
            "streams": [
                {
                    "stream": self.tags,
                    "values": [
                        [str(int(record.created * 1e9)), log_entry]
                    ]
                }
            ]
        }
        try:
            requests.post(self.url, json=payload, timeout=1)
        except requests.exceptions.RequestException as e:
            # Handle connection error gracefully
            print(f"Error sending log to Loki: {e}")
            pass

def setup_logging():
    # Get the root logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Suppress passlib bcrypt warnings
    logging.getLogger('passlib.handlers.bcrypt').setLevel(logging.ERROR)

    # Create a Loki handler
    loki_handler = LokiHandler("http://loki:3100/loki/api/v1/push", tags={"application": "taskito-backend"})
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    loki_handler.setFormatter(formatter)

    # Add the handler to the root logger
    logger.addHandler(loki_handler)

    file_handler = logging.FileHandler('app.log', mode='a')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
