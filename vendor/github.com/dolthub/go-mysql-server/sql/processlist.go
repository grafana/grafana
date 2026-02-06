// Copyright 2020-2021 Dolthub, Inc.
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

package sql

import (
	"context"
	"fmt"
	"time"
)

type ProcessList interface {
	// Processes returns the list of current running processes
	Processes() []Process

	// AddConnection adds a new connection to the process list. Must be matched with RemoveConnection.
	AddConnection(connID uint32, addr string)

	// Transitions a connection from Connect to Sleep.
	ConnectionReady(sess Session)

	// RemoveConnection removes the connection from the process list.
	RemoveConnection(connID uint32)

	// BeginQuery transitions an existing connection in the processlist from Command "Sleep" to Command "Query".
	// Returns a new context which will be canceled when this query is done.
	BeginQuery(ctx *Context, query string) (*Context, error)

	// EndQuery transitions a previously transitioned connection from Command "Query" to Command "Sleep".
	EndQuery(ctx *Context)

	// BeginOperation registers and returns a SubContext for a
	// long-running operation on the conneciton which does not
	// change the process's Command state. This SubContext will be
	// killed by a call to |Kill|, and unregistered by a call to
	// |EndOperation|.
	BeginOperation(ctx *Context) (*Context, error)

	// EndOperation cancels and deregisters the SubContext which
	// BeginOperation registered.
	EndOperation(ctx *Context)

	// Kill terminates all queries for a given connection id
	Kill(connID uint32)

	// UpdateTableProgress updates the progress of the table with the given name for the
	// process with the given pid.
	UpdateTableProgress(pid uint64, name string, delta int64)

	// UpdatePartitionProgress updates the progress of the table partition with the
	// given name for the process with the given pid.
	UpdatePartitionProgress(pid uint64, tableName, partitionName string, delta int64)

	// AddTableProgress adds a new item to track progress from to the process with
	// the given pid. If the pid does not exist, it will do nothing.
	AddTableProgress(pid uint64, name string, total int64)

	// AddPartitionProgress adds a new item to track progress from to the process with
	// the given pid. If the pid or the table does not exist, it will do nothing.
	AddPartitionProgress(pid uint64, tableName, partitionName string, total int64)

	// RemoveTableProgress removes an existing item tracking progress from the
	// process with the given pid, if it exists.
	RemoveTableProgress(pid uint64, name string)

	// RemovePartitionProgress removes an existing partition tracking progress from the
	// process with the given pid, if it exists.
	RemovePartitionProgress(pid uint64, tableName, partitionName string)
}

type ProcessCommand string

const (
	// During initial connection and handshake.
	ProcessCommandConnect ProcessCommand = "Connect"
	// Connected, not running a query.
	ProcessCommandSleep ProcessCommand = "Sleep"
	// Currently running a query, possibly streaming the response.
	ProcessCommandQuery ProcessCommand = "Query"
)

// Process represents a process in the SQL server.
type Process struct {
	// The time of the last Command transition
	StartedAt  time.Time
	Progress   map[string]TableProgress
	Kill       context.CancelFunc
	Host       string
	Database   string
	User       string
	Command    ProcessCommand
	Query      string
	QueryPid   uint64
	Connection uint32
}

// Done needs to be called when this process has finished.
func (p *Process) Done() { p.Kill() }

// Seconds returns the number of seconds this process has been running.
func (p *Process) Seconds() uint64 {
	return uint64(time.Since(p.StartedAt) / time.Second)
}

// Progress between done items and total items
type Progress struct {
	Name  string
	Done  int64
	Total int64
}

func (p Progress) totalString() string {
	var total = "?"
	if p.Total > 0 {
		total = fmt.Sprint(p.Total)
	}
	return total
}

// TableProgress keeps track of a table progress, and for each of its partitions
type TableProgress struct {
	PartitionsProgress map[string]PartitionProgress
	Progress
}

func NewTableProgress(name string, total int64) TableProgress {
	return TableProgress{
		Progress: Progress{
			Name:  name,
			Total: total,
		},
		PartitionsProgress: make(map[string]PartitionProgress),
	}
}

func (p TableProgress) String() string {
	return fmt.Sprintf("%s (%d/%s partitions)", p.Name, p.Done, p.totalString())
}

// PartitionProgress keeps track of a partition progress
type PartitionProgress struct {
	Progress
}

func (p PartitionProgress) String() string {
	return fmt.Sprintf("%s (%d/%s rows)", p.Name, p.Done, p.totalString())
}

// EmptyProcessList is a no-op implementation of ProcessList suitable for use in tests or other installations that
// don't require a process list
type EmptyProcessList struct{}

var _ ProcessList = EmptyProcessList{}

func (e EmptyProcessList) Processes() []Process {
	return nil
}

func (e EmptyProcessList) AddConnection(id uint32, addr string) {}
func (e EmptyProcessList) ConnectionReady(Session)              {}
func (e EmptyProcessList) RemoveConnection(uint32)              {}

func (e EmptyProcessList) BeginQuery(ctx *Context, query string) (*Context, error) {
	return ctx, nil
}
func (e EmptyProcessList) EndQuery(ctx *Context) {}
func (e EmptyProcessList) BeginOperation(ctx *Context) (*Context, error) {
	return ctx, nil
}
func (e EmptyProcessList) EndOperation(ctx *Context) {}

func (e EmptyProcessList) Kill(connID uint32)                                       {}
func (e EmptyProcessList) Done(pid uint64)                                          {}
func (e EmptyProcessList) UpdateTableProgress(pid uint64, name string, delta int64) {}
func (e EmptyProcessList) UpdatePartitionProgress(pid uint64, tableName, partitionName string, delta int64) {
}
func (e EmptyProcessList) AddTableProgress(pid uint64, name string, total int64) {}
func (e EmptyProcessList) AddPartitionProgress(pid uint64, tableName, partitionName string, total int64) {
}
func (e EmptyProcessList) RemoveTableProgress(pid uint64, name string)                         {}
func (e EmptyProcessList) RemovePartitionProgress(pid uint64, tableName, partitionName string) {}
