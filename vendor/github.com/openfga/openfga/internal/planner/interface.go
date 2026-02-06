package planner

import "time"

// Selector defines the interface for managing strategy selection and stats for a single key.
type Selector interface {
	Select(resolvers map[string]*PlanConfig) *PlanConfig
	UpdateStats(plan *PlanConfig, duration time.Duration)
}

// Manager defines the interface for creating and managing plans for different keys.
type Manager interface {
	GetPlanSelector(key string) Selector
	Stop()
}
