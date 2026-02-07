package templates

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	tmplhtml "html/template"
	"net/url"
	"path"
	"strconv"
	"strings"
	tmpltext "text/template"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"

	"github.com/prometheus/alertmanager/asset"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/models"
	"github.com/grafana/alerting/templates/gomplate"
	"github.com/grafana/alerting/utils"
)

type KV = template.KV
type Data = template.Data
type Template struct {
	*template.Template
	limits     Limits
	AppVersion string
}

var (
	// Provides current time. Can be overwritten in tests.
	timeNow                   = time.Now
	ErrInvalidKind            = errors.New("invalid template kind")
	ErrTemplateOutputTooLarge = errors.New("template output exceeds maximum size")
	DefaultLimits             = Limits{
		MaxTemplateOutputSize: 10 * 1024 * 1024,
	}
)

// Kind represents the type or category of a template. It is used to differentiate between various template kinds.
type Kind int

func (k Kind) String() string {
	switch k {
	case GrafanaKind:
		return "Grafana"
	case MimirKind:
		return "Mimir"
	default:
		return "Unknown"
	}
}

// validKinds is a set of all recognized template kinds
var validKinds = map[Kind]struct{}{
	GrafanaKind: {},
	MimirKind:   {},
}

// IsKnownKind checks if the provided kind is a recognized template kind
func IsKnownKind(kind Kind) bool {
	_, exists := validKinds[kind]
	return exists
}

// ValidateKind checks if the provided Kind is a valid and recognized template kind.
// Returns an error if the kind is invalid or unrecognized.
func ValidateKind(kind Kind) error {
	if !IsKnownKind(kind) {
		return fmt.Errorf("%w: %s(%d)", ErrInvalidKind, kind.String(), kind)
	}
	return nil
}

const (
	_ Kind = iota
	GrafanaKind
	MimirKind
)

type TemplateDefinition struct {
	// Name of the template. Used to identify the template in the UI and when testing.
	Name string
	// Template string that contains the template text.
	Template string
	// Kind of the template. Determines which base templates and functions are available.
	Kind Kind
}

func (t TemplateDefinition) Validate() error {
	if err := ValidateKind(t.Kind); err != nil {
		return err
	}
	// Validate template contents. We try to stick as close to what will actually happen when the templates are parsed
	// by the alertmanager as possible.
	tmpl, err := template.New(defaultOptionsPerKind(t.Kind, "grafana")...)
	if err != nil {
		return fmt.Errorf("failed to create template: %w", err)
	}
	if err := tmpl.Parse(strings.NewReader(t.Template)); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}
	return nil
}

type ExtendedAlert struct {
	Status        string             `json:"status"`
	Labels        KV                 `json:"labels"`
	Annotations   KV                 `json:"annotations"`
	StartsAt      time.Time          `json:"startsAt"`
	EndsAt        time.Time          `json:"endsAt"`
	GeneratorURL  string             `json:"generatorURL"`
	Fingerprint   string             `json:"fingerprint"`
	SilenceURL    string             `json:"silenceURL"`
	DashboardURL  string             `json:"dashboardURL"`
	PanelURL      string             `json:"panelURL"`
	RuleUID       string             `json:"ruleUID,omitempty"`
	Values        map[string]float64 `json:"values"`
	ValueString   string             `json:"valueString"` // TODO: Remove in Grafana 10
	ImageURL      string             `json:"imageURL,omitempty"`
	EmbeddedImage string             `json:"embeddedImage,omitempty"`
	OrgID         *int64             `json:"orgId,omitempty"`
	ExtraData     json.RawMessage    `json:"enrichments,omitempty"`
}

type ExtendedAlerts []ExtendedAlert

type ExtendedData struct {
	Receiver string         `json:"receiver"`
	Status   string         `json:"status"`
	Alerts   ExtendedAlerts `json:"alerts"`

	GroupLabels       KV `json:"groupLabels"`
	CommonLabels      KV `json:"commonLabels"`
	CommonAnnotations KV `json:"commonAnnotations"`

	ExternalURL string `json:"externalURL"`
	AppVersion  string `json:"appVersion,omitempty"`

	// Webhook-specific fields
	GroupKey string `json:"groupKey"`

	// Most notifiers don't truncate alerts, but a nil or zero default is safe in those cases.
	TruncatedAlerts *int `json:"truncatedAlerts,omitempty"`

	// Optional variables for templating, currently only used for webhook custom payloads.
	Vars map[string]string `json:"-"`
}

// addFuncs is a template.Option that adds functions to the function map fo the given templates.
// This differs from FuncMap in that it includes dynamic functions that require a reference to the underlying
// template, such as "tmpl".
func addFuncs(text *tmpltext.Template, html *tmplhtml.Template) {
	funcs := gomplate.FuncMap(text)

	text.Funcs(funcs)
	html.Funcs(funcs)
}

