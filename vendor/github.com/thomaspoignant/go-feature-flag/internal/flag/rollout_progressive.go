package flag

import (
	"time"
)

// ProgressiveRollout represents how to progressively roll out a originalRule.
type ProgressiveRollout struct {
	// Initial contains a description of the initial state of the rollout.
	Initial *ProgressiveRolloutStep `json:"initial,omitempty" yaml:"initial,omitempty" toml:"initial,omitempty" jsonschema:"title=initial,description=A description of the initial state of the rollout."` // nolint: lll

	// End contains what describes the end status of the rollout.
	End *ProgressiveRolloutStep `json:"end,omitempty" yaml:"end,omitempty" toml:"end,omitempty" jsonschema:"title=initial,description=A description of the end state of the rollout."` // nolint: lll
}

// ProgressiveRolloutStep define a progressive rollout step (initial and end)
type ProgressiveRolloutStep struct {
	// Variation - name of the variation for this step
	Variation *string `json:"variation,omitempty" yaml:"variation,omitempty" toml:"variation,omitempty" jsonschema:"required,title=variation,description=Name of the variation to apply."` // nolint: lll

	// Percentage is the percentage (initial or end) for the progressive rollout
	Percentage *float64 `json:"percentage,omitempty" yaml:"percentage,omitempty" toml:"percentage,omitempty" jsonschema:"required,title=percentage,description=The percentage (initial or end) for the progressive rollout."` // nolint: lll

	// Date is the time it starts or ends.
	Date *time.Time `json:"date,omitempty" yaml:"date,omitempty" toml:"date,omitempty" jsonschema:"required,title=date,description=Date is the time it starts or ends."` // nolint: lll
}

func (p *ProgressiveRolloutStep) getVariation() string {
	if p.Variation == nil {
		return ""
	}
	return *p.Variation
}

func (p *ProgressiveRolloutStep) getPercentage() float64 {
	if p.Percentage == nil {
		return 0
	}
	return *p.Percentage
}

// mergeStep is a function that take a ProgressiveRolloutStep and update the current instance
// with all the fields that are here to be overridden.
func (p *ProgressiveRolloutStep) mergeStep(updatedStep *ProgressiveRolloutStep) {
	if updatedStep.Variation != nil {
		p.Variation = updatedStep.Variation
	}
	if updatedStep.Date != nil {
		p.Date = updatedStep.Date
	}
	if updatedStep.Percentage != nil {
		p.Percentage = updatedStep.Percentage
	}
}
