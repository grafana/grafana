package alerting

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type EvalContext struct {
	Firing         bool
	IsTestRun      bool
	EvalMatches    []*EvalMatch
	Logs           []*ResultLogEntry
	Error          error
	ConditionEvals string
	StartTime      time.Time
	EndTime        time.Time
	Rule           *Rule
	log            log.Logger

	dashboardRef *m.DashboardRef

	ImagePublicUrl  string
	ImageOnDiskPath string
	NoDataFound     bool
	PrevAlertState  m.AlertStateType

	Ctx context.Context
}

func NewEvalContext(alertCtx context.Context, rule *Rule) *EvalContext {
	return &EvalContext{
		Ctx:            alertCtx,
		StartTime:      time.Now(),
		Rule:           rule,
		Logs:           make([]*ResultLogEntry, 0),
		EvalMatches:    make([]*EvalMatch, 0),
		log:            log.New("alerting.evalContext"),
		PrevAlertState: rule.State,
	}
}

type StateDescription struct {
	Color string
	Text  string
	Data  string
}

func (c *EvalContext) GetStateModel() *StateDescription {
	switch c.Rule.State {
	case m.AlertStateOK:
		return &StateDescription{
			Color: "#36a64f",
			Text:  "OK",
		}
	case m.AlertStateNoData:
		return &StateDescription{
			Color: "#888888",
			Text:  "No Data",
		}
	case m.AlertStateAlerting:
		return &StateDescription{
			Color: "#D63232",
			Text:  "Alerting",
		}
	case m.AlertStateUnknown:
		return &StateDescription{
			Color: "#888888",
			Text:  "Unknown",
		}
	default:
		panic("Unknown rule state for alert " + c.Rule.State)
	}
}

func (c *EvalContext) ShouldUpdateAlertState() bool {
	return c.Rule.State != c.PrevAlertState
}

func (a *EvalContext) GetDurationMs() float64 {
	return float64(a.EndTime.Nanosecond()-a.StartTime.Nanosecond()) / float64(1000000)
}

func (c *EvalContext) GetNotificationTitle() string {
	return "[" + c.GetStateModel().Text + "] " + c.Rule.Name
}

func (c *EvalContext) GetDashboardUID() (*m.DashboardRef, error) {
	if c.dashboardRef != nil {
		return c.dashboardRef, nil
	}

	uidQuery := &m.GetDashboardRefByIdQuery{Id: c.Rule.DashboardId}
	if err := bus.Dispatch(uidQuery); err != nil {
		return nil, err
	}

	c.dashboardRef = uidQuery.Result
	return c.dashboardRef, nil
}

const urlFormat = "%s?fullscreen=true&edit=true&tab=alert&panelId=%d&orgId=%d"

func (c *EvalContext) GetRuleUrl() (string, error) {
	if c.IsTestRun {
		return setting.AppUrl, nil
	}

	ref, err := c.GetDashboardUID()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(urlFormat, m.GetFullDashboardUrl(ref.Uid, ref.Slug), c.Rule.PanelId, c.Rule.OrgId), nil
}

// GetNewState returns the new state from the alert rule evaluation
func (c *EvalContext) GetNewState() m.AlertStateType {
	ns := getNewStateInternal(c)
	if ns != m.AlertStateAlerting || c.Rule.For == 0 {
		return ns
	}

	since := time.Since(c.Rule.LastStateChange)
	if c.PrevAlertState == m.AlertStatePending && since > c.Rule.For {
		return m.AlertStateAlerting
	}

	if c.PrevAlertState == m.AlertStateAlerting {
		return m.AlertStateAlerting
	}

	return m.AlertStatePending
}

func getNewStateInternal(c *EvalContext) m.AlertStateType {
	if c.Error != nil {
		c.log.Error("Alert Rule Result Error",
			"ruleId", c.Rule.Id,
			"name", c.Rule.Name,
			"error", c.Error,
			"changing state to", c.Rule.ExecutionErrorState.ToAlertState())

		if c.Rule.ExecutionErrorState == m.ExecutionErrorKeepState {
			return c.PrevAlertState
		}
		return c.Rule.ExecutionErrorState.ToAlertState()
	}

	if c.Firing {
		return m.AlertStateAlerting
	}

	if c.NoDataFound {
		c.log.Info("Alert Rule returned no data",
			"ruleId", c.Rule.Id,
			"name", c.Rule.Name,
			"changing state to", c.Rule.NoDataState.ToAlertState())

		if c.Rule.NoDataState == m.NoDataKeepState {
			return c.PrevAlertState
		}
		return c.Rule.NoDataState.ToAlertState()
	}

	return m.AlertStateOK
}
