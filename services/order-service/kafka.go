package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/segmentio/kafka-go"
)

var kafkaWriter *kafka.Writer

func initKafka() {
	brokers := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if brokers == "" {
		brokers = "kafka:9092"
	}

	kafkaWriter = &kafka.Writer{
		Addr:     kafka.TCP(strings.Split(brokers, ",")...),
		Balancer: &kafka.LeastBytes{},
	}

	log.Println("Kafka producer initialized")
}

func publishOrderEvent(topic string, message map[string]interface{}) {
	if kafkaWriter == nil {
		log.Println("Kafka writer not initialized")
		return
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	err = kafkaWriter.WriteMessages(context.Background(),
		kafka.Message{
			Topic: topic,
			Value: messageBytes,
		},
	)

	if err != nil {
		log.Printf("Failed to publish event to %s: %v", topic, err)
	} else {
		log.Printf("Published event to %s: %v", topic, message)
	}
}
