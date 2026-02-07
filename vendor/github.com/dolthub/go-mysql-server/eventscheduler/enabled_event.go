// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package eventscheduler

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
)

// enabledEvent is used for storing a list of events that are enabled in EventScheduler.
type enabledEvent struct {
	nextExecutionAt time.Time
	edb             sql.EventDatabase
	username        string
	address         string
	event           sql.EventDefinition
}

var _ fmt.Stringer = (*enabledEvent)(nil)

// newEnabledEvent returns new enabledEvent object and whether it is created successfully. An event
// with ENABLE status might NOT be created if the event SCHEDULE is ended/expired. If the event is expired,
// then this function either updates its status in the database or drops it from the database.
func newEnabledEvent(ctx *sql.Context, edb sql.EventDatabase, event sql.EventDefinition, curTime time.Time) (*enabledEvent, bool, error) {
	if event.Status == sql.EventStatus_Enable.String() {
		nextExecution, eventEnded, err := event.GetNextExecutionTime(curTime)
		if err != nil {
			return nil, false, err
		} else if !eventEnded {
			username, address, err := getUsernameAndAddressFromDefiner(event.Definer)
			if err != nil {
				return nil, false, err
			}
			return &enabledEvent{
				edb:             edb,
				event:           event,
				nextExecutionAt: nextExecution,
				username:        username,
				address:         address,
			}, true, nil
		} else {
			if event.OnCompletionPreserve {
				event.Status = sql.EventStatus_Disable.String()
				_, err = edb.UpdateEvent(ctx, event.Name, event)
				if err != nil {
					return nil, false, err
				}
			} else {
				err = edb.DropEvent(ctx, event.Name)
				if err != nil {
					return nil, false, err
				}
			}
		}
	}
	return nil, false, nil
}

// getUsernameAndAddressFromDefiner returns username and address parsed from given definer value of an EventDefinition.
func getUsernameAndAddressFromDefiner(definer string) (string, string, error) {
	// make sure definer has username and address information here
	ua := strings.Split(definer, "@")
	if len(ua) != 2 {
		return "", "", fmt.Errorf("invalid definer for the event")
	}

	username := strings.TrimSuffix(strings.TrimPrefix(ua[0], "`"), "`")
	username = strings.TrimSuffix(strings.TrimPrefix(username, "'"), "'")

	address := strings.TrimSuffix(strings.TrimPrefix(ua[1], "`"), "`")
	address = strings.TrimSuffix(strings.TrimPrefix(address, "'"), "'")

	return username, address, nil
}

// String implements the fmt.Stringer interface
func (e *enabledEvent) String() string {
	return fmt.Sprintf("next execution at: %v, event database: %s, event definition: %v", e.nextExecutionAt, e.edb.Name(), e.event)
}

// name returns 'database_name.event_name' used as a key for mapping unique events.
func (e *enabledEvent) name() string {
	return fmt.Sprintf("%s.%s", e.edb.Name(), e.event.Name)
}

// updateEventAfterExecution updates the event's LastExecuted metadata with given execution time and returns whether
// the event is expired. If the event is not expired, this function updates the given enabledEvent with the next
// execution time. If expired, it updates the event's metadata in the database or drop the event from the database.
func (e *enabledEvent) updateEventAfterExecution(ctx *sql.Context, edb sql.EventDatabase, executionTime time.Time) (bool, error) {
	var nextExecutionAt time.Time
	var ended bool
	var err error
	if e.event.HasExecuteAt {
		// one-time event is ended after one execution
		ended = true
	} else {
		nextExecutionAt, ended, err = e.event.GetNextExecutionTime(time.Now())
		if err != nil {
			return ended, err
		}
	}

	if ended {
		if e.event.OnCompletionPreserve {
			e.event.Status = sql.EventStatus_Disable.String()
		} else {
			err = edb.DropEvent(ctx, e.event.Name)
			if err != nil {
				return ended, err
			}
			return true, nil
		}
	} else {
		e.nextExecutionAt = nextExecutionAt
	}

	e.event.LastExecuted = executionTime
	// update the database stored event with LastExecuted and Status metadata update if applicable.
	_, err = edb.UpdateEvent(ctx, e.event.Name, e.event)
	if err != nil {
		return ended, err
	}

	return ended, nil
}

// enabledEventsList is a list of enabled events of all databases that the eventExecutor
// uses to execute them at the scheduled time.
type enabledEventsList struct {
	mu         *sync.Mutex
	eventsList []*enabledEvent
}

