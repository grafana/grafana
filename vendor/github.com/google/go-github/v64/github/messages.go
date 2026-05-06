// Copyright 2016 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// This file provides functions for validating payloads from GitHub Webhooks.
// GitHub API docs: https://developer.github.com/webhooks/securing/#validating-payloads-from-github

package github

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"mime"
	"net/http"
	"net/url"
	"reflect"
	"sort"
	"strings"
)

const (
	// sha1Prefix is the prefix used by GitHub before the HMAC hexdigest.
	sha1Prefix = "sha1"
	// sha256Prefix and sha512Prefix are provided for future compatibility.
	sha256Prefix = "sha256"
	sha512Prefix = "sha512"
	// SHA1SignatureHeader is the GitHub header key used to pass the HMAC-SHA1 hexdigest.
	SHA1SignatureHeader = "X-Hub-Signature"
	// SHA256SignatureHeader is the GitHub header key used to pass the HMAC-SHA256 hexdigest.
	SHA256SignatureHeader = "X-Hub-Signature-256"
	// EventTypeHeader is the GitHub header key used to pass the event type.
	EventTypeHeader = "X-Github-Event"
	// DeliveryIDHeader is the GitHub header key used to pass the unique ID for the webhook event.
	DeliveryIDHeader = "X-Github-Delivery"
)

var (
	// eventTypeMapping maps webhooks types to their corresponding go-github struct types.
	eventTypeMapping = map[string]interface{}{
		"branch_protection_rule":         &BranchProtectionRuleEvent{},
		"check_run":                      &CheckRunEvent{},
		"check_suite":                    &CheckSuiteEvent{},
		"code_scanning_alert":            &CodeScanningAlertEvent{},
		"commit_comment":                 &CommitCommentEvent{},
		"content_reference":              &ContentReferenceEvent{},
		"create":                         &CreateEvent{},
		"delete":                         &DeleteEvent{},
		"dependabot_alert":               &DependabotAlertEvent{},
		"deploy_key":                     &DeployKeyEvent{},
		"deployment":                     &DeploymentEvent{},
		"deployment_status":              &DeploymentStatusEvent{},
		"deployment_protection_rule":     &DeploymentProtectionRuleEvent{},
		"discussion":                     &DiscussionEvent{},
		"discussion_comment":             &DiscussionCommentEvent{},
		"fork":                           &ForkEvent{},
		"github_app_authorization":       &GitHubAppAuthorizationEvent{},
		"gollum":                         &GollumEvent{},
		"installation":                   &InstallationEvent{},
		"installation_repositories":      &InstallationRepositoriesEvent{},
		"installation_target":            &InstallationTargetEvent{},
		"issue_comment":                  &IssueCommentEvent{},
		"issues":                         &IssuesEvent{},
		"label":                          &LabelEvent{},
		"marketplace_purchase":           &MarketplacePurchaseEvent{},
		"member":                         &MemberEvent{},
		"membership":                     &MembershipEvent{},
		"merge_group":                    &MergeGroupEvent{},
		"meta":                           &MetaEvent{},
		"milestone":                      &MilestoneEvent{},
		"organization":                   &OrganizationEvent{},
		"org_block":                      &OrgBlockEvent{},
		"package":                        &PackageEvent{},
		"page_build":                     &PageBuildEvent{},
		"personal_access_token_request":  &PersonalAccessTokenRequestEvent{},
		"ping":                           &PingEvent{},
		"project":                        &ProjectEvent{},
		"project_card":                   &ProjectCardEvent{},
		"project_column":                 &ProjectColumnEvent{},
		"projects_v2":                    &ProjectV2Event{},
		"projects_v2_item":               &ProjectV2ItemEvent{},
		"public":                         &PublicEvent{},
		"pull_request":                   &PullRequestEvent{},
		"pull_request_review":            &PullRequestReviewEvent{},
		"pull_request_review_comment":    &PullRequestReviewCommentEvent{},
		"pull_request_review_thread":     &PullRequestReviewThreadEvent{},
		"pull_request_target":            &PullRequestTargetEvent{},
		"push":                           &PushEvent{},
		"repository":                     &RepositoryEvent{},
		"repository_dispatch":            &RepositoryDispatchEvent{},
		"repository_import":              &RepositoryImportEvent{},
		"repository_vulnerability_alert": &RepositoryVulnerabilityAlertEvent{},
		"release":                        &ReleaseEvent{},
		"secret_scanning_alert":          &SecretScanningAlertEvent{},
		"security_advisory":              &SecurityAdvisoryEvent{},
		"security_and_analysis":          &SecurityAndAnalysisEvent{},
		"star":                           &StarEvent{},
		"status":                         &StatusEvent{},
		"team":                           &TeamEvent{},
		"team_add":                       &TeamAddEvent{},
		"user":                           &UserEvent{},
		"watch":                          &WatchEvent{},
		"workflow_dispatch":              &WorkflowDispatchEvent{},
		"workflow_job":                   &WorkflowJobEvent{},
		"workflow_run":                   &WorkflowRunEvent{},
	}
	// forward mapping of event types to the string names of the structs
	messageToTypeName = make(map[string]string, len(eventTypeMapping))
	// Inverse map of the above
	typeToMessageMapping = make(map[string]string, len(eventTypeMapping))
)

