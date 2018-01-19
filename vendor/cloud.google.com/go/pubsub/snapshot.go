// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pubsub

import (
	"strings"
	"time"

	vkit "cloud.google.com/go/pubsub/apiv1"
	"golang.org/x/net/context"
)

// Snapshot is a reference to a PubSub snapshot.
type snapshot struct {
	s service

	// The fully qualified identifier for the snapshot, in the format "projects/<projid>/snapshots/<snap>"
	name string
}

// ID returns the unique identifier of the snapshot within its project.
func (s *snapshot) ID() string {
	slash := strings.LastIndex(s.name, "/")
	if slash == -1 {
		// name is not a fully-qualified name.
		panic("bad snapshot name")
	}
	return s.name[slash+1:]
}

// SnapshotConfig contains the details of a Snapshot.
type snapshotConfig struct {
	*snapshot
	Topic      *Topic
	Expiration time.Time
}

// Snapshot creates a reference to a snapshot.
func (c *Client) snapshot(id string) *snapshot {
	return &snapshot{
		s:    c.s,
		name: vkit.SubscriberSnapshotPath(c.projectID, id),
	}
}

// Snapshots returns an iterator which returns snapshots for this project.
func (c *Client) snapshots(ctx context.Context) *snapshotConfigIterator {
	return &snapshotConfigIterator{
		next: c.s.listProjectSnapshots(ctx, c.fullyQualifiedProjectName()),
	}
}

// SnapshotConfigIterator is an iterator that returns a series of snapshots.
type snapshotConfigIterator struct {
	next nextSnapshotFunc
}

// Next returns the next SnapshotConfig. Its second return value is iterator.Done if there are no more results.
// Once Next returns iterator.Done, all subsequent calls will return iterator.Done.
func (snaps *snapshotConfigIterator) Next() (*snapshotConfig, error) {
	return snaps.next()
}

// Delete deletes a snapshot.
func (snap *snapshot) delete(ctx context.Context) error {
	return snap.s.deleteSnapshot(ctx, snap.name)
}

// SeekTime seeks the subscription to a point in time.
//
// Messages retained in the subscription that were published before this
// time are marked as acknowledged, and messages retained in the
// subscription that were published after this time are marked as
// unacknowledged. Note that this operation affects only those messages
// retained in the subscription (configured by SnapshotConfig). For example,
// if `time` corresponds to a point before the message retention
// window (or to a point before the system's notion of the subscription
// creation time), only retained messages will be marked as unacknowledged,
// and already-expunged messages will not be restored.
func (s *Subscription) seekToTime(ctx context.Context, t time.Time) error {
	return s.s.seekToTime(ctx, s.name, t)
}

// Snapshot creates a new snapshot from this subscription.
// The snapshot will be for the topic this subscription is subscribed to.
// If the name is empty string, a unique name is assigned.
//
// The created snapshot is guaranteed to retain:
//  (a) The existing backlog on the subscription. More precisely, this is
//      defined as the messages in the subscription's backlog that are
//      unacknowledged when Snapshot returns without error.
//  (b) Any messages published to the subscription's topic following
//      Snapshot returning without error.
func (s *Subscription) createSnapshot(ctx context.Context, name string) (*snapshotConfig, error) {
	if name != "" {
		name = vkit.SubscriberSnapshotPath(strings.Split(s.name, "/")[1], name)
	}
	return s.s.createSnapshot(ctx, name, s.name)
}

// SeekSnapshot seeks the subscription to a snapshot.
//
// The snapshot needs not be created from this subscription,
// but the snapshot must be for the topic this subscription is subscribed to.
func (s *Subscription) seekToSnapshot(ctx context.Context, snap *snapshot) error {
	return s.s.seekToSnapshot(ctx, s.name, snap.name)
}
