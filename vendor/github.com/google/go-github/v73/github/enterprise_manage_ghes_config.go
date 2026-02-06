// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"errors"
)

// ConfigApplyOptions is a struct to hold the options for the ConfigApply API and the response.
type ConfigApplyOptions struct {
	// RunID is the ID of the run to get the status of. If empty a random one will be generated.
	RunID *string `json:"run_id,omitempty"`
}

// ConfigApplyStatus is a struct to hold the response from the ConfigApply API.
type ConfigApplyStatus struct {
	Running    *bool                    `json:"running,omitempty"`
	Successful *bool                    `json:"successful,omitempty"`
	Nodes      []*ConfigApplyStatusNode `json:"nodes"`
}

// ConfigApplyStatusNode is a struct to hold the response from the ConfigApply API.
type ConfigApplyStatusNode struct {
	Hostname   *string `json:"hostname,omitempty"`
	Running    *bool   `json:"running,omitempty"`
	Successful *bool   `json:"successful,omitempty"`
	RunID      *string `json:"run_id,omitempty"`
}

// ConfigApplyEventsOptions is used to enable pagination.
type ConfigApplyEventsOptions struct {
	LastRequestID *string `url:"last_request_id,omitempty"`
}

// ConfigApplyEvents is a struct to hold the response from the ConfigApplyEvents API.
type ConfigApplyEvents struct {
	Nodes []*ConfigApplyEventsNode `json:"nodes"`
}

// ConfigApplyEventsNode is a struct to hold the response from the ConfigApplyEvents API.
type ConfigApplyEventsNode struct {
	Node          *string                       `json:"node,omitempty"`
	LastRequestID *string                       `json:"last_request_id,omitempty"`
	Events        []*ConfigApplyEventsNodeEvent `json:"events"`
}

// ConfigApplyEventsNodeEvent is a struct to hold the response from the ConfigApplyEvents API.
type ConfigApplyEventsNodeEvent struct {
	Timestamp    *Timestamp `json:"timestamp,omitempty"`
	SeverityText *string    `json:"severity_text,omitempty"`
	Body         *string    `json:"body,omitempty"`
	EventName    *string    `json:"event_name,omitempty"`
	Topology     *string    `json:"topology,omitempty"`
	Hostname     *string    `json:"hostname,omitempty"`
	ConfigRunID  *string    `json:"config_run_id,omitempty"`
	TraceID      *string    `json:"trace_id,omitempty"`
	SpanID       *string    `json:"span_id,omitempty"`
	SpanParentID *int64     `json:"span_parent_id,omitempty"`
	SpanDepth    *int       `json:"span_depth,omitempty"`
}

// InitialConfigOptions is a struct to hold the options for the InitialConfig API.
type InitialConfigOptions struct {
	License  string `url:"license"`
	Password string `url:"password"`
}

// LicenseStatus is a struct to hold the response from the License API.
type LicenseStatus struct {
	AdvancedSecurityEnabled      *bool      `json:"advancedSecurityEnabled,omitempty"`
	AdvancedSecuritySeats        *int       `json:"advancedSecuritySeats,omitempty"`
	ClusterSupport               *bool      `json:"clusterSupport,omitempty"`
	Company                      *string    `json:"company,omitempty"`
	CroquetSupport               *bool      `json:"croquetSupport,omitempty"`
	CustomTerms                  *bool      `json:"customTerms,omitempty"`
	Evaluation                   *bool      `json:"evaluation,omitempty"`
	ExpireAt                     *Timestamp `json:"expireAt,omitempty"`
	InsightsEnabled              *bool      `json:"insightsEnabled,omitempty"`
	InsightsExpireAt             *Timestamp `json:"insightsExpireAt,omitempty"`
	LearningLabEvaluationExpires *Timestamp `json:"learningLabEvaluationExpires,omitempty"`
	LearningLabSeats             *int       `json:"learningLabSeats,omitempty"`
	Perpetual                    *bool      `json:"perpetual,omitempty"`
	ReferenceNumber              *string    `json:"referenceNumber,omitempty"`
	Seats                        *int       `json:"seats,omitempty"`
	SSHAllowed                   *bool      `json:"sshAllowed,omitempty"`
	SupportKey                   *string    `json:"supportKey,omitempty"`
	UnlimitedSeating             *bool      `json:"unlimitedSeating,omitempty"`
}

