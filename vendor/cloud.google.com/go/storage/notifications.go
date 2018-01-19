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

package storage

import (
	"errors"
	"fmt"
	"regexp"

	"golang.org/x/net/context"
	raw "google.golang.org/api/storage/v1"
)

// A Notification describes how to send Cloud PubSub messages when certain
// events occur in a bucket.
type Notification struct {
	//The ID of the notification.
	ID string

	// The ID of the topic to which this subscription publishes.
	TopicID string

	// The ID of the project to which the topic belongs.
	TopicProjectID string

	// Only send notifications about listed event types. If empty, send notifications
	// for all event types.
	// See https://cloud.google.com/storage/docs/pubsub-notifications#events.
	EventTypes []string

	// If present, only apply this notification configuration to object names that
	// begin with this prefix.
	ObjectNamePrefix string

	// An optional list of additional attributes to attach to each Cloud PubSub
	// message published for this notification subscription.
	CustomAttributes map[string]string

	// The contents of the message payload.
	// See https://cloud.google.com/storage/docs/pubsub-notifications#payload.
	PayloadFormat string
}

// Values for Notification.PayloadFormat.
const (
	// Send no payload with notification messages.
	NoPayload = "NONE"

	// Send object metadata as JSON with notification messages.
	JSONPayload = "JSON_API_V1"
)

// Values for Notification.EventTypes.
const (
	// Event that occurs when an object is successfully created.
	ObjectFinalizeEvent = "OBJECT_FINALIZE"

	// Event that occurs when the metadata of an existing object changes.
	ObjectMetadataUpdateEvent = "OBJECT_METADATA_UPDATE"

	// Event that occurs when an object is permanently deleted.
	ObjectDeleteEvent = "OBJECT_DELETE"

	// Event that occurs when the live version of an object becomes an
	// archived version.
	ObjectArchiveEvent = "OBJECT_ARCHIVE"
)

func toNotification(rn *raw.Notification) *Notification {
	n := &Notification{
		ID:               rn.Id,
		EventTypes:       rn.EventTypes,
		ObjectNamePrefix: rn.ObjectNamePrefix,
		CustomAttributes: rn.CustomAttributes,
		PayloadFormat:    rn.PayloadFormat,
	}
	n.TopicProjectID, n.TopicID = parseNotificationTopic(rn.Topic)
	return n
}

var topicRE = regexp.MustCompile("^//pubsub.googleapis.com/projects/([^/]+)/topics/([^/]+)")

// parseNotificationTopic extracts the project and topic IDs from from the full
// resource name returned by the service. If the name is malformed, it returns
// "?" for both IDs.
func parseNotificationTopic(nt string) (projectID, topicID string) {
	matches := topicRE.FindStringSubmatch(nt)
	if matches == nil {
		return "?", "?"
	}
	return matches[1], matches[2]
}

func toRawNotification(n *Notification) *raw.Notification {
	return &raw.Notification{
		Id: n.ID,
		Topic: fmt.Sprintf("//pubsub.googleapis.com/projects/%s/topics/%s",
			n.TopicProjectID, n.TopicID),
		EventTypes:       n.EventTypes,
		ObjectNamePrefix: n.ObjectNamePrefix,
		CustomAttributes: n.CustomAttributes,
		PayloadFormat:    string(n.PayloadFormat),
	}
}

// AddNotification adds a notification to b. You must set n's TopicProjectID, TopicID
// and PayloadFormat, and must not set its ID. The other fields are all optional. The
// returned Notification's ID can be used to refer to it.
func (b *BucketHandle) AddNotification(ctx context.Context, n *Notification) (*Notification, error) {
	if n.ID != "" {
		return nil, errors.New("storage: AddNotification: ID must not be set")
	}
	if n.TopicProjectID == "" {
		return nil, errors.New("storage: AddNotification: missing TopicProjectID")
	}
	if n.TopicID == "" {
		return nil, errors.New("storage: AddNotification: missing TopicID")
	}
	call := b.c.raw.Notifications.Insert(b.name, toRawNotification(n))
	setClientHeader(call.Header())
	if b.userProject != "" {
		call.UserProject(b.userProject)
	}
	rn, err := call.Context(ctx).Do()
	if err != nil {
		return nil, err
	}
	return toNotification(rn), nil
}

// Notifications returns all the Notifications configured for this bucket, as a map
// indexed by notification ID.
func (b *BucketHandle) Notifications(ctx context.Context) (map[string]*Notification, error) {
	call := b.c.raw.Notifications.List(b.name)
	setClientHeader(call.Header())
	if b.userProject != "" {
		call.UserProject(b.userProject)
	}
	var res *raw.Notifications
	var err error
	err = runWithRetry(ctx, func() error {
		res, err = call.Context(ctx).Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return notificationsToMap(res.Items), nil
}

func notificationsToMap(rns []*raw.Notification) map[string]*Notification {
	m := map[string]*Notification{}
	for _, rn := range rns {
		m[rn.Id] = toNotification(rn)
	}
	return m
}

// DeleteNotification deletes the notification with the given ID.
func (b *BucketHandle) DeleteNotification(ctx context.Context, id string) error {
	call := b.c.raw.Notifications.Delete(b.name, id)
	setClientHeader(call.Header())
	if b.userProject != "" {
		call.UserProject(b.userProject)
	}
	return call.Context(ctx).Do()
}
