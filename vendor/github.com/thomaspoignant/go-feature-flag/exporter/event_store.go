package exporter

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

const minOffset = int64(math.MinInt64)

type eventStoreImpl[T any] struct {
	// events is a list of events to store
	events []Event[T]
	// mutex to protect the events and consumers
	mutex sync.RWMutex
	// consumers is a map of consumers with their name as key
	consumers map[string]*consumer
	// lastOffset is the last offset used for the Event store
	lastOffset int64
	// stopPeriodicCleaning is a channel to stop the periodic cleaning goroutine
	stopPeriodicCleaning chan struct{}
	// cleanQueueInterval is the duration between each cleaning
	cleanQueueInterval time.Duration
}

func NewEventStore[T any](cleanQueueInterval time.Duration) EventStore[T] {
	store := &eventStoreImpl[T]{
		events:               make([]Event[T], 0),
		mutex:                sync.RWMutex{},
		lastOffset:           minOffset,
		stopPeriodicCleaning: make(chan struct{}),
		cleanQueueInterval:   cleanQueueInterval,
		consumers:            make(map[string]*consumer),
	}
	go store.periodicCleanQueue()
	return store
}

type EventList[T any] struct {
	Events        []T
	InitialOffset int64
	NewOffset     int64
}

// EventStore is the interface to store events and consume them.
// It is a simple implementation of a queue with offsets.
type EventStore[T any] interface {
	// AddConsumer is adding a new consumer to the Event store.
	// note that you can't add a consumer after the Event store has been started.
	AddConsumer(consumerID string)

	// Add is adding item of type T in the Event store.
	Add(data T)

	// GetPendingEventCount is returning the number items available in the Event store for this consumer.
	GetPendingEventCount(consumerID string) (int64, error)

	// GetTotalEventCount returns the total number of events in the store.
	GetTotalEventCount() int64

	// ProcessPendingEvents is processing all the available item in the Event store for this consumer
	// with the process events function in parameter,
	ProcessPendingEvents(consumerID string, processEventsFunc func(context.Context, []T) error) error

	// Stop is closing the Event store and stop the periodic cleaning.
	Stop()
}

type Event[T any] struct {
	Offset int64
	Data   T
}

type consumer struct {
	Offset int64
}

// AddConsumer is adding a new consumer to the Event store.
// note that you can't add a consumer after the Event store has been started.
func (e *eventStoreImpl[T]) AddConsumer(consumerID string) {
	e.consumers[consumerID] = &consumer{Offset: e.lastOffset}
}

// ProcessPendingEvents is processing all the available item in the Event store for this consumer
// with the process events function in parameter,
func (e *eventStoreImpl[T]) ProcessPendingEvents(
	consumerID string, processEventsFunc func(context.Context, []T) error) error {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	eventList, err := e.fetchPendingEvents(consumerID)
	if err != nil {
		return err
	}
	err = processEventsFunc(context.Background(), eventList.Events)
	if err != nil {
		return err
	}
	err = e.updateConsumerOffset(consumerID, eventList.NewOffset)
	if err != nil {
		return err
	}
	return nil
}

// GetTotalEventCount returns the total number of events in the store.
func (e *eventStoreImpl[T]) GetTotalEventCount() int64 {
	e.mutex.RLock()
	defer e.mutex.RUnlock()
	return int64(len(e.events))
}

// GetPendingEventCount is returning the number items available in the Event store for this consumer.
func (e *eventStoreImpl[T]) GetPendingEventCount(consumerID string) (int64, error) {
	e.mutex.RLock()
	defer e.mutex.RUnlock()
	consumer, err := e.getConsumer(consumerID)
	if err != nil {
		return 0, err
	}
	return e.lastOffset - consumer.Offset, nil
}

// Add is adding item of type T in the Event store.
func (e *eventStoreImpl[T]) Add(data T) {
	e.mutex.Lock()
	defer e.mutex.Unlock()
	e.lastOffset++
	e.events = append(e.events, Event[T]{Offset: e.lastOffset, Data: data})
}

// fetchPendingEvents is returning all the available item in the Event store for this consumer.
// WARNING: please call this function only in a function that has locked the mutex first.
func (e *eventStoreImpl[T]) fetchPendingEvents(consumerID string) (*EventList[T], error) {
	currentConsumer, err := e.getConsumer(consumerID)
	if err != nil {
		return nil, err
	}
	events := make([]T, 0)
	for _, event := range e.events {
		if event.Offset > currentConsumer.Offset {
			events = append(events, event.Data)
		}
	}
	return &EventList[T]{Events: events, InitialOffset: currentConsumer.Offset, NewOffset: e.lastOffset}, nil
}

// getConsumer checks if the consumer exists and returns it.
func (e *eventStoreImpl[T]) getConsumer(consumerID string) (*consumer, error) {
	currentConsumer, ok := e.consumers[consumerID]
	if !ok {
		return nil, fmt.Errorf("consumer with name %s not found", consumerID)
	}
	return currentConsumer, nil
}

// updateConsumerOffset updates the offset of the consumer to the new offset.
// WARNING: please call this function only in a function that has locked the mutex first.
func (e *eventStoreImpl[T]) updateConsumerOffset(consumerID string, offset int64) error {
	if offset > e.lastOffset {
		return fmt.Errorf("invalid offset: offset %d is greater than the last offset %d", offset, e.lastOffset)
	}
	currentConsumer, err := e.getConsumer(consumerID)
	if err != nil {
		return err
	}
	currentConsumer.Offset = e.lastOffset
	return nil
}

// cleanQueue removes all events that have been consumed by all consumers
func (e *eventStoreImpl[T]) cleanQueue() {
	e.mutex.Lock()
	defer e.mutex.Unlock()
	if len(e.events) == 0 {
		// nothing to remove
		return
	}
	consumerMinOffset := minOffset
	for _, currentConsumer := range e.consumers {
		if consumerMinOffset == minOffset || currentConsumer.Offset < consumerMinOffset {
			consumerMinOffset = currentConsumer.Offset
		}
	}
	if consumerMinOffset <= minOffset {
		// nothing to remove
		return
	}

	for i, event := range e.events {
		if event.Offset == consumerMinOffset {
			e.events = e.events[i+1:]
			break
		}
	}
}

// periodicCleanQueue periodically cleans the queue
func (e *eventStoreImpl[T]) periodicCleanQueue() {
	ticker := time.NewTicker(e.cleanQueueInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			e.cleanQueue()
		case <-e.stopPeriodicCleaning:
			return
		}
	}
}

// Stop is closing the Event store and stop the periodic cleaning.
func (e *eventStoreImpl[T]) Stop() {
	close(e.stopPeriodicCleaning)
}
