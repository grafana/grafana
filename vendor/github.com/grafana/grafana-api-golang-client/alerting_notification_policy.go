package gapi

import (
	"encoding/json"
	"fmt"
)

// Represents a notification routing tree in Grafana Alerting.
type NotificationPolicyTree struct {
	Receiver       string           `json:"receiver,omitempty"`
	GroupBy        []string         `json:"group_by,omitempty"`
	Routes         []SpecificPolicy `json:"routes,omitempty"`
	GroupWait      string           `json:"group_wait,omitempty"`
	GroupInterval  string           `json:"group_interval,omitempty"`
	RepeatInterval string           `json:"repeat_interval,omitempty"`
	Provenance     string           `json:"provenance,omitempty"`
}

// Represents a non-root node in a notification routing tree.
type SpecificPolicy struct {
	Receiver          string           `json:"receiver,omitempty"`
	GroupBy           []string         `json:"group_by,omitempty"`
	ObjectMatchers    Matchers         `json:"object_matchers,omitempty"`
	MuteTimeIntervals []string         `json:"mute_time_intervals,omitempty"`
	Continue          bool             `json:"continue"`
	Routes            []SpecificPolicy `json:"routes,omitempty"`
	GroupWait         string           `json:"group_wait,omitempty"`
	GroupInterval     string           `json:"group_interval,omitempty"`
	RepeatInterval    string           `json:"repeat_interval,omitempty"`
}

type Matchers []Matcher

type Matcher struct {
	Type  MatchType
	Name  string
	Value string
}

type MatchType int

const (
	MatchEqual MatchType = iota
	MatchNotEqual
	MatchRegexp
	MatchNotRegexp
)

func (m MatchType) String() string {
	typeToStr := map[MatchType]string{
		MatchEqual:     "=",
		MatchNotEqual:  "!=",
		MatchRegexp:    "=~",
		MatchNotRegexp: "!~",
	}
	if str, ok := typeToStr[m]; ok {
		return str
	}
	panic("unknown match type")
}

// UnmarshalJSON implements the json.Unmarshaler interface for Matchers.
func (m *Matchers) UnmarshalJSON(data []byte) error {
	var rawMatchers [][3]string
	if err := json.Unmarshal(data, &rawMatchers); err != nil {
		return err
	}
	for _, rawMatcher := range rawMatchers {
		var matchType MatchType
		switch rawMatcher[1] {
		case "=":
			matchType = MatchEqual
		case "!=":
			matchType = MatchNotEqual
		case "=~":
			matchType = MatchRegexp
		case "!~":
			matchType = MatchNotRegexp
		default:
			return fmt.Errorf("unsupported match type %q in matcher", rawMatcher[1])
		}

		matcher := Matcher{
			Type:  matchType,
			Name:  rawMatcher[0],
			Value: rawMatcher[2],
		}
		*m = append(*m, matcher)
	}
	return nil
}

// MarshalJSON implements the json.Marshaler interface for Matchers.
func (m Matchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make([][3]string, len(m))
	for i, matcher := range m {
		result[i] = [3]string{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return json.Marshal(result)
}

// NotificationPolicy fetches the notification policy tree.
func (c *Client) NotificationPolicyTree() (NotificationPolicyTree, error) {
	np := NotificationPolicyTree{}
	err := c.request("GET", "/api/v1/provisioning/policies", nil, nil, &np)
	return np, err
}

// SetNotificationPolicy sets the notification policy tree.
func (c *Client) SetNotificationPolicyTree(np *NotificationPolicyTree) error {
	req, err := json.Marshal(np)
	if err != nil {
		return err
	}
	return c.request("PUT", "/api/v1/provisioning/policies", nil, req, nil)
}

func (c *Client) ResetNotificationPolicyTree() error {
	return c.request("DELETE", "/api/v1/provisioning/policies", nil, nil, nil)
}