// UploadLicenseOptions is a struct to hold the options for the UploadLicense API.
type UploadLicenseOptions struct {
	License string `url:"license"`
}

// LicenseCheck is a struct to hold the response from the LicenseStatus API.
type LicenseCheck struct {
	Status *string `json:"status,omitempty"`
}

// ConfigSettings is a struct to hold the response from the Settings API.
// There are many fields that link to other structs.
type ConfigSettings struct {
	PrivateMode           *bool                          `json:"private_mode,omitempty"`
	PublicPages           *bool                          `json:"public_pages,omitempty"`
	SubdomainIsolation    *bool                          `json:"subdomain_isolation,omitempty"`
	SignupEnabled         *bool                          `json:"signup_enabled,omitempty"`
	GithubHostname        *string                        `json:"github_hostname,omitempty"`
	IdenticonsHost        *string                        `json:"identicons_host,omitempty"`
	HTTPProxy             *string                        `json:"http_proxy,omitempty"`
	AuthMode              *string                        `json:"auth_mode,omitempty"`
	ExpireSessions        *bool                          `json:"expire_sessions,omitempty"`
	AdminPassword         *string                        `json:"admin_password,omitempty"`
	ConfigurationID       *int64                         `json:"configuration_id,omitempty"`
	ConfigurationRunCount *int                           `json:"configuration_run_count,omitempty"`
	Avatar                *ConfigSettingsAvatar          `json:"avatar,omitempty"`
	Customer              *ConfigSettingsCustomer        `json:"customer,omitempty"`
	License               *ConfigSettingsLicenseSettings `json:"license,omitempty"`
	GithubSSL             *ConfigSettingsGithubSSL       `json:"github_ssl,omitempty"`
	LDAP                  *ConfigSettingsLDAP            `json:"ldap,omitempty"`
	CAS                   *ConfigSettingsCAS             `json:"cas,omitempty"`
	SAML                  *ConfigSettingsSAML            `json:"saml,omitempty"`
	GithubOAuth           *ConfigSettingsGithubOAuth     `json:"github_oauth,omitempty"`
	SMTP                  *ConfigSettingsSMTP            `json:"smtp,omitempty"`
	NTP                   *ConfigSettingsNTP             `json:"ntp,omitempty"`
	Timezone              *string                        `json:"timezone,omitempty"`
	SNMP                  *ConfigSettingsSNMP            `json:"snmp,omitempty"`
	Syslog                *ConfigSettingsSyslog          `json:"syslog,omitempty"`
	Assets                *string                        `json:"assets,omitempty"`
	Pages                 *ConfigSettingsPagesSettings   `json:"pages,omitempty"`
	Collectd              *ConfigSettingsCollectd        `json:"collectd,omitempty"`
	Mapping               *ConfigSettingsMapping         `json:"mapping,omitempty"`
	LoadBalancer          *string                        `json:"load_balancer,omitempty"`
}

// ConfigSettingsAvatar is a struct to hold the response from the Settings API.
type ConfigSettingsAvatar struct {
	Enabled *bool   `json:"enabled,omitempty"`
	URI     *string `json:"uri,omitempty"`
}

// ConfigSettingsCustomer is a struct to hold the response from the Settings API.
type ConfigSettingsCustomer struct {
	Name          *string `json:"name,omitempty"`
	Email         *string `json:"email,omitempty"`
	UUID          *string `json:"uuid,omitempty"`
	Secret        *string `json:"secret,omitempty"`
	PublicKeyData *string `json:"public_key_data,omitempty"`
}