func init() {
	for k, v := range eventTypeMapping {
		typename := reflect.TypeOf(v).Elem().Name()
		messageToTypeName[k] = typename
		typeToMessageMapping[typename] = k
	}
}

// genMAC generates the HMAC signature for a message provided the secret key
// and hashFunc.
func genMAC(message, key []byte, hashFunc func() hash.Hash) []byte {
	mac := hmac.New(hashFunc, key)
	mac.Write(message)
	return mac.Sum(nil)
}

// checkMAC reports whether messageMAC is a valid HMAC tag for message.
func checkMAC(message, messageMAC, key []byte, hashFunc func() hash.Hash) bool {
	expectedMAC := genMAC(message, key, hashFunc)
	return hmac.Equal(messageMAC, expectedMAC)
}

// messageMAC returns the hex-decoded HMAC tag from the signature and its
// corresponding hash function.
func messageMAC(signature string) ([]byte, func() hash.Hash, error) {
	if signature == "" {
		return nil, nil, errors.New("missing signature")
	}
	sigParts := strings.SplitN(signature, "=", 2)
	if len(sigParts) != 2 {
		return nil, nil, fmt.Errorf("error parsing signature %q", signature)
	}

	var hashFunc func() hash.Hash
	switch sigParts[0] {
	case sha1Prefix:
		hashFunc = sha1.New
	case sha256Prefix:
		hashFunc = sha256.New
	case sha512Prefix:
		hashFunc = sha512.New
	default:
		return nil, nil, fmt.Errorf("unknown hash type prefix: %q", sigParts[0])
	}

	buf, err := hex.DecodeString(sigParts[1])
	if err != nil {
		return nil, nil, fmt.Errorf("error decoding signature %q: %v", signature, err)
	}
	return buf, hashFunc, nil
}

// ValidatePayloadFromBody validates an incoming GitHub Webhook event request body
// and returns the (JSON) payload.
// The Content-Type header of the payload can be "application/json" or "application/x-www-form-urlencoded".
// If the Content-Type is neither then an error is returned.
// secretToken is the GitHub Webhook secret token.
// If your webhook does not contain a secret token, you can pass an empty secretToken.
// Webhooks without a secret token are not secure and should be avoided.
//
// Example usage:
//
//	func (s *GitHubEventMonitor) ServeHTTP(w http.ResponseWriter, r *http.Request) {
//	  // read signature from request
//	  signature := ""
//	  payload, err := github.ValidatePayloadFromBody(r.Header.Get("Content-Type"), r.Body, signature, s.webhookSecretKey)
//	  if err != nil { ... }
//	  // Process payload...
//	}
func ValidatePayloadFromBody(contentType string, readable io.Reader, signature string, secretToken []byte) (payload []byte, err error) {
	var body []byte // Raw body that GitHub uses to calculate the signature.

	switch contentType {
	case "application/json":
		var err error
		if body, err = io.ReadAll(readable); err != nil {
			return nil, err
		}

		// If the content type is application/json,
		// the JSON payload is just the original body.
		payload = body

	case "application/x-www-form-urlencoded":
		// payloadFormParam is the name of the form parameter that the JSON payload
		// will be in if a webhook has its content type set to application/x-www-form-urlencoded.
		const payloadFormParam = "payload"

		var err error
		if body, err = io.ReadAll(readable); err != nil {
			return nil, err
		}

		// If the content type is application/x-www-form-urlencoded,
		// the JSON payload will be under the "payload" form param.
		form, err := url.ParseQuery(string(body))
		if err != nil {
			return nil, err
		}
		payload = []byte(form.Get(payloadFormParam))

	default:
		return nil, fmt.Errorf("webhook request has unsupported Content-Type %q", contentType)
	}

	// Validate the signature if present or if one is expected (secretToken is non-empty).
	if len(secretToken) > 0 || len(signature) > 0 {
		if err := ValidateSignature(signature, body, secretToken); err != nil {
			return nil, err
		}
	}

	return payload, nil
}

