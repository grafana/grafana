package v1

import "github.com/grafana/alerting/receivers/schema"

var pushoverSoundOptions = []schema.SelectOption{
	{
		Value: "default",
		Label: "Default",
	},
	{
		Value: "pushover",
		Label: "Pushover",
	}, {
		Value: "bike",
		Label: "Bike",
	}, {
		Value: "bugle",
		Label: "Bugle",
	}, {
		Value: "cashregister",
		Label: "Cashregister",
	}, {
		Value: "classical",
		Label: "Classical",
	}, {
		Value: "cosmic",
		Label: "Cosmic",
	}, {
		Value: "falling",
		Label: "Falling",
	}, {
		Value: "gamelan",
		Label: "Gamelan",
	}, {
		Value: "incoming",
		Label: "Incoming",
	}, {
		Value: "intermission",
		Label: "Intermission",
	}, {
		Value: "magic",
		Label: "Magic",
	}, {
		Value: "mechanical",
		Label: "Mechanical",
	}, {
		Value: "pianobar",
		Label: "Pianobar",
	}, {
		Value: "siren",
		Label: "Siren",
	}, {
		Value: "spacealarm",
		Label: "Spacealarm",
	}, {
		Value: "tugboat",
		Label: "Tugboat",
	}, {
		Value: "alien",
		Label: "Alien",
	}, {
		Value: "climb",
		Label: "Climb",
	}, {
		Value: "persistent",
		Label: "Persistent",
	}, {
		Value: "echo",
		Label: "Echo",
	}, {
		Value: "updown",
		Label: "Updown",
	}, {
		Value: "none",
		Label: "None",
	},
}

var pushoverPriorityOptions = []schema.SelectOption{
	{
		Value: "2",
		Label: "Emergency",
	},
	{
		Value: "1",
		Label: "High",
	},
	{
		Value: "0",
		Label: "Normal",
	},
	{
		Value: "-1",
		Label: "Low",
	},
	{
		Value: "-2",
		Label: "Lowest",
	},
}
