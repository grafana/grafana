package definition

import (
	"errors"
	"fmt"
	"math"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
)

var (
	ErrNoMatchers              = errors.New("matchers must not be empty")
	ErrInvalidMatchers         = errors.New("only equality matchers are allowed")
	ErrDuplicateMatchers       = errors.New("matchers should be unique")
	ErrSubtreeMatchersConflict = errors.New("subtree matchers conflict with existing Grafana routes, merging will break existing notifications")
)

type MergeOpts struct {
	// DedupSuffix is a string suffix that will be appended to any resources (receivers or time intervals)
	// from the secondary configuration that have name conflicts with the primary configuration.
	//
	// The deduplication process works as follows:
	// 1. If a resource from the secondary config has the same name as one in the primary config,
	//    this suffix is appended to create a new name (e.g., "webhook" becomes "webhooksuffix")
	// 2. If the new name still conflicts, a sequential number is added (e.g., "webhooksuffix_01")
	// 3. All references to renamed resources are automatically updated throughout the configuration
	//
	// When left empty, only numeric suffixes will be used for deduplication (e.g., "webhook_01").
	//
	// Example usage:
	//   MergeOpts{
	//     DedupSuffix: "_secondary",  // Results in names like "webhook_secondary" or "webhook_secondary_01"
	//   }
	//
	// This field helps maintain distinct resource identities while preserving relationships
	// between components during the merge process.
	DedupSuffix string
	// SubtreeMatchers specifies a list of matchers that will be applied to the root route
	// of the routing tree being merged. These matchers are essential for properly isolating
	// and identifying alerts from the secondary configuration after merging.
	//
	// The matchers must follow these requirements:
	// - At least one matcher must be provided (cannot be empty)
	// - Each matcher must use the equality operator (labels.MatchEqual type)
	// - Each matcher name must be unique within the list
	//
	// Example usage:
	//   SubtreeMatchers: config.Matchers{
	//     {Name: "source", Value: "external", Type: labels.MatchEqual},
	//     {Name: "environment", Value: "production", Type: labels.MatchEqual},
	//   }
	//
	// These matchers will be:
	// 1. Added to the root of the secondary routing tree during merge
	// 2. Added to both source and target matchers of all inhibit rules from the secondary config
	// 3. Used to ensure alerts are properly routed after configurations are merged
	//
	// Warning: If these matchers conflict with existing routes in the primary configuration,
	// the merge operation will fail with ErrSubtreeMatchersConflict to prevent breaking
	// existing notification flows.
	SubtreeMatchers config.Matchers
}

func (o MergeOpts) Validate() error {
	if len(o.SubtreeMatchers) == 0 {
		return ErrNoMatchers
	}
	seenNames := make(map[string]struct{}, len(o.SubtreeMatchers))
	for _, matcher := range o.SubtreeMatchers {
		if _, ok := seenNames[matcher.Name]; ok {
			return ErrDuplicateMatchers
		}
		if matcher.Type != labels.MatchEqual {
			return ErrInvalidMatchers
		}
		seenNames[matcher.Name] = struct{}{}
	}
	return nil
}

// MergeResult represents the result of merging two Alertmanager configurations.
// It contains the unified configuration and maps of renamed receivers and time intervals.
type MergeResult struct {
	Config               PostableApiAlertingConfig
	RenamedReceivers     map[string]string
	RenamedTimeIntervals map[string]string
}