// ValidatePayload validates an incoming GitHub Webhook event request
// and returns the (JSON) payload.
// The Content-Type header of the payload can be "application/json" or "application/x-www-form-urlencoded".
// If the Content-Type is neither then an error is returned.
// secretToken is the GitHub Webhook secret token.
// If your webhook does not contain a secret token, you can pass nil or an empty slice.
// This is intended for local development purposes only and all webhooks should ideally set up a secret token.
//
// Example usage:
//
//	func (s *GitHubEventMonitor) ServeHTTP(w http.ResponseWriter, r *http.Request) {
//	  payload, err := github.ValidatePayload(r, s.webhookSecretKey)
//	  if err != nil { ... }
//	  // Process payload...
//	}
func ValidatePayload(r *http.Request, secretToken []byte) (payload []byte, err error) {
	signature := r.Header.Get(SHA256SignatureHeader)
	if signature == "" {
		signature = r.Header.Get(SHA1SignatureHeader)
	}

	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil {
		return nil, err
	}

	return ValidatePayloadFromBody(contentType, r.Body, signature, secretToken)
}

// ValidateSignature validates the signature for the given payload.
// signature is the GitHub hash signature delivered in the X-Hub-Signature header.
// payload is the JSON payload sent by GitHub Webhooks.
// secretToken is the GitHub Webhook secret token.
//
// GitHub API docs: https://developer.github.com/webhooks/securing/#validating-payloads-from-github
func ValidateSignature(signature string, payload, secretToken []byte) error {
	messageMAC, hashFunc, err := messageMAC(signature)
	if err != nil {
		return err
	}
	if !checkMAC(payload, messageMAC, secretToken, hashFunc) {
		return errors.New("payload signature check failed")
	}
	return nil
}

// WebHookType returns the event type of webhook request r.
//
// GitHub API docs: https://docs.github.com/developers/webhooks-and-events/events/github-event-types
func WebHookType(r *http.Request) string {
	return r.Header.Get(EventTypeHeader)
}

// DeliveryID returns the unique delivery ID of webhook request r.
//
// GitHub API docs: https://docs.github.com/developers/webhooks-and-events/events/github-event-types
func DeliveryID(r *http.Request) string {
	return r.Header.Get(DeliveryIDHeader)
}

// ParseWebHook parses the event payload. For recognized event types, a
// value of the corresponding struct type will be returned (as returned
// by Event.ParsePayload()). An error will be returned for unrecognized event
// types.
//
// Example usage:
//
//	func (s *GitHubEventMonitor) ServeHTTP(w http.ResponseWriter, r *http.Request) {
//	  payload, err := github.ValidatePayload(r, s.webhookSecretKey)
//	  if err != nil { ... }
//	  event, err := github.ParseWebHook(github.WebHookType(r), payload)
//	  if err != nil { ... }
//	  switch event := event.(type) {
//	  case *github.CommitCommentEvent:
//	      processCommitCommentEvent(event)
//	  case *github.CreateEvent:
//	      processCreateEvent(event)
//	  ...
//	  }
//	}
func ParseWebHook(messageType string, payload []byte) (interface{}, error) {
	eventType, ok := messageToTypeName[messageType]
	if !ok {
		return nil, fmt.Errorf("unknown X-Github-Event in message: %v", messageType)
	}

	event := Event{
		Type:       &eventType,
		RawPayload: (*json.RawMessage)(&payload),
	}
	return event.ParsePayload()
}

// MessageTypes returns a sorted list of all the known GitHub event type strings
// supported by go-github.
func MessageTypes() []string {
	types := make([]string, 0, len(eventTypeMapping))
	for t := range eventTypeMapping {
		types = append(types, t)
	}
	sort.Strings(types)
	return types
}

// EventForType returns an empty struct matching the specified GitHub event type.
// If messageType does not match any known event types, it returns nil.
func EventForType(messageType string) interface{} {
	prototype := eventTypeMapping[messageType]
	if prototype == nil {
		return nil
	}
	// return a _copy_ of the pointed-to-object.  Unfortunately, for this we
	// need to use reflection.  If we store the actual objects in the map,
	// we still need to use reflection to convert from `any` to the actual
	// type, so this was deemed the lesser of two evils. (#2865)
	return reflect.New(reflect.TypeOf(prototype).Elem()).Interface()
}
