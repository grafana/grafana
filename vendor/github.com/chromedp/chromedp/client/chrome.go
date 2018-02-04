package client

import "fmt"

//go:generate easyjson -omit_empty -output_filename easyjson.go chrome.go

// Chrome holds connection information for a Chrome, Edge, or Safari target.
//
//easyjson:json
type Chrome struct {
	Description  string     `json:"description,omitempty"`
	DevtoolsURL  string     `json:"devtoolsFrontendUrl,omitempty"`
	ID           string     `json:"id,omitempty"`
	Title        string     `json:"title,omitempty"`
	Type         TargetType `json:"type,omitempty"`
	URL          string     `json:"url,omitempty"`
	WebsocketURL string     `json:"webSocketDebuggerUrl,omitempty"`
	FaviconURL   string     `json:"faviconURL,omitempty"`
}

// String satisfies the stringer interface.
func (c Chrome) String() string {
	return fmt.Sprintf("%s (`%s`)", c.ID, c.Title)
}

// GetID returns the target ID.
func (c *Chrome) GetID() string {
	return c.ID
}

// GetType returns the target type.
func (c *Chrome) GetType() TargetType {
	return c.Type
}

// GetWebsocketURL provides the websocket URL for the target, satisfying the
// domains.Target interface.
func (c *Chrome) GetWebsocketURL() string {
	return c.WebsocketURL
}