// fromContent calls Parse on all provided template content and returns the resulting Template. Content equivalent to templates.FromGlobs.
func fromContent(tmpls []string, options ...template.Option) (*template.Template, error) {
	t, err := template.New(options...)
	if err != nil {
		return nil, err
	}

	// Parse prometheus default templates. Copied from template.FromGlobs.
	defaultPrometheusTemplates := []string{"default.tmpl", "email.tmpl"}
	for _, file := range defaultPrometheusTemplates {
		f, err := asset.Assets.Open(path.Join("/templates", file))
		if err != nil {
			return nil, err
		}
		if err := t.Parse(f); err != nil {
			f.Close()
			return nil, err
		}
		f.Close()
	}

	// Parse all provided templates.
	for _, tc := range tmpls {
		err := t.Parse(strings.NewReader(tc))
		if err != nil {
			return nil, err
		}
	}
	return t, nil
}

func removePrivateItems(kv template.KV) template.KV {
	for key := range kv {
		if strings.HasPrefix(key, "__") && strings.HasSuffix(key, "__") {
			kv = kv.Remove([]string{key})
		}
	}
	return kv
}

func extendAlert(alert template.Alert, externalURL string, logger log.Logger) *ExtendedAlert {
	// remove "private" annotations & labels so they don't show up in the template
	extended := &ExtendedAlert{
		Status:       alert.Status,
		Labels:       removePrivateItems(alert.Labels),
		Annotations:  removePrivateItems(alert.Annotations),
		StartsAt:     alert.StartsAt,
		EndsAt:       alert.EndsAt,
		GeneratorURL: alert.GeneratorURL,
		Fingerprint:  alert.Fingerprint,
		RuleUID:      alert.Labels[models.RuleUIDLabel],
	}

	if alert.Annotations[models.OrgIDAnnotation] != "" {
		orgID, err := strconv.ParseInt(alert.Annotations[models.OrgIDAnnotation], 10, 0)
		if err != nil {
			level.Debug(logger).Log("msg", "failed to parse org ID annotation", "err", err.Error())
		} else {
			extended.OrgID = &orgID
		}
	}

	if generatorURL, err := url.Parse(extended.GeneratorURL); err != nil {
		level.Warn(logger).Log("msg", "failed to parse generator URL while extending template data", "url", extended.GeneratorURL, "err", err.Error())
	} else if orgID := alert.Annotations[models.OrgIDAnnotation]; len(orgID) > 0 {
		// Refactor note: We only modify the URL if there is something to add. Otherwise, the original string is kept.
		setQueryParam(generatorURL, "orgId", orgID)
		extended.GeneratorURL = generatorURL.String()
	}

	if alert.Annotations != nil {
		if s, ok := alert.Annotations[models.ValuesAnnotation]; ok {
			if err := json.Unmarshal([]byte(s), &extended.Values); err != nil {
				level.Warn(logger).Log("msg", "failed to unmarshal values annotation", "err", err.Error())
			}
		}

		// TODO: Remove in Grafana 12
		extended.ValueString = alert.Annotations[models.ValueStringAnnotation]
	}

	// fill in some grafana-specific urls
	if len(externalURL) == 0 {
		return extended
	}
	baseURL, err := url.Parse(externalURL)
	if err != nil {
		level.Warn(logger).Log("msg", "failed to parse external URL while extending template data", "url", externalURL, "err", err.Error())
		return extended
	}

	orgID := alert.Annotations[models.OrgIDAnnotation]
	if len(orgID) > 0 {
		setQueryParam(baseURL, "orgId", orgID)
	}

	if dashboardURL := generateDashboardURL(alert, *baseURL); dashboardURL != nil {
		extended.DashboardURL = dashboardURL.String()
		if panelURL := generatePanelURL(alert, *dashboardURL); panelURL != nil {
			extended.PanelURL = panelURL.String()
		}
	}
	if silenceURL := generateSilenceURL(alert, *baseURL); silenceURL != nil {
		extended.SilenceURL = silenceURL.String()
	}

	return extended
}

// generateDashboardURL generates a URL to the attached dashboard for the given alert in Grafana. Returns a new URL.
func generateDashboardURL(alert template.Alert, baseURL url.URL) *url.URL {
	dashboardUID := alert.Annotations[models.DashboardUIDAnnotation]
	if dashboardUID == "" {
		return nil
	}

	dashboardURL := baseURL.JoinPath("/d/", dashboardUID)

	if !alert.StartsAt.IsZero() {
		// Set reasonable from/to time range for the dashboard.
		from := alert.StartsAt.Add(-time.Hour).UnixMilli()
		to := alert.EndsAt.UnixMilli()
		if alert.EndsAt.IsZero() {
			to = timeNow().UnixMilli() // Firing alerts have a sanitized EndsAt time of zero, so use current time.
		}

		q := dashboardURL.Query()
		q.Set("from", fmt.Sprintf("%d", from))
		q.Set("to", fmt.Sprintf("%d", to))
		dashboardURL.RawQuery = q.Encode()
	}

	return dashboardURL
}

