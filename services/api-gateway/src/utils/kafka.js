const { Kafka } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',');

const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: KAFKA_BROKERS,
  retry: {
    retries: 5,
    initialRetryTime: 100
  }
});

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  if (!isConnected) {
    try {
      await producer.connect();
      isConnected = true;
      console.log('Kafka producer connected');
    } catch (error) {
      console.error('Failed to connect Kafka producer:', error);
    }
  }
}

async function publishToKafka(topic, message) {
  try {
    await connectProducer();
    
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        }
      ]
    });
  } catch (error) {
    console.error(`Failed to publish to Kafka topic ${topic}:`, error);
  }
}

module.exports = { publishToKafka };