// newEnabledEventsList returns new enabledEventsList object with the given
// enabledEvent list and sorts it by the nextExecutionAt time.
func newEnabledEventsList(list []*enabledEvent) *enabledEventsList {
	newList := &enabledEventsList{
		mu:         &sync.Mutex{},
		eventsList: list,
	}
	sort.SliceStable(newList.eventsList, func(i, j int) bool {
		return list[i].nextExecutionAt.Sub(list[j].nextExecutionAt).Seconds() < 1
	})
	return newList
}

// clear sets the current list to empty list.
func (l *enabledEventsList) clear() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.eventsList = nil
}

// len returns the length of the current list.
func (l *enabledEventsList) len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.eventsList)
}

// getNextExecutionTime returns the execution time of the first enabledEvent in the current list.
func (l *enabledEventsList) getNextExecutionTime() (time.Time, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.eventsList) == 0 {
		return time.Time{}, false
	}
	return l.eventsList[0].nextExecutionAt, true
}

// peek returns the first element from the list, without removing it from the list.
func (l *enabledEventsList) peek() *enabledEvent {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.eventsList) == 0 {
		return nil
	}
	return l.eventsList[0]
}

// pop returns the first element and removes it from the list.
func (l *enabledEventsList) pop() *enabledEvent {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.eventsList) == 0 {
		return nil
	}
	firstInList := l.eventsList[0]
	l.eventsList = l.eventsList[1:]
	return firstInList
}

// add adds the event to the list and sorts the list.
func (l *enabledEventsList) add(event *enabledEvent) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.eventsList = append(l.eventsList, event)
	sort.SliceStable(l.eventsList, func(i, j int) bool {
		return l.eventsList[i].nextExecutionAt.Sub(l.eventsList[j].nextExecutionAt).Seconds() < 1
	})
}

// remove removes the event from the list,
// the list order stays the same.
func (l *enabledEventsList) remove(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for i, e := range l.eventsList {
		if e.name() == key {
			l.eventsList = append(l.eventsList[:i], l.eventsList[i+1:]...)
			return
		}
	}
}

// String implements the fmt.Stringer interface
func (l *enabledEventsList) String() string {
	return fmt.Sprintf("event list: %v", l.eventsList)
}

// remove removes all events of the given database from the list,
// the list order stays the same.
func (l *enabledEventsList) removeSchemaEvents(dbName string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for i, e := range l.eventsList {
		if e.edb.Name() == dbName {
			l.eventsList = append(l.eventsList[:i], l.eventsList[i+1:]...)
		}
	}
}

// runningEventsStatus stores whether the event is currently running and
// needs to be re-added after execution. When currently running event is
// updated or dropped, it should not be re-added to the enabledEventsList
// after execution.
type runningEventsStatus struct {
	mu     *sync.Mutex
	status map[string]bool
	reAdd  map[string]bool
}

// newRunningEventsStatus returns new empty runningEventsStatus object.
func newRunningEventsStatus() *runningEventsStatus {
	return &runningEventsStatus{
		mu:     &sync.Mutex{},
		status: make(map[string]bool),
		reAdd:  make(map[string]bool),
	}
}

// clear removes all entries from runningEventsStatus object maps.
func (r *runningEventsStatus) clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.status = make(map[string]bool)
	r.reAdd = make(map[string]bool)
}

// update updates the runningEventsStatus object maps with given key and values.
func (r *runningEventsStatus) update(key string, status, reAdd bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.status[key] = status
	r.reAdd[key] = reAdd
}

// remove removes an entry from runningEventsStatus object maps with given key.
func (r *runningEventsStatus) remove(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.status, key)
	delete(r.reAdd, key)
}

// getStatus returns the status of the event at given key.
func (r *runningEventsStatus) getStatus(key string) (bool, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	b, ok := r.status[key]
	return b, ok
}

// getReAdd returns whether to re-add the event at given key.
func (r *runningEventsStatus) getReAdd(key string) (bool, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	b, ok := r.reAdd[key]
	return b, ok
}

// cancelEventsForDatabase marks all running events for the specified database
// so that they do not get rescheduled after they finish running.
func (r *runningEventsStatus) cancelEventsForDatabase(dbName string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	// if there are any running events of given database, then set reAdd to false
	for evId := range r.status {
		if strings.HasPrefix(evId, fmt.Sprintf("%s.", dbName)) {
			r.reAdd[evId] = false
		}
	}
}
