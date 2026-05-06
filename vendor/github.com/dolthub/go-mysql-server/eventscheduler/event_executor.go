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
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/dolthub/go-mysql-server/sql"
)

// eventExecutor handles execution of each enabled events and any events related queries
// including CREATE/ALTER/DROP EVENT and DROP DATABASE. These queries notify the EventScheduler
// to update the enabled events list in the eventExecutor. It also handles updating the event
// metadata in the database or dropping it from the database after its execution.
type eventExecutor struct {
	catalog             sql.Catalog
	bThreads            *sql.BackgroundThreads
	list                *enabledEventsList
	runningEventsStatus *runningEventsStatus
	ctxGetterFunc       func() (*sql.Context, error)
	queryRunFunc        func(ctx *sql.Context, dbName, query, username, address string) error
	tokenTracker        *tokenTracker
	period              int
	stop                atomic.Bool
}

// newEventExecutor returns a new eventExecutor instance with an empty enabled events list.
// The enabled events list is loaded only when the EventScheduler status is ENABLED.
func newEventExecutor(bgt *sql.BackgroundThreads, ctxFunc func() (*sql.Context, error), runQueryFunc func(ctx *sql.Context, dbName, query, username, address string) error, period int) *eventExecutor {
	return &eventExecutor{
		bThreads:            bgt,
		list:                newEnabledEventsList([]*enabledEvent{}),
		runningEventsStatus: newRunningEventsStatus(),
		ctxGetterFunc:       ctxFunc,
		queryRunFunc:        runQueryFunc,
		stop:                atomic.Bool{},
		tokenTracker:        newTokenTracker(),
		period:              period,
	}
}

// start starts the eventExecutor. It checks and executes
// enabled events and updates necessary events' metadata.
func (ee *eventExecutor) start() {
	ee.stop.Store(false)
	logrus.Trace("Starting eventExecutor")

	// TODO: Currently, we execute events by sorting the enabled events by their execution time, then
	//       waking up at a regular period and seeing if any events are ready to be executed. This
	//       could be more efficient if we used time.Timer to schedule events to be run instead
	//       of having our own loop here. It would also allow us to support any time granularity for
	//       recurring events.
	pollingDuration := 30 * time.Second
	if ee.period > 0 {
		pollingDuration = time.Duration(ee.period) * time.Second
	}

	for {
		time.Sleep(pollingDuration)

		type res int
		const (
			res_fallthrough res = iota
			res_continue
			res_return
		)

		var timeNow, nextAt time.Time
		var lgr *logrus.Entry

		result := func() res {
			ctx, err := ee.ctxGetterFunc()
			if err != nil {
				logrus.Errorf("unable to create context for event executor: %s", err)
				return res_continue
			}
			lgr = ctx.GetLogger()

			defer sql.SessionEnd(ctx.Session)
			sql.SessionCommandBegin(ctx.Session)
			defer sql.SessionCommandEnd(ctx.Session)

			err = beginTx(ctx)
			if err != nil {
				lgr.Errorf("unable to begin transaction for event executor: %s", err)
				return res_continue
			}

			needsToReloadEvents, err := ee.needsToReloadEvents(ctx)
			if err != nil {
				lgr.Errorf("unable to determine if events need to be reloaded: %s", err)
			}
			if needsToReloadEvents {
				err := ee.loadAllEvents(ctx)
				if err != nil {
					lgr.Errorf("unable to reload events: %s", err)
				}
			}

			if ee.stop.Load() {
				logrus.Trace("Stopping eventExecutor")
				return res_return
			} else if ee.list.len() == 0 {
				rollbackTx(ctx)
				return res_continue
			}

			// safeguard list entry getting removed while in check
			timeNow = time.Now()
			var ok bool
			nextAt, ok = ee.list.getNextExecutionTime()
			if !ok {
				rollbackTx(ctx)
				return res_continue
			}

			err = commitTx(ctx)
			if err != nil {
				lgr.Errorf("unable to commit transaction for reloading events: %s", err)
			}
			return res_fallthrough
		}()

		if result == res_continue {
			continue
		} else if result == res_return {
			return
		}

		secondsUntilExecution := nextAt.Sub(timeNow).Seconds()
		if secondsUntilExecution <= -1*pollingDuration.Seconds() {
			// in case the execution time is past, re-evaluate it ( TODO: should not happen )
			curEvent := ee.list.pop()
			if curEvent != nil {
				logrus.Warnf("Reevaluating event %s, seconds until execution: %f", curEvent.name(), secondsUntilExecution)
				ee.reevaluateEvent(curEvent.edb, curEvent.event)
			}
		} else if secondsUntilExecution <= 0.0000001 {
			curEvent := ee.list.pop()
			if curEvent != nil {
				func() {
					lgr.Debugf("Executing event %s, seconds until execution: %f", curEvent.name(), secondsUntilExecution)
					ctx, err := ee.ctxGetterFunc()
					if err != nil {
						ctx.GetLogger().Errorf("Received error '%s' getting ctx in event scheduler", err)
						return
					}
					defer sql.SessionEnd(ctx.Session)
					sql.SessionCommandBegin(ctx.Session)
					defer sql.SessionCommandEnd(ctx.Session)
					err = beginTx(ctx)
					if err != nil {
						ctx.GetLogger().Errorf("Received error '%s' beginning transaction in event scheduler", err)
						return
					}
					err = ee.executeEventAndUpdateList(ctx, curEvent, timeNow)
					if err != nil {
						ctx.GetLogger().Errorf("Received error '%s' executing event: %s", err, curEvent.event.Name)
					}
					err = commitTx(ctx)
					if err != nil {
						ctx.GetLogger().Errorf("Received error '%s' executing event: %s", err, curEvent.event.Name)
					}
				}()
			}
		} else {
			lgr.Tracef("Not executing event %s yet, seconds until execution: %f", ee.list.peek().name(), secondsUntilExecution)
		}
	}
}

