package model

import "time"

// InfoResponse is the object returned by the info API
type InfoResponse struct {
	// This is the last time when your flag file was read and store in the internal cache.
	LatestCacheRefresh time.Time `json:"cacheRefresh" example:"2022-06-13T11:22:55.941628+02:00"`
}
