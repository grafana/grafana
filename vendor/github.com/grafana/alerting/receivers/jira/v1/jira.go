package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/go-kit/log/level"
	"github.com/prometheus/common/model"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const (
	MaxSummaryLenRunes     = 255
	MaxDescriptionLenRunes = 32767
	adfDocOverhead         = 87
)

// Notifier implements a Notifier for JIRA notifications. Can use V2 and V3 API to create issues, depending on Config.URL
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post.
//
// It supports updating existing issues if they can be found by some criteria.
// To search for issues it uses the following API endpoint:
//
//	https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post
type Notifier struct {
	*receivers.Base
	tmpl    *templates.Template
	ns      receivers.WebhookSender
	conf    Config
	retrier *notify.Retrier
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, logger log.Logger) *Notifier {
	return &Notifier{
		Base:    receivers.NewBase(meta, logger),
		ns:      sender,
		tmpl:    template,
		conf:    cfg,
		retrier: &notify.Retrier{RetryCodes: []int{http.StatusTooManyRequests}},
	}
}

// Notify implements the Notifier interface.
func (n *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	if n.conf.URL == nil {
		// This should not happen, but it's better to avoid panics.
		return false, fmt.Errorf("missing JIRA URL")
	}
	l := n.GetLogger(ctx)

	alerts := types.Alerts(as...)
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}
	logger := log.With(l, "group_key", key.Hash())
	level.Debug(logger).Log("msg", "executing Jira notification")

	existingIssue, shouldRetry, err := n.searchExistingIssue(ctx, logger, key.Hash(), alerts.HasFiring())
	if err != nil {
		return shouldRetry, fmt.Errorf("failed to look up existing issues: %w", err)
	}

	method := http.MethodPost
	path := "issue"
	if existingIssue == nil {
		// Do not create new issues for resolved alerts.
		if alerts.Status() == model.AlertResolved {
			return false, nil
		}
		level.Debug(logger).Log("msg", "create new issue")
	} else {
		path = "issue/" + url.PathEscape(existingIssue.Key)
		method = http.MethodPut
		level.Debug(logger).Log("msg", "updating existing issue", "issue_key", existingIssue.Key)
	}

	requestBody := n.prepareIssueRequestBody(ctx, logger, key.Hash(), as...)

	_, shouldRetry, err = n.doAPIRequest(ctx, method, path, requestBody, l)
	if err != nil {
		return shouldRetry, fmt.Errorf("failed to %s request to %q: %w", method, path, err)
	}

	return n.transitionIssue(ctx, logger, existingIssue, alerts.HasFiring())
}

func (n *Notifier) prepareIssueRequestBody(ctx context.Context, logger log.Logger, groupID string, as ...*types.Alert) issue {
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, n.tmpl, as, logger, &tmplErr)

	renderOrDefault := func(fieldName, template, fallback string) string {
		defer func() {
			tmplErr = nil
		}()
		result := tmpl(template)
		if tmplErr == nil {
			return result
		}
		if fallback == "" || fallback == template {
			level.Error(logger).Log("msg", "failed to render template", "err", tmplErr, "configField", fieldName, "template", template)
			return ""
		}
		level.Error(logger).Log("msg", "failed to render template, use default template", "err", tmplErr, "configField", fieldName, "template", template)
		tmplErr = nil
		result = tmpl(fallback)
		if tmplErr == nil {
			return result
		}
		level.Error(logger).Log("msg", "failed to render default template", "err", tmplErr, "configField", fieldName, "template", fallback)
		return ""
	}

	summary := renderOrDefault("summary", n.conf.Summary, DefaultSummary)
	summary, truncated := notify.TruncateInRunes(summary, MaxSummaryLenRunes)
	if truncated {
		level.Warn(logger).Log("msg", "Truncated summary", "max_runes", MaxSummaryLenRunes)
	}

	fields := &issueFields{
		Summary: summary,
		Labels:  make([]string, 0, len(n.conf.Labels)+1),
		Fields:  nil, // Will be processed below
	}

	// Process custom fields through templating
	if n.conf.Fields != nil {
		processedFields := make(map[string]any)
		for key, value := range n.conf.Fields {
			if strValue, ok := value.(string); ok {
				// Apply templating to string values
				processedFields[key] = renderOrDefault(fmt.Sprintf("fields.%s", key), strValue, strValue)
			} else {
				// Keep non-string values as-is
				processedFields[key] = value
			}
		}
		fields.Fields = processedFields
	}

	issueDescriptionString := renderOrDefault("description", n.conf.Description, DefaultDescription)
	fields.Description = n.prepareDescription(issueDescriptionString, logger)

	projectKey := strings.TrimSpace(renderOrDefault("project", n.conf.Project, ""))
	if projectKey != "" {
		fields.Project = &keyValue{Key: projectKey}
	}
	issueType := strings.TrimSpace(renderOrDefault("issue_type", n.conf.IssueType, ""))
	if issueType != "" {
		fields.Issuetype = &idNameValue{Name: issueType}
	}

	for i, label := range n.conf.Labels {
		label = strings.TrimSpace(renderOrDefault(fmt.Sprintf("labels[%d]", i), label, ""))
		if label == "" {
			continue
		}
		fields.Labels = append(fields.Labels, label)
	}
	slices.Sort(fields.Labels)

	priority := strings.TrimSpace(renderOrDefault("priority", n.conf.Priority, ""))
	if priority != "" {
		fields.Priority = &idNameValue{Name: priority}
	}

	if n.conf.DedupKeyFieldName != "" {
		if fields.Fields == nil {
			fields.Fields = make(map[string]any)
		}
		fields.Fields[fmt.Sprintf("customfield_%s", n.conf.DedupKeyFieldName)] = groupID
	} else {
		// This label is added to be able to search for an existing one.
		fields.Labels = append(fields.Labels, fmt.Sprintf("ALERT{%s}", groupID))
	}

	return issue{Fields: fields}
}

