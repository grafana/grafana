package model

// HealthResponse is the object returned by the health API
type HealthResponse struct {
	// Set to true if the HTTP server is started
	Initialized bool `json:"initialized" example:"true"`
}