// Merge combines two Alertmanager configurations into a single unified configuration.
//
// The function handles three main aspects of the merge process:
//
//  1. Resource Deduplication:
//     When resources (receivers or time intervals) with identical names exist in both configurations,
//     resources from configuration "b" are renamed according to these rules:
//     - First, the MergeOpts.DedupSuffix is appended to the name
//     - If the name is still not unique, a numbered suffix is added (e.g., "_01", "_02")
//     - All references to renamed resources are automatically updated throughout the configuration
//
// 2. Route Merging:
//   - The entire routing tree from "b" is inserted as a sub-tree under the root route of "a"
//   - The sub-tree is positioned as the first route in the list of routes
//   - The MergeOpts.SubtreeMatchers are added to the root of the "b" routing tree
//   - Default timing settings (GroupWait, GroupInterval, RepeatInterval) are explicitly set
//     on the "b" route to prevent inheriting potentially unwanted defaults from the parent configuration
//   - If any existing routes in "a" would match the SubtreeMatchers, the merge will fail with
//     ErrSubtreeMatchersConflict to prevent breaking existing routing behavior
//
// 3. Inhibit Rule Merging:
//   - All inhibit rules from "b" are copied to the result
//   - MergeOpts.SubtreeMatchers are added to both source and target matchers of each
//     copied inhibit rule to maintain proper context separation
//
// Returns a MergeResult containing the merged configuration and maps of renamed resources
// that can be used to track the renaming that occurred during the merge process.
//
// Example usage:
//
//	result, err := Merge(primaryConfig, secondaryConfig, MergeOpts{
//	  DedupSuffix: "_secondary",
//	  SubtreeMatchers: config.Matchers{
//	    {Name: "source", Value: "external", Type: labels.MatchEqual},
//	  },
//	})
//
// If the merge fails with ErrSubtreeMatchersConflict, it indicates that the SubtreeMatchers
// would conflict with existing routes, potentially disrupting alert notifications. In this
// case, you should choose different SubtreeMatchers that don't overlap with existing route
// matchers.
func Merge(a, b PostableApiAlertingConfig, opts MergeOpts) (MergeResult, error) {
	if err := opts.Validate(); err != nil {
		return MergeResult{}, err
	}
	match, err := checkIfMatchersUsed(opts.SubtreeMatchers, a.Route.Routes)
	if err != nil {
		return MergeResult{}, err
	}
	if match {
		return MergeResult{}, fmt.Errorf("%w: sub tree matchers: %s", ErrSubtreeMatchersConflict, opts.SubtreeMatchers)
	}

	mergedReceivers, renamedReceivers := mergeReceivers(a.Receivers, b.Receivers, opts.DedupSuffix)

	mergedMuteTime, mergedTimeInterval, renamedTimeIntervals := mergeTimeIntervals(
		a.MuteTimeIntervals,
		a.TimeIntervals,
		b.MuteTimeIntervals,
		b.TimeIntervals,
		opts.DedupSuffix,
	)

	renameReceiversInRoutes([]*Route{b.Route}, renamedReceivers, renamedTimeIntervals)

	if a.Route == nil {
		return MergeResult{}, fmt.Errorf("cannot merge into undefined routing tree")
	}
	if b.Route == nil {
		return MergeResult{}, fmt.Errorf("cannot merge undefined routing tree")
	}
	route := mergeRoutes(*a.Route, *b.Route, opts.SubtreeMatchers)

	inhibitRules := mergeInhibitRules(a.InhibitRules, b.InhibitRules, opts.SubtreeMatchers)

	return MergeResult{
		Config: PostableApiAlertingConfig{
			Config: Config{
				Global:            nil, // Grafana does not have global.
				Route:             route,
				InhibitRules:      inhibitRules,
				MuteTimeIntervals: mergedMuteTime,
				TimeIntervals:     mergedTimeInterval,
				Templates:         nil, // we do not use this.
			},
			Receivers: mergedReceivers,
		},
		RenamedReceivers:     renamedReceivers,
		RenamedTimeIntervals: renamedTimeIntervals,
	}, nil
}

func mergeTimeIntervals(amt []config.MuteTimeInterval, ati []config.TimeInterval, bmt []config.MuteTimeInterval, bti []config.TimeInterval, suffix string) ([]config.MuteTimeInterval, []config.TimeInterval, map[string]string) {
	usedNames := make(map[string]struct{}, len(amt)+len(bti)+len(bmt)+len(ati))
	for _, r := range amt {
		usedNames[r.Name] = struct{}{}
	}
	for _, r := range ati {
		usedNames[r.Name] = struct{}{}
	}
	renamed := make(map[string]string, len(bmt)+len(bti))
	for _, r := range bmt {
		name := getUniqueName(r.Name, suffix, usedNames)
		if name != r.Name {
			renamed[r.Name] = name
			r.Name = name
		}
		amt = append(amt, r)
	}
	for _, r := range bti {
		name := getUniqueName(r.Name, suffix, usedNames)
		if name != r.Name {
			renamed[r.Name] = name
			r.Name = name
		}
		ati = append(ati, r)
	}
	return amt, ati, renamed
}

