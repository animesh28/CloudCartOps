from kafka import KafkaProducer
import json
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092').split(',')

try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        retries=5
    )
    logger.info("Kafka producer connected")
except Exception as e:
    logger.error(f"Failed to connect Kafka producer: {e}")
    producer = None

def publish_event(topic: str, message: dict):
    if producer:
        try:
            future = producer.send(topic, value=message)
            future.get(timeout=10)
            logger.info(f"Published event to {topic}: {message}")
        except Exception as e:
            logger.error(f"Failed to publish event to {topic}: {e}")
    else:
        logger.warning(f"Kafka producer not available, skipping event: {topic}")
