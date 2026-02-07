package exporter

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/thomaspoignant/go-feature-flag/utils/fflog"
)

const (
	defaultFlushInterval    = 60 * time.Second
	defaultMaxEventInMemory = int64(100000)
)

type DataExporter[T any] interface {
	// Start is launching the ticker to periodically flush the data
	Start()
	// Stop is stopping the ticker
	Stop()
	// Flush is sending the data to the exporter
	Flush()
	// IsBulk return false if we should directly send the data as soon as it is produce
	IsBulk() bool
	// GetConsumerID return the consumer ID used in the event store
	GetConsumerID() string
	// GetMaxEventInMemory return the maximum number of event you keep in the cache before calling Flush()
	GetMaxEventInMemory() int64
}
type Config struct {
	Exporter         CommonExporter
	FlushInterval    time.Duration
	MaxEventInMemory int64
}

type dataExporterImpl[T any] struct {
	ctx        context.Context
	consumerID string
	eventStore *EventStore[T]
	logger     *fflog.FFLogger
	exporter   Config

	daemonChan chan struct{}
	ticker     *time.Ticker
}

// NewDataExporter create a new DataExporter with the given exporter and his consumer information to consume the data
// from the shared event store.
func NewDataExporter[T any](ctx context.Context, exporter Config, consumerID string,
	eventStore *EventStore[T], logger *fflog.FFLogger) DataExporter[T] {
	if ctx == nil {
		ctx = context.Background()
	}

	if exporter.FlushInterval == 0 {
		exporter.FlushInterval = defaultFlushInterval
	}

	if exporter.MaxEventInMemory == 0 {
		exporter.MaxEventInMemory = defaultMaxEventInMemory
	}

	return &dataExporterImpl[T]{
		ctx:        ctx,
		consumerID: consumerID,
		eventStore: eventStore,
		logger:     logger,
		exporter:   exporter,
		daemonChan: make(chan struct{}),
		ticker:     time.NewTicker(exporter.FlushInterval),
	}
}

// Start is launching the ticker to periodically flush the data
// If we have a live exporter we don't start the daemon.
func (d *dataExporterImpl[T]) Start() {
	// we don't start the daemon if we are not in bulk mode
	if !d.IsBulk() {
		return
	}

	for {
		select {
		case <-d.ticker.C:
			d.Flush()
		case <-d.daemonChan:
			// stop the daemon
			return
		}
	}
}

// Stop is flushing the daya and stopping the ticker
func (d *dataExporterImpl[T]) Stop() {
	// we don't start the daemon if we are not in bulk mode
	if !d.IsBulk() {
		d.Flush()
		return
	}
	d.ticker.Stop()
	close(d.daemonChan)
	d.Flush()
}

// Flush is sending the data to the exporter
func (d *dataExporterImpl[T]) Flush() {
	store := *d.eventStore
	err := store.ProcessPendingEvents(d.consumerID, d.sendEvents)
	if err != nil {
		d.logger.Error(err.Error())
		return
	}
}

// IsBulk return false if we should directly send the data as soon as it is produce
func (d *dataExporterImpl[T]) IsBulk() bool {
	return d.exporter.Exporter.IsBulk()
}

// GetConsumerID return the consumer ID used in the event store
func (d *dataExporterImpl[T]) GetConsumerID() string {
	return d.consumerID
}

// GetMaxEventInMemory return the maximum number of event you keep in the cache before calling Flush()
func (d *dataExporterImpl[T]) GetMaxEventInMemory() int64 {
	return d.exporter.MaxEventInMemory
}

// sendEvents is sending the events to the exporter.
func (d *dataExporterImpl[T]) sendEvents(ctx context.Context, events []T) error {
	if len(events) == 0 {
		return nil
	}
	switch exp := d.exporter.Exporter.(type) {
	case DeprecatedExporter:
		var legacyLogger *log.Logger
		if d.logger != nil {
			legacyLogger = d.logger.GetLogLogger(slog.LevelError)
		}
		switch events := any(events).(type) {
		case []FeatureEvent:
			// use dc exporter as a DeprecatedExporter
			err := exp.Export(ctx, legacyLogger, events)
			slog.Warn("You are using an exporter with the old logger."+
				"Please update your custom exporter to comply to the new Exporter interface.",
				slog.Any("err", err))
			if err != nil {
				return fmt.Errorf("error while exporting data (deprecated): %w", err)
			}
		default:
			return fmt.Errorf("trying to send unknown object to the exporter (deprecated)")
		}
		break
	case Exporter:
		switch events := any(events).(type) {
		case []FeatureEvent:
			err := exp.Export(ctx, d.logger, events)
			if err != nil {
				return fmt.Errorf("error while exporting data: %w", err)
			}
		default:
			return fmt.Errorf("trying to send unknown object to the exporter")
		}
		break
	default:
		return fmt.Errorf("this is not a valid exporter")
	}
	return nil
}