func (n *Notifier) prepareDescription(desc string, logger log.Logger) any {
	if strings.HasSuffix(strings.TrimRight(n.conf.URL.Path, "/"), "/3") {
		// V3 API supports structured description in ADF format.
		// Check if the payload is a valid JSON and assign it in that case.
		if json.Valid([]byte(desc)) {
			// We do not check the size of the description if it's structured data because we can't truncate it.
			var issueDescription any
			err := json.Unmarshal([]byte(desc), &issueDescription)
			if err == nil {
				return issueDescription
			}
			level.Warn(logger).Log("msg", "Failed to parse description as JSON. Fallback to string mode", "err", err)
		}

		// if it's just text, create a document.
		// Consider the document overhead while truncating.
		maxLen := MaxDescriptionLenRunes - adfDocOverhead
		truncatedDescr, truncated := notify.TruncateInRunes(desc, maxLen)
		if truncated {
			level.Warn(logger).Log("msg", "Truncated description", "max_runes", maxLen, "length", len(desc))
		}
		return simpleAdfDocument(truncatedDescr)
	}

	truncatedDescr, truncated := notify.TruncateInRunes(desc, MaxDescriptionLenRunes)
	if truncated {
		level.Warn(logger).Log("msg", "Truncated description", "max_runes", MaxDescriptionLenRunes, "length", len(desc))
	}
	return truncatedDescr
}

func (n *Notifier) searchExistingIssue(ctx context.Context, logger log.Logger, groupID string, firing bool) (*issue, bool, error) {
	issues, shouldRetry, err := n.searchIssues(ctx, logger, groupID, firing)
	if err != nil {
		return nil, shouldRetry, err
	}
	if len(issues) == 0 {
		level.Debug(logger).Log("msg", "found no existing issue")
		return nil, false, nil
	}
	if len(issues) > 1 {
		level.Warn(logger).Log("msg", "more than one issue matched, selecting the most recently resolved", "selected_issue", issues[0].Key)
	}
	return &issues[0], false, nil
}

// searchIssues performs a version-aware search request against Jira and returns the list of matched issues.
// It abstracts the differences between v2 (/search) and v3 (/search/jql) endpoints and response shapes.
func (n *Notifier) searchIssues(ctx context.Context, logger log.Logger, groupID string, firing bool) ([]issue, bool, error) {
	requestBody := getSearchJql(n.conf, groupID, firing)

	level.Debug(logger).Log("msg", "search for recent issues", "jql", requestBody.JQL)

	// Determine API version by the configured base URL and choose the appropriate endpoint path.
	isV3 := strings.HasSuffix(strings.TrimRight(n.conf.URL.Path, "/"), "/3")
	path := "search"
	if isV3 {
		path = "search/jql"
	}

	responseBody, shouldRetry, err := n.doAPIRequest(ctx, http.MethodPost, path, requestBody, logger)
	if err != nil {
		return nil, shouldRetry, fmt.Errorf("HTTP request to JIRA API: %w", err)
	}

	if isV3 {
		var res issueSearchResultV3
		if err := json.Unmarshal(responseBody, &res); err != nil {
			return nil, false, err
		}
		return res.Issues, false, nil
	}

	var res issueSearchResultV2
	if err := json.Unmarshal(responseBody, &res); err != nil {
		return nil, false, err
	}
	return res.Issues, false, nil
}