// ConfigSettingsLicenseSettings is a struct to hold the response from the Settings API.
type ConfigSettingsLicenseSettings struct {
	Seats            *int       `json:"seats,omitempty"`
	Evaluation       *bool      `json:"evaluation,omitempty"`
	Perpetual        *bool      `json:"perpetual,omitempty"`
	UnlimitedSeating *bool      `json:"unlimited_seating,omitempty"`
	SupportKey       *string    `json:"support_key,omitempty"`
	SSHAllowed       *bool      `json:"ssh_allowed,omitempty"`
	ClusterSupport   *bool      `json:"cluster_support,omitempty"`
	ExpireAt         *Timestamp `json:"expire_at,omitempty"`
}

// ConfigSettingsGithubSSL is a struct to hold the response from the Settings API.
type ConfigSettingsGithubSSL struct {
	Enabled *bool   `json:"enabled,omitempty"`
	Cert    *string `json:"cert,omitempty"`
	Key     *string `json:"key,omitempty"`
}

// ConfigSettingsLDAP is a struct to hold the response from the Settings API.
type ConfigSettingsLDAP struct {
	Host                    *string                           `json:"host,omitempty"`
	Port                    *int                              `json:"port,omitempty"`
	Base                    []string                          `json:"base,omitempty"`
	UID                     *string                           `json:"uid,omitempty"`
	BindDN                  *string                           `json:"bind_dn,omitempty"`
	Password                *string                           `json:"password,omitempty"`
	Method                  *string                           `json:"method,omitempty"`
	SearchStrategy          *string                           `json:"search_strategy,omitempty"`
	UserGroups              []string                          `json:"user_groups,omitempty"`
	AdminGroup              *string                           `json:"admin_group,omitempty"`
	VirtualAttributeEnabled *bool                             `json:"virtual_attribute_enabled,omitempty"`
	RecursiveGroupSearch    *bool                             `json:"recursive_group_search,omitempty"`
	PosixSupport            *bool                             `json:"posix_support,omitempty"`
	UserSyncEmails          *bool                             `json:"user_sync_emails,omitempty"`
	UserSyncKeys            *bool                             `json:"user_sync_keys,omitempty"`
	UserSyncInterval        *int                              `json:"user_sync_interval,omitempty"`
	TeamSyncInterval        *int                              `json:"team_sync_interval,omitempty"`
	SyncEnabled             *bool                             `json:"sync_enabled,omitempty"`
	Reconciliation          *ConfigSettingsLDAPReconciliation `json:"reconciliation,omitempty"`
	Profile                 *ConfigSettingsLDAPProfile        `json:"profile,omitempty"`
}

// ConfigSettingsLDAPReconciliation is part of the ConfigSettingsLDAP struct.
type ConfigSettingsLDAPReconciliation struct {
	User *string `json:"user,omitempty"`
	Org  *string `json:"org,omitempty"`
}

// ConfigSettingsLDAPProfile is part of the ConfigSettingsLDAP struct.
type ConfigSettingsLDAPProfile struct {
	UID  *string `json:"uid,omitempty"`
	Name *string `json:"name,omitempty"`
	Mail *string `json:"mail,omitempty"`
	Key  *string `json:"key,omitempty"`
}

// ConfigSettingsCAS is a struct to hold the response from the Settings API.
type ConfigSettingsCAS struct {
	URL *string `json:"url,omitempty"`
}

// ConfigSettingsSAML is a struct to hold the response from the Settings API.
type ConfigSettingsSAML struct {
	SSOURL             *string `json:"sso_url,omitempty"`
	Certificate        *string `json:"certificate,omitempty"`
	CertificatePath    *string `json:"certificate_path,omitempty"`
	Issuer             *string `json:"issuer,omitempty"`
	IDPInitiatedSSO    *bool   `json:"idp_initiated_sso,omitempty"`
	DisableAdminDemote *bool   `json:"disable_admin_demote,omitempty"`
}

// ConfigSettingsGithubOAuth is a struct to hold the response from the Settings API.
type ConfigSettingsGithubOAuth struct {
	ClientID         *string `json:"client_id,omitempty"`
	ClientSecret     *string `json:"client_secret,omitempty"`
	OrganizationName *string `json:"organization_name,omitempty"`
	OrganizationTeam *string `json:"organization_team,omitempty"`
}