func mergeRoutes(a, b Route, matcher config.Matchers) *Route {
	// get a and b by value so we get shallow copies of the top level routes, which we can modify.
	// make sure "b" route has all defaults set explicitly to avoid inheriting "a"'s default route settings.
	defaultOpts := dispatch.DefaultRouteOpts
	if b.GroupWait == nil {
		gw := model.Duration(defaultOpts.GroupWait)
		b.GroupWait = &gw
	}
	if b.GroupInterval == nil {
		gi := model.Duration(defaultOpts.GroupInterval)
		b.GroupInterval = &gi
	}
	if b.RepeatInterval == nil {
		ri := model.Duration(defaultOpts.RepeatInterval)
		b.RepeatInterval = &ri
	}
	b.Matchers = append(b.Matchers, matcher...)
	a.Routes = append([]*Route{&b}, a.Routes...)
	return &a
}

func checkIfMatchersUsed(matchers config.Matchers, routes []*Route) (bool, error) {
	// matchers are always equality type. So we can confidently convert them to labelsSet
	// and check if they are contained in any of the routes.
	ls := make(model.LabelSet, len(matchers))
	for _, matcher := range matchers {
		ls[model.LabelName(matcher.Name)] = model.LabelValue(matcher.Value)
	}
	for _, r := range routes {
		if r == nil {
			continue
		}
		m, err := r.AllMatchers()
		if err != nil {
			return false, err
		}
		if (labels.Matchers(m)).Matches(ls) {
			return true, nil
		}

		sameNames := make(labels.Matchers, 0, len(ls))
		seenNames := make(map[string]struct{}, len(ls))
		for _, matcher := range m {
			if _, ok := ls[model.LabelName(matcher.Name)]; ok {
				sameNames = append(sameNames, matcher)
				seenNames[matcher.Name] = struct{}{}
			}
		}
		// if the route contains matchers that match ALL labels, then check if sub-matchers will match them.
		if len(seenNames) == len(ls) && sameNames.Matches(ls) {
			return true, nil
		}
	}
	return false, nil
}

func renameReceiversInRoutes(routes []*Route, renamed map[string]string, intervals map[string]string) {
	for _, r := range routes {
		if r == nil {
			continue
		}
		if r.Receiver != "" {
			if newName, ok := renamed[r.Receiver]; ok {
				r.Receiver = newName
			}
		}
		for i := range r.MuteTimeIntervals {
			if newName, ok := intervals[r.MuteTimeIntervals[i]]; ok {
				r.MuteTimeIntervals[i] = newName
			}
		}
		for i := range r.ActiveTimeIntervals {
			if newName, ok := intervals[r.ActiveTimeIntervals[i]]; ok {
				r.ActiveTimeIntervals[i] = newName
			}
		}
		renameReceiversInRoutes(r.Routes, renamed, intervals)
	}
}

func mergeInhibitRules(a, b []config.InhibitRule, matcher config.Matchers) []config.InhibitRule {
	result := make([]config.InhibitRule, 0, len(a)+len(b))
	result = append(result, a...)
	for _, rule := range b {
		rule.SourceMatchers = append(rule.SourceMatchers, matcher...)
		rule.TargetMatchers = append(rule.TargetMatchers, matcher...)
		result = append(result, rule)
	}
	return result
}

func mergeReceivers(a, b []*PostableApiReceiver, suffix string) ([]*PostableApiReceiver, map[string]string) {
	result := make([]*PostableApiReceiver, 0, len(a)+len(b))
	usedNames := make(map[string]struct{}, cap(result))
	for _, r := range a {
		usedNames[r.Name] = struct{}{}
		result = append(result, r)
	}

	renamed := make(map[string]string, len(b))

	for _, r := range b {
		name := getUniqueName(r.Name, suffix, usedNames)
		if name != r.Name {
			renamed[r.Name] = name
			r.Name = name
		}
		result = append(result, r)
		usedNames[r.Name] = struct{}{}
	}

	return result, renamed
}

func getUniqueName(name string, suffix string, usedNames map[string]struct{}) string {
	result := name
	done := false
	for i := 0; i <= math.MaxInt32; i++ {
		if _, ok := usedNames[result]; !ok {
			done = true
			break
		}
		if i == 0 {
			result = fmt.Sprintf("%s%s", name, suffix)
		} else {
			result = fmt.Sprintf("%s%s_%02d", name, suffix, i) // in case "a" has both receivers with and without a suffix
		}
	}
	if !done {
		panic(fmt.Sprintf("unable to find unique name for %s", name))
	}
	return result
}
