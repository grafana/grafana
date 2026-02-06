package telebot

import "time"

type (
	// VideoChatStarted represents a service message about a video chat
	// started in the chat.
	VideoChatStarted struct{}

	// VideoChatEnded represents a service message about a video chat
	// ended in the chat.
	VideoChatEnded struct {
		Duration int `json:"duration"` // in seconds
	}

	// VideoChatParticipants represents a service message about new
	// members invited to a video chat
	VideoChatParticipants struct {
		Users []User `json:"users"`
	}

	// VideoChatScheduled represents a service message about a video chat scheduled in the chat.
	VideoChatScheduled struct {
		Unixtime int64 `json:"start_date"`
	}
)

// StartsAt returns the point when the video chat is supposed to be started by a chat administrator.
func (v *VideoChatScheduled) StartsAt() time.Time {
	return time.Unix(v.Unixtime, 0)
}
