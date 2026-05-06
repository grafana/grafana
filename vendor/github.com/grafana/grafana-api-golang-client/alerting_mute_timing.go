package gapi

import (
	"encoding/json"
	"fmt"
)

// MuteTiming represents a Grafana Alerting mute timing.
type MuteTiming struct {
	Name          string         `json:"name"`
	TimeIntervals []TimeInterval `json:"time_intervals"`
	Provenance    string         `json:"provenance,omitempty"`
}

// TimeInterval describes intervals of time using a Prometheus-defined standard.
type TimeInterval struct {
	Times       []TimeRange       `json:"times,omitempty"`
	Weekdays    []WeekdayRange    `json:"weekdays,omitempty"`
	DaysOfMonth []DayOfMonthRange `json:"days_of_month,omitempty"`
	Months      []MonthRange      `json:"months,omitempty"`
	Years       []YearRange       `json:"years,omitempty"`
	Location    Location          `json:"location,omitempty"`
}

// TimeRange represents a range of minutes within a 1440 minute day, exclusive of the End minute.
type TimeRange struct {
	StartMinute string `json:"start_time"`
	EndMinute   string `json:"end_time"`
}

// A WeekdayRange is an inclusive range of weekdays, e.g. "monday" or "tuesday:thursday".
type WeekdayRange string

// A DayOfMonthRange is an inclusive range of days, 1-31, within a month, e.g. "1" or "14:16". Negative values can be used to represent days counting from the end of a month, e.g. "-1".
type DayOfMonthRange string

// A MonthRange is an inclusive range of months, either numerical or full calendar month, e.g "1:3", "december", or "may:august".
type MonthRange string

// A YearRange is a positive inclusive range of years, e.g. "2030" or "2021:2022".
type YearRange string

// A Location time zone for the time interval in IANA time zone database, e.g. "America/New_York"
type Location string

// MuteTimings fetches all mute timings.
func (c *Client) MuteTimings() ([]MuteTiming, error) {
	mts := make([]MuteTiming, 0)
	err := c.request("GET", "/api/v1/provisioning/mute-timings", nil, nil, &mts)
	if err != nil {
		return nil, err
	}
	return mts, nil
}

// MuteTiming fetches a single mute timing, identified by its name.
func (c *Client) MuteTiming(name string) (MuteTiming, error) {
	mt := MuteTiming{}
	uri := fmt.Sprintf("/api/v1/provisioning/mute-timings/%s", name)
	err := c.request("GET", uri, nil, nil, &mt)
	return mt, err
}

// NewMuteTiming creates a new mute timing.
func (c *Client) NewMuteTiming(mt *MuteTiming) error {
	req, err := json.Marshal(mt)
	if err != nil {
		return err
	}

	return c.request("POST", "/api/v1/provisioning/mute-timings", nil, req, nil)
}

// UpdateMuteTiming updates a mute timing.
func (c *Client) UpdateMuteTiming(mt *MuteTiming) error {
	uri := fmt.Sprintf("/api/v1/provisioning/mute-timings/%s", mt.Name)
	req, err := json.Marshal(mt)
	if err != nil {
		return err
	}

	return c.request("PUT", uri, nil, req, nil)
}

// DeleteMutetiming deletes a mute timing.
func (c *Client) DeleteMuteTiming(name string) error {
	uri := fmt.Sprintf("/api/v1/provisioning/mute-timings/%s", name)
	return c.request("DELETE", uri, nil, nil, nil)
}