// needsToReloadEvents returns true if any of the EventDatabases known to this event executor
func (ee *eventExecutor) needsToReloadEvents(ctx *sql.Context) (bool, error) {
	// TODO: We currently reload all events across all databases if any of the EventDatabases indicate they
	//       need to be reloaded. In the future, we could optimize this more by ony reloading events from the
	//       EventDatabases that indicated they need to be reloaded. This just requires more detailed handling
	//       of the enabledEvent list to merge together existing events and reloaded events.
	for _, database := range ee.catalog.AllDatabases(ctx) {
		edb, ok := database.(sql.EventDatabase)
		if !ok {
			// Skip any non-EventDatabases
			continue
		}

		token := ee.tokenTracker.GetTrackedToken(edb.Name())
		needsToReload, err := edb.NeedsToReloadEvents(ctx, token)
		if err != nil {
			return false, err
		}
		if needsToReload {
			ctx.GetLogger().Debugf("Event reload needed for database %s", edb.Name())
			return true, nil
		}
	}
	return false, nil
}

// loadAllEvents reloads all events from all known EventDatabases. This is necessary when out-of-band
// changes have modified event definitions without going through the CREATE EVENT, ALTER EVENT code paths.
func (ee *eventExecutor) loadAllEvents(ctx *sql.Context) error {
	ctx.GetLogger().Debug("Loading events")

	enabledEvents := make([]*enabledEvent, 0)
	allDatabases := ee.catalog.AllDatabases(ctx)
	for _, database := range allDatabases {
		edb, ok := database.(sql.EventDatabase)
		if !ok {
			// Skip any non-EventDatabases
			continue
		}

		// TODO: We currently need to set the current database to get the parsed plan,
		//       but this feels like it shouldn't be necessary; would be good to clean up
		ctx.SetCurrentDatabase(edb.Name())
		events, token, err := edb.GetEvents(ctx)
		if err != nil {
			return err
		}

		ee.tokenTracker.UpdateTrackedToken(edb.Name(), token)
		for _, eDef := range events {
			newEnabledEvent, created, err := newEnabledEvent(ctx, edb, eDef, time.Now())
			if err != nil {
				ctx.GetLogger().Errorf("unable to reload event: %s", err)
			} else if created {
				enabledEvents = append(enabledEvents, newEnabledEvent)
			}
		}
	}

	ee.list = newEnabledEventsList(enabledEvents)
	return nil
}

// shutdown stops the eventExecutor.
func (ee *eventExecutor) shutdown() {
	ee.stop.Store(true)
	ee.list.clear()
	ee.runningEventsStatus.clear()
}

// executeEventAndUpdateList executes the given event and updates the event's last executed time in the database.
// If the event is not ended, then it updates the enabled event and re-adds it back to the list.
func (ee *eventExecutor) executeEventAndUpdateList(ctx *sql.Context, event *enabledEvent, executionTime time.Time) error {
	reAdd, err := ee.executeEvent(event)
	if err != nil {
		return err
	}

	ended, err := event.updateEventAfterExecution(ctx, event.edb, executionTime)
	if err != nil {
		return err
	} else if !reAdd {
		return nil
	} else if !ended {
		ee.list.add(event)
	}
	return nil
}