func getSearchJql(conf Config, groupID string, firing bool) issueSearch {
	jql := strings.Builder{}

	if conf.WontFixResolution != "" {
		jql.WriteString(fmt.Sprintf(`resolution != %q and `, conf.WontFixResolution))
	}

	// If the group is firing, do not search for closed issues unless a reopen transition is defined.
	if firing {
		if conf.ReopenTransition == "" {
			jql.WriteString(`statusCategory != Done and `)
		}
	} else {
		reopenDuration := int64(time.Duration(conf.ReopenDuration).Minutes())
		if reopenDuration != 0 {
			jql.WriteString(fmt.Sprintf(`(resolutiondate is EMPTY OR resolutiondate >= -%dm) and `, reopenDuration))
		}
	}

	alertLabel := fmt.Sprintf("ALERT{%s}", groupID)
	if conf.DedupKeyFieldName != "" {
		jql.WriteString(fmt.Sprintf(`(labels = %q or cf[%s] ~ %q) and `, alertLabel, conf.DedupKeyFieldName, groupID))
	} else {
		jql.WriteString(fmt.Sprintf(`labels = %q and `, alertLabel))
	}

	jql.WriteString(fmt.Sprintf(`project=%q order by status ASC,resolutiondate DESC`, conf.Project))

	return issueSearch{
		JQL:        jql.String(),
		MaxResults: 2,
		Fields:     []string{"status"},
	}
}

func (n *Notifier) getIssueTransitionByName(ctx context.Context, issueKey, transitionName string, logger log.Logger) (string, bool, error) {
	path := fmt.Sprintf("issue/%s/transitions", url.PathEscape(issueKey))

	responseBody, shouldRetry, err := n.doAPIRequest(ctx, http.MethodGet, path, nil, logger)
	if err != nil {
		return "", shouldRetry, err
	}

	var issueTransitions issueTransitions
	err = json.Unmarshal(responseBody, &issueTransitions)
	if err != nil {
		return "", false, err
	}

	for _, issueTransition := range issueTransitions.Transitions {
		if issueTransition.Name == transitionName {
			return issueTransition.ID, false, nil
		}
	}

	return "", false, fmt.Errorf("can't find transition %s for issue %s", transitionName, issueKey)
}

func (n *Notifier) transitionIssue(ctx context.Context, logger log.Logger, i *issue, firing bool) (bool, error) {
	if i == nil || i.Key == "" || i.Fields == nil || i.Fields.Status == nil {
		return false, nil
	}
	logger = log.With(logger, "issue_key", i.Key, "firing", firing)
	var transition string
	if firing {
		if i.Fields.Status.StatusCategory.Key != "done" {
			return false, nil
		}
		if n.conf.ReopenTransition == "" {
			level.Debug(logger).Log("msg", "no reopen transition is specified. Skipping reopen the issue.")
			return false, nil
		}
		transition = n.conf.ReopenTransition
	} else {
		if i.Fields.Status.StatusCategory.Key == "done" {
			return false, nil
		}
		if n.conf.ResolveTransition == "" {
			level.Debug(logger).Log("msg", "no resolve transition is specified. Skipping transition to resolve")
			return false, nil
		}
		transition = n.conf.ResolveTransition
	}

	transitionID, shouldRetry, err := n.getIssueTransitionByName(ctx, i.Key, transition, logger)
	if err != nil {
		return shouldRetry, err
	}

	requestBody := issue{
		Transition: &idNameValue{
			ID: transitionID,
		},
	}

	path := fmt.Sprintf("issue/%s/transitions", url.PathEscape(i.Key))

	level.Debug(logger).Log("msg", "transitions jira issue", "issue_key", i.Key, "transition", transition)
	_, shouldRetry, err = n.doAPIRequest(ctx, http.MethodPost, path, requestBody, logger)

	return shouldRetry, err
}

func (n *Notifier) doAPIRequest(ctx context.Context, method, path string, requestBody any, logger log.Logger) ([]byte, bool, error) {
	body, err := json.Marshal(requestBody)
	if err != nil {
		return nil, false, fmt.Errorf("failed to marshal request body: %w", err)
	}

	headers := make(map[string]string, 3)
	headers["Content-Type"] = "application/json"
	headers["Accept-Language"] = "en"
	if n.conf.Token != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", n.conf.Token)
	}

	var shouldRetry bool
	var responseBody []byte
	err = n.ns.SendWebhook(ctx, logger, &receivers.SendWebhookSettings{
		URL:         n.conf.URL.JoinPath(path).String(),
		User:        n.conf.User,
		Password:    n.conf.Password,
		Body:        string(body),
		HTTPMethod:  method,
		HTTPHeader:  headers,
		ContentType: "application/json",
		Validation: func(body []byte, code int) error {
			responseBody = body
			shouldRetry, err = n.retrier.Check(code, bytes.NewReader(body))
			return err
		},
	})
	if err != nil {
		return nil, shouldRetry, err
	}
	return responseBody, false, nil
}

func (n *Notifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
