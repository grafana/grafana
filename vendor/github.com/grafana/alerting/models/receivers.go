package models

import (
	"github.com/go-openapi/strfmt"
)

// Type definitions for the Grafana extended version of the /receivers API.

type Receiver struct {
	// Whether the receiver is used in a route or not.
	Active bool `json:"active"`

	// Integrations configured for this receiver.
	Integrations []Integration `json:"integrations"`

	// Name of the receiver.
	Name string `json:"name"`
}

type Integration struct {
	// A timestamp indicating the last attempt to deliver a notification regardless of the outcome.
	// Format: date-time
	LastNotifyAttempt strfmt.DateTime `json:"lastNotifyAttempt,omitempty"`

	// Duration of the last attempt to deliver a notification in humanized format (`1s` or `15ms`, etc).
	LastNotifyAttemptDuration string `json:"lastNotifyAttemptDuration,omitempty"`

	// Error string for the last attempt to deliver a notification. Empty if the last attempt was successful.
	LastNotifyAttemptError string `json:"lastNotifyAttemptError,omitempty"`

	// Name of the integration.
	Name string `json:"name"`

	// Whether the integration is configured to send resolved notifications.
	SendResolved bool `json:"sendResolved"`
}
