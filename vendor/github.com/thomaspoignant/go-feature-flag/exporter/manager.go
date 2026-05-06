package exporter

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/thomaspoignant/go-feature-flag/utils/fflog"
)

const DefaultExporterCleanQueueInterval = 1 * time.Minute

type Manager[T any] interface {
	AddEvent(event T)
	Start()
	Stop()
}

type managerImpl[T any] struct {
	logger     *fflog.FFLogger
	consumers  []DataExporter[T]
	eventStore *EventStore[T]
}

func NewManager[T any](ctx context.Context, exporters []Config,
	exporterCleanQueueInterval time.Duration, logger *fflog.FFLogger) Manager[T] {
	if ctx == nil {
		ctx = context.Background()
	}

	if exporterCleanQueueInterval == 0 {
		// default value for the exporterCleanQueueDuration is 1 minute
		exporterCleanQueueInterval = DefaultExporterCleanQueueInterval
	}

	evStore := NewEventStore[T](exporterCleanQueueInterval)
	consumers := make([]DataExporter[T], len(exporters))
	for index, exporter := range exporters {
		consumerID := uuid.New().String()
		exp := NewDataExporter[T](ctx, exporter, consumerID, &evStore, logger)
		consumers[index] = exp
		evStore.AddConsumer(consumerID)
	}
	return &managerImpl[T]{
		logger:     logger,
		consumers:  consumers,
		eventStore: &evStore,
	}
}

func (m *managerImpl[T]) AddEvent(event T) {
	store := *m.eventStore
	store.Add(event)
	for _, consumer := range m.consumers {
		if !consumer.IsBulk() {
			consumer.Flush()
			continue
		}

		count, err := store.GetPendingEventCount(consumer.GetConsumerID())
		if err != nil {
			m.logger.Error("error while fetching pending events", err)
			continue
		}
		if count >= consumer.GetMaxEventInMemory() {
			consumer.Flush()
			continue
		}
	}
}

func (m *managerImpl[T]) Start() {
	for _, consumer := range m.consumers {
		go consumer.Start()
	}
}

func (m *managerImpl[T]) Stop() {
	for _, consumer := range m.consumers {
		consumer.Stop()
	}
}