// generatePanelURL generates a URL to the attached dashboard panel for a given alert in Grafana. Returns a new URL.
func generatePanelURL(alert template.Alert, dashboardURL url.URL) *url.URL {
	panelID := alert.Annotations[models.PanelIDAnnotation]
	if panelID == "" {
		return nil
	}
	setQueryParam(&dashboardURL, "viewPanel", panelID)

	return &dashboardURL
}

// generateSilenceURL generates a URL to silence the given alert in Grafana. Returns a new URL.
func generateSilenceURL(alert template.Alert, baseURL url.URL) *url.URL {
	silenceURL := baseURL.JoinPath("/alerting/silence/new")

	query := silenceURL.Query()
	query.Add("alertmanager", "grafana")

	ruleUID := alert.Labels[models.RuleUIDLabel]
	if ruleUID != "" {
		query.Add("matcher", models.RuleUIDLabel+"="+ruleUID)
	}

	for _, pair := range alert.Labels.SortedPairs() {
		if strings.HasPrefix(pair.Name, "__") && strings.HasSuffix(pair.Name, "__") {
			continue
		}

		// If the alert has a rule uid available, it can more succinctly and accurately replace alertname + folder labels.
		// In addition, using rule uid is more compatible with minimal permission RBAC users as they require the rule uid to silence.
		if ruleUID != "" && (pair.Name == models.FolderTitleLabel || pair.Name == model.AlertNameLabel) {
			continue
		}

		query.Add("matcher", pair.Name+"="+pair.Value)
	}

	silenceURL.RawQuery = query.Encode()

	return silenceURL
}

// setQueryParam sets the query parameter key to value in the given URL. Modifies the URL in place.
func setQueryParam(url *url.URL, key, value string) {
	q := url.Query()
	q.Set(key, value)
	url.RawQuery = q.Encode()
}

func ExtendData(data *Data, logger log.Logger) *ExtendedData {
	alerts := make([]ExtendedAlert, 0, len(data.Alerts))

	for _, alert := range data.Alerts {
		extendedAlert := extendAlert(alert, data.ExternalURL, logger)
		alerts = append(alerts, *extendedAlert)
	}

	extended := &ExtendedData{
		Receiver:          data.Receiver,
		Status:            data.Status,
		Alerts:            alerts,
		GroupLabels:       data.GroupLabels,
		CommonLabels:      removePrivateItems(data.CommonLabels),
		CommonAnnotations: removePrivateItems(data.CommonAnnotations),

		ExternalURL: data.ExternalURL,

		Vars: make(map[string]string),
	}
	return extended
}

func TmplText(ctx context.Context, tmpl *Template, alerts []*types.Alert, l log.Logger, tmplErr *error) (func(string) string, *ExtendedData) {
	promTmplData := notify.GetTemplateData(ctx, tmpl.Template, alerts, l)
	data := ExtendData(promTmplData, l)
	data.AppVersion = tmpl.AppVersion

	if groupKey, err := notify.ExtractGroupKey(ctx); err == nil {
		data.GroupKey = groupKey.String()
	} else {
		level.Debug(l).Log("msg", "failed to extract group key from context", "err", err.Error())
	}

	return func(name string) (s string) {
		if *tmplErr != nil {
			return
		}
		s, *tmplErr = executeTextString(tmpl, name, data)
		return s
	}, data
}

// This is a copy of method ExecuteTextString of Template with addition of utils.LimitedWriter
func executeTextString(tmpl *Template, text string, data *ExtendedData) (string, error) {
	if text == "" {
		return "", nil
	}
	textTmpl, err := tmpl.Text()
	if err != nil {
		return "", err
	}
	textTmpl, err = textTmpl.New("").Option("missingkey=zero").Parse(text)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	err = textTmpl.Execute(utils.NewLimitedWriter(&buf, tmpl.limits.MaxTemplateOutputSize), data)
	if errors.Is(err, utils.ErrWriteLimitExceeded) {
		err = ErrTemplateOutputTooLarge
	}
	return buf.String(), err
}

// Firing returns the subset of alerts that are firing.
func (as ExtendedAlerts) Firing() []ExtendedAlert {
	res := []ExtendedAlert{}
	for _, a := range as {
		if a.Status == string(model.AlertFiring) {
			res = append(res, a)
		}
	}
	return res
}

// Resolved returns the subset of alerts that are resolved.
func (as ExtendedAlerts) Resolved() []ExtendedAlert {
	res := []ExtendedAlert{}
	for _, a := range as {
		if a.Status == string(model.AlertResolved) {
			res = append(res, a)
		}
	}
	return res
}