// ConfigSettingsSMTP is a struct to hold the response from the Settings API.
type ConfigSettingsSMTP struct {
	Enabled                 *bool   `json:"enabled,omitempty"`
	Address                 *string `json:"address,omitempty"`
	Authentication          *string `json:"authentication,omitempty"`
	Port                    *string `json:"port,omitempty"`
	Domain                  *string `json:"domain,omitempty"`
	Username                *string `json:"username,omitempty"`
	UserName                *string `json:"user_name,omitempty"`
	EnableStarttlsAuto      *bool   `json:"enable_starttls_auto,omitempty"`
	Password                *string `json:"password,omitempty"`
	DiscardToNoreplyAddress *bool   `json:"discard-to-noreply-address,omitempty"`
	SupportAddress          *string `json:"support_address,omitempty"`
	SupportAddressType      *string `json:"support_address_type,omitempty"`
	NoreplyAddress          *string `json:"noreply_address,omitempty"`
}

// ConfigSettingsNTP is a struct to hold the response from the Settings API.
type ConfigSettingsNTP struct {
	PrimaryServer   *string `json:"primary_server,omitempty"`
	SecondaryServer *string `json:"secondary_server,omitempty"`
}

// ConfigSettingsSNMP is a struct to hold the response from the Settings API.
type ConfigSettingsSNMP struct {
	Enabled   *bool   `json:"enabled,omitempty"`
	Community *string `json:"community,omitempty"`
}

// ConfigSettingsSyslog is a struct to hold the response from the Settings API.
type ConfigSettingsSyslog struct {
	Enabled      *bool   `json:"enabled,omitempty"`
	Server       *string `json:"server,omitempty"`
	ProtocolName *string `json:"protocol_name,omitempty"`
}

// ConfigSettingsPagesSettings is a struct to hold the response from the Settings API.
type ConfigSettingsPagesSettings struct {
	Enabled *bool `json:"enabled,omitempty"`
}

// ConfigSettingsCollectd is a struct to hold the response from the Settings API.
type ConfigSettingsCollectd struct {
	Enabled    *bool   `json:"enabled,omitempty"`
	Server     *string `json:"server,omitempty"`
	Port       *int    `json:"port,omitempty"`
	Encryption *string `json:"encryption,omitempty"`
	Username   *string `json:"username,omitempty"`
	Password   *string `json:"password,omitempty"`
}

// ConfigSettingsMapping is a struct to hold the response from the Settings API.
type ConfigSettingsMapping struct {
	Enabled    *bool   `json:"enabled,omitempty"`
	Tileserver *string `json:"tileserver,omitempty"`
	Basemap    *string `json:"basemap,omitempty"`
	Token      *string `json:"token,omitempty"`
}

// NodeMetadataStatus is a struct to hold the response from the NodeMetadata API.
type NodeMetadataStatus struct {
	Topology *string        `json:"topology,omitempty"`
	Nodes    []*NodeDetails `json:"nodes"`
}

// NodeDetails is a struct to hold the response from the NodeMetadata API.
type NodeDetails struct {
	Hostname     *string  `json:"hostname,omitempty"`
	UUID         *string  `json:"uuid,omitempty"`
	ClusterRoles []string `json:"cluster_roles,omitempty"`
}

