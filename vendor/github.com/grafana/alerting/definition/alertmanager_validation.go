package definition

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"
)

// groupByAll is a special value defined by alertmanager that can be used in a Route's GroupBy field to aggregate by all possible labels.
const groupByAll = "..."

// ValidateChild normalizes a possibly nested Route r, and returns errors if r is invalid.
func (r *Route) ValidateChild() error {
	r.GroupBy = nil
	r.GroupByAll = false
	for _, l := range r.GroupByStr {
		if l == groupByAll {
			r.GroupByAll = true
		} else {
			r.GroupBy = append(r.GroupBy, model.LabelName(l))
		}
	}

	if len(r.GroupBy) > 0 && r.GroupByAll {
		return fmt.Errorf("cannot have wildcard group_by (`...`) and other other labels at the same time")
	}

	groupBy := map[model.LabelName]struct{}{}

	for _, ln := range r.GroupBy {
		if _, ok := groupBy[ln]; ok {
			return fmt.Errorf("duplicated label %q in group_by, %s %s", ln, r.Receiver, r.GroupBy)
		}
		groupBy[ln] = struct{}{}
	}

	if r.GroupInterval != nil && time.Duration(*r.GroupInterval) == time.Duration(0) {
		return fmt.Errorf("group_interval cannot be zero")
	}
	if r.RepeatInterval != nil && time.Duration(*r.RepeatInterval) == time.Duration(0) {
		return fmt.Errorf("repeat_interval cannot be zero")
	}

	// Routes are a self-referential structure.
	if r.Routes != nil {
		for _, child := range r.Routes {
			err := child.ValidateChild()
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// Validate normalizes a Route r, and returns errors if r is an invalid root route. Root routes must satisfy a few additional conditions.
func (r *Route) Validate() error {
	if len(r.Receiver) == 0 {
		return fmt.Errorf("root route must specify a default receiver")
	}
	if len(r.Match) > 0 || len(r.MatchRE) > 0 {
		return fmt.Errorf("root route must not have any matchers")
	}
	if len(r.MuteTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any mute time intervals")
	}
	if len(r.ActiveTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any active time intervals")
	}
	return r.ValidateChild()
}

func (r *Route) ValidateReceivers(receivers map[string]struct{}) error {
	if _, exists := receivers[r.Receiver]; !exists {
		return fmt.Errorf("receiver '%s' does not exist", r.Receiver)
	}
	for _, children := range r.Routes {
		err := children.ValidateReceivers(receivers)
		if err != nil {
			return err
		}
	}
	return nil
}

// ValidateMuteTimes validates that all mute time intervals referenced by the route exist.
// TODO: Can be removed once grafana/grafan uses ValidateTimeIntervals instead.
func (r *Route) ValidateMuteTimes(timeIntervals map[string]struct{}) error {
	for _, name := range r.MuteTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("mute time interval '%s' does not exist", name)
		}
	}
	for _, child := range r.Routes {
		err := child.ValidateMuteTimes(timeIntervals)
		if err != nil {
			return err
		}
	}
	return nil
}

// ValidateTimeIntervals checks that all time intervals referenced by the route exist in the provided map.
func (r *Route) ValidateTimeIntervals(timeIntervals map[string]struct{}) error {
	for _, name := range r.MuteTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("mute time interval '%s' does not exist", name)
		}
	}
	for _, name := range r.ActiveTimeIntervals {
		if _, exists := timeIntervals[name]; !exists {
			return fmt.Errorf("active time interval '%s' does not exist", name)
		}
	}
	for _, child := range r.Routes {
		err := child.ValidateTimeIntervals(timeIntervals)
		if err != nil {
			return err
		}
	}
	return nil
}