// executeEvent executes given event by adding a thread to background threads to run the given event's definition.
// This function returns whether the event needs to be added back into the enabled events list, as well as any
// error if a background thread was not able to be started up to execute the event.
func (ee *eventExecutor) executeEvent(event *enabledEvent) (bool, error) {
	ee.runningEventsStatus.update(event.name(), true, true)
	defer ee.runningEventsStatus.remove(event.name())

	reAdd, ok := ee.runningEventsStatus.getReAdd(event.name())
	if !ok {
		// should not happen, but sanity check
		reAdd = false
	}
	// if event is ONE TIME, then do not re-add
	if event.event.HasExecuteAt {
		reAdd = false
	}

	taskName := fmt.Sprintf("executing %s", event.name())
	addThreadErr := ee.bThreads.Add(taskName, func(ctx context.Context) {
		logrus.Trace(taskName)
		select {
		case <-ctx.Done():
			logrus.Tracef("stopping background thread (%s)", taskName)
			ee.stop.Store(true)
			return
		default:
			// get a new session sql.Context for each event definition execution
			sqlCtx, err := ee.ctxGetterFunc()
			if err != nil {
				logrus.WithField("query", event.event.EventBody).Errorf("unable to get context for executed query: %v", err)
				return
			}
			defer sql.SessionEnd(sqlCtx.Session)
			sql.SessionCommandBegin(sqlCtx.Session)
			defer sql.SessionCommandEnd(sqlCtx.Session)
			err = beginTx(sqlCtx)
			if err != nil {
				logrus.WithField("query", event.event.EventBody).Errorf("unable to begin transaction on context for executed query: %v", err)
				return
			}

			// Note that we pass in the full CREATE EVENT statement so that the engine can parse it
			// and pull out the plan nodes for the event body, since the event body doesn't always
			// parse as a valid SQL statement on its own (e.g. when using a BEGIN/END block).
			logrus.WithField("query", event.event.EventBody).Debugf("executing event %s", event.name())
			err = ee.queryRunFunc(sqlCtx, event.edb.Name(), event.event.CreateEventStatement(), event.username, event.address)
			if err != nil {
				logrus.WithField("query", event.event.EventBody).Errorf("unable to execute query: %v", err)
				rollbackTx(sqlCtx)
				return
			}

			// must commit after done using the sql.Context
			err = commitTx(sqlCtx)
			if err != nil {
				logrus.WithField("query", event.event.EventBody).Errorf("unable to commit transaction: %v", err)
				return
			}
		}
	})

	return reAdd, addThreadErr
}

// reevaluateEvent evaluates an event from enabled events list, but its execution time passed the current time.
// It creates new enabledEvent if the event being created is at ENABLE status with valid schedule.
// This function is used when the event misses the execution time check of the event.
func (ee *eventExecutor) reevaluateEvent(edb sql.EventDatabase, event sql.EventDefinition) {
	// if the updated event status is not ENABLE, do not add it to the list.
	if event.Status != sql.EventStatus_Enable.String() {
		return
	}

	ctx, err := ee.ctxGetterFunc()
	if err != nil {
		ctx.GetLogger().Errorf("Received error '%s' getting ctx in event scheduler", err)
		return
	}
	defer sql.SessionEnd(ctx.Session)
	sql.SessionCommandBegin(ctx.Session)
	defer sql.SessionCommandEnd(ctx.Session)

	err = beginTx(ctx)
	if err != nil {
		ctx.GetLogger().Errorf("Received error '%s' beginning transaction on ctx in event scheduler", err)
		return
	}

	newEvent, created, err := newEnabledEvent(ctx, edb, event, time.Now())
	if err != nil {
		ctx.GetLogger().Errorf("Received error '%s' re-evaluating event to scheduler: %s", err, event.Name)
	} else if created {
		ee.list.add(newEvent)
	}

	err = commitTx(ctx)
	if err != nil {
		ctx.GetLogger().Errorf("Received error '%s' re-evaluating event to scheduler: %s", err, event.Name)
	}
}

// addEvent creates new enabledEvent if the event being created is at ENABLE status with valid schedule.
// If the updated event's schedule is starting at the same time as created time, it executes immediately.
func (ee *eventExecutor) addEvent(ctx *sql.Context, edb sql.EventDatabase, event sql.EventDefinition) {
	// if the updated event status is not ENABLE, do not add it to the list.
	if event.Status != sql.EventStatus_Enable.String() {
		return
	}

	enabledEvent, created, err := newEnabledEvent(ctx, edb, event, event.CreatedAt)
	if err != nil {
		ctx.GetLogger().Errorf("Received error '%s' executing event: %s", err, event.Name)
	} else if created {
		newEvent := enabledEvent.event
		// if STARTS is set to current_timestamp or not set,
		// then executeEvent the event once and update lastExecuted.
		var firstExecutionTime time.Time
		if newEvent.HasExecuteAt {
			firstExecutionTime = newEvent.ExecuteAt
		} else {
			firstExecutionTime = newEvent.Starts
		}
		if firstExecutionTime.Sub(newEvent.CreatedAt).Abs().Seconds() <= 1 {
			// after execution, the event is added to the list if applicable (if the event is not ended)
			err = ee.executeEventAndUpdateList(ctx, enabledEvent, newEvent.CreatedAt)
			if err != nil {
				ctx.GetLogger().Errorf("Received error '%s' executing event: %s", err, event.Name)
				return
			}
		} else {
			ee.list.add(enabledEvent)
		}
	}
	return
}