// ConfigApplyEvents gets events from the command ghe-config-apply.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#list-events-from-ghe-config-apply
//
//meta:operation GET /manage/v1/config/apply/events
func (s *EnterpriseService) ConfigApplyEvents(ctx context.Context, opts *ConfigApplyEventsOptions) (*ConfigApplyEvents, *Response, error) {
	u, err := addOptions("manage/v1/config/apply/events", opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	configApplyEvents := new(ConfigApplyEvents)
	resp, err := s.client.Do(ctx, req, configApplyEvents)
	if err != nil {
		return nil, resp, err
	}

	return configApplyEvents, resp, nil
}

// InitialConfig initializes the GitHub Enterprise instance with a license and password.
// After initializing the instance, you need to run an apply to apply the configuration.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#initialize-instance-configuration-with-license-and-password
//
//meta:operation POST /manage/v1/config/init
func (s *EnterpriseService) InitialConfig(ctx context.Context, license, password string) (*Response, error) {
	u := "manage/v1/config/init"

	opts := &InitialConfigOptions{
		License:  license,
		Password: password,
	}

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// License gets the current license information for the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-enterprise-license-information
//
//meta:operation GET /manage/v1/config/license
func (s *EnterpriseService) License(ctx context.Context) ([]*LicenseStatus, *Response, error) {
	u := "manage/v1/config/license"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var licenseStatus []*LicenseStatus
	resp, err := s.client.Do(ctx, req, &licenseStatus)
	if err != nil {
		return nil, resp, err
	}

	return licenseStatus, resp, nil
}

// UploadLicense uploads a new license to the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#upload-an-enterprise-license
//
//meta:operation PUT /manage/v1/config/license
func (s *EnterpriseService) UploadLicense(ctx context.Context, license string) (*Response, error) {
	u := "manage/v1/config/license"
	opts := &UploadLicenseOptions{
		License: license,
	}
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// LicenseStatus gets the current license status for the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#check-a-license
//
//meta:operation GET /manage/v1/config/license/check
func (s *EnterpriseService) LicenseStatus(ctx context.Context) ([]*LicenseCheck, *Response, error) {
	u := "manage/v1/config/license/check"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var checks []*LicenseCheck
	resp, err := s.client.Do(ctx, req, &checks)
	if err != nil {
		return nil, resp, err
	}

	return checks, resp, nil
}

// NodeMetadata gets the metadata for all nodes in the GitHub Enterprise instance.
// This is required for clustered setups.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-ghes-node-metadata-for-all-nodes
//
//meta:operation GET /manage/v1/config/nodes
func (s *EnterpriseService) NodeMetadata(ctx context.Context, opts *NodeQueryOptions) (*NodeMetadataStatus, *Response, error) {
	u, err := addOptions("manage/v1/config/nodes", opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	status := new(NodeMetadataStatus)
	resp, err := s.client.Do(ctx, req, status)
	if err != nil {
		return nil, resp, err
	}

	return status, resp, nil
}

// Settings gets the current configuration settings for the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-ghes-settings
//
//meta:operation GET /manage/v1/config/settings
func (s *EnterpriseService) Settings(ctx context.Context) (*ConfigSettings, *Response, error) {
	u := "manage/v1/config/settings"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	configSettings := new(ConfigSettings)
	resp, err := s.client.Do(ctx, req, configSettings)
	if err != nil {
		return nil, resp, err
	}

	return configSettings, resp, nil
}

// UpdateSettings updates the configuration settings for the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#set-settings
//
//meta:operation PUT /manage/v1/config/settings
func (s *EnterpriseService) UpdateSettings(ctx context.Context, opts *ConfigSettings) (*Response, error) {
	u := "manage/v1/config/settings"

	if opts == nil {
		return nil, errors.New("opts should not be nil")
	}
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ConfigApply triggers a configuration apply run on the GitHub Enterprise instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#trigger-a-ghe-config-apply-run
//
//meta:operation POST /manage/v1/config/apply
func (s *EnterpriseService) ConfigApply(ctx context.Context, opts *ConfigApplyOptions) (*ConfigApplyOptions, *Response, error) {
	u := "manage/v1/config/apply"
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	configApplyOptions := new(ConfigApplyOptions)
	resp, err := s.client.Do(ctx, req, configApplyOptions)
	if err != nil {
		return nil, resp, err
	}
	return configApplyOptions, resp, nil
}

// ConfigApplyStatus gets the status of a ghe-config-apply run on the GitHub Enterprise instance.
// You can request lat one or specific id one.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-status-of-a-ghe-config-apply-run
//
//meta:operation GET /manage/v1/config/apply
func (s *EnterpriseService) ConfigApplyStatus(ctx context.Context, opts *ConfigApplyOptions) (*ConfigApplyStatus, *Response, error) {
	u := "manage/v1/config/apply"
	req, err := s.client.NewRequest("GET", u, opts)
	if err != nil {
		return nil, nil, err
	}

	status := new(ConfigApplyStatus)
	resp, err := s.client.Do(ctx, req, status)
	if err != nil {
		return nil, resp, err
	}
	return status, resp, nil
}