// updateEvent removes the event from enabled events list if it exists and adds new enabledEvent if the event status
// is ENABLE and event schedule is not expired. If the new event's schedule is starting at the same time as
// last altered time, it executes immediately.
func (ee *eventExecutor) updateEvent(ctx *sql.Context, edb sql.EventDatabase, origEventName string, event sql.EventDefinition) {
	var origEventKeyName = fmt.Sprintf("%s.%s", edb.Name(), origEventName)
	// remove the original event if exists.
	ee.list.remove(origEventKeyName)

	// if the updated event status is not ENABLE, do not add it to the list.
	if event.Status != sql.EventStatus_Enable.String() {
		return
	}

	// add the updated event as new event
	newUpdatedEvent, created, err := newEnabledEvent(ctx, edb, event, event.LastAltered)
	if err != nil {
		return
	} else if created {
		newDetails := newUpdatedEvent.event
		// if the event being updated is currently running,
		// then do not re-add the event to the list after execution
		if s, ok := ee.runningEventsStatus.getStatus(origEventKeyName); ok && s {
			ee.runningEventsStatus.update(origEventKeyName, s, false)
		}

		if newDetails.Starts.Sub(newDetails.LastAltered).Abs().Seconds() <= 1 {
			err = ee.executeEventAndUpdateList(ctx, newUpdatedEvent, newDetails.LastAltered)
			if err != nil {
				ctx.GetLogger().Errorf("Received error '%s' executing event: %s", err, newDetails.Name)
				return
			}
		} else {
			ee.list.add(newUpdatedEvent)
		}
	}
	return
}

// removeEvent removes the event if it exists in the enabled events list.
// If the event is currently executing, it will not be in the list,
// so it updates the running events status to not re-add this event
// after its execution.
func (ee *eventExecutor) removeEvent(eventName string) {
	ee.list.remove(eventName)
	// if not found, it might have been removed as it's currently executing
	if s, ok := ee.runningEventsStatus.getStatus(eventName); ok && s {
		ee.runningEventsStatus.update(eventName, s, false)
	}
}

// removeSchemaEvents removes all events from a given database if any exist
// in the enabled events list. If any events of this database
// are currently executing, they will not be in the list,
// so it updates the running events status to not re-add those
// events after their execution.
func (ee *eventExecutor) removeSchemaEvents(dbName string) {
	ee.list.removeSchemaEvents(dbName)
	// if not found, it might be currently executing
	ee.runningEventsStatus.cancelEventsForDatabase(dbName)
}

// tokenTracker tracks the opaque tokens returned by EventDatabase.GetEvents, which are later used with
// EventDatabase.NeedsToReloadEvents so that integrators can signal if out-of-band event changes have
// occurred, in which case GMS will call EventDatabase.GetEvents to get the updated event definitions.
type tokenTracker struct {
	// trackedTokenMap is a map of event database name to the last opaque reload token returned by GetEvents.
	trackedTokenMap map[string]interface{}
}

// newTokenTracker creates a new, empty tokenTracker.
func newTokenTracker() *tokenTracker {
	return &tokenTracker{
		trackedTokenMap: make(map[string]interface{}),
	}
}

// Equal returns true if the last tracked token for the EventDatabase named |databaseName| is equal
// to the |other| opaque token. Equality is tested by an "==" check.
func (ht *tokenTracker) Equal(databaseName string, other interface{}) bool {
	return ht.trackedTokenMap[databaseName] == other
}

// UpdateTrackedToken updates the tracked token for the EventDatabase named |databaseName| to
// the value in |token|.
func (ht *tokenTracker) UpdateTrackedToken(databaseName string, token interface{}) {
	ht.trackedTokenMap[databaseName] = token
}

// GetTrackedToken returns the tracked token for the EventDatabase named |databaseName|.
func (ht *tokenTracker) GetTrackedToken(databaseName string) interface{} {
	return ht.trackedTokenMap[databaseName]
}
