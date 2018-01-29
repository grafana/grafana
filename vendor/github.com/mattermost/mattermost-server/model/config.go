// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	CONN_SECURITY_NONE     = ""
	CONN_SECURITY_PLAIN    = "PLAIN"
	CONN_SECURITY_TLS      = "TLS"
	CONN_SECURITY_STARTTLS = "STARTTLS"

	IMAGE_DRIVER_LOCAL = "local"
	IMAGE_DRIVER_S3    = "amazons3"

	DATABASE_DRIVER_MYSQL    = "mysql"
	DATABASE_DRIVER_POSTGRES = "postgres"

	MINIO_ACCESS_KEY = "minioaccesskey"
	MINIO_SECRET_KEY = "miniosecretkey"
	MINIO_BUCKET     = "mattermost-test"

	PASSWORD_MAXIMUM_LENGTH = 64
	PASSWORD_MINIMUM_LENGTH = 5

	SERVICE_GITLAB    = "gitlab"
	SERVICE_GOOGLE    = "google"
	SERVICE_OFFICE365 = "office365"

	WEBSERVER_MODE_REGULAR  = "regular"
	WEBSERVER_MODE_GZIP     = "gzip"
	WEBSERVER_MODE_DISABLED = "disabled"

	GENERIC_NO_CHANNEL_NOTIFICATION = "generic_no_channel"
	GENERIC_NOTIFICATION            = "generic"
	FULL_NOTIFICATION               = "full"

	DIRECT_MESSAGE_ANY  = "any"
	DIRECT_MESSAGE_TEAM = "team"

	SHOW_USERNAME          = "username"
	SHOW_NICKNAME_FULLNAME = "nickname_full_name"
	SHOW_FULLNAME          = "full_name"

	PERMISSIONS_ALL           = "all"
	PERMISSIONS_CHANNEL_ADMIN = "channel_admin"
	PERMISSIONS_TEAM_ADMIN    = "team_admin"
	PERMISSIONS_SYSTEM_ADMIN  = "system_admin"

	FAKE_SETTING = "********************************"

	RESTRICT_EMOJI_CREATION_ALL          = "all"
	RESTRICT_EMOJI_CREATION_ADMIN        = "admin"
	RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN = "system_admin"

	PERMISSIONS_DELETE_POST_ALL          = "all"
	PERMISSIONS_DELETE_POST_TEAM_ADMIN   = "team_admin"
	PERMISSIONS_DELETE_POST_SYSTEM_ADMIN = "system_admin"

	ALLOW_EDIT_POST_ALWAYS     = "always"
	ALLOW_EDIT_POST_NEVER      = "never"
	ALLOW_EDIT_POST_TIME_LIMIT = "time_limit"

	EMAIL_BATCHING_BUFFER_SIZE = 256
	EMAIL_BATCHING_INTERVAL    = 30

	EMAIL_NOTIFICATION_CONTENTS_FULL    = "full"
	EMAIL_NOTIFICATION_CONTENTS_GENERIC = "generic"

	SITENAME_MAX_LENGTH = 30

	SERVICE_SETTINGS_DEFAULT_SITE_URL           = ""
	SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE      = ""
	SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE       = ""
	SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT       = 300
	SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT      = 300
	SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS = 10
	SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM    = ""
	SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS = ":8065"

	TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM       = 50
	TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT        = ""
	TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT  = ""
	TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT = 300

	SQL_SETTINGS_DEFAULT_DATA_SOURCE = "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s"

	EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION = ""

	SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK      = "https://about.mattermost.com/default-terms/"
	SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK        = "https://about.mattermost.com/default-privacy-policy/"
	SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK                 = "https://about.mattermost.com/default-about/"
	SUPPORT_SETTINGS_DEFAULT_HELP_LINK                  = "https://about.mattermost.com/default-help/"
	SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK      = "https://about.mattermost.com/default-report-a-problem/"
	SUPPORT_SETTINGS_DEFAULT_ADMINISTRATORS_GUIDE_LINK  = "https://about.mattermost.com/administrators-guide/"
	SUPPORT_SETTINGS_DEFAULT_TROUBLESHOOTING_FORUM_LINK = "https://about.mattermost.com/troubleshooting-forum/"
	SUPPORT_SETTINGS_DEFAULT_COMMERCIAL_SUPPORT_LINK    = "https://about.mattermost.com/commercial-support/"
	SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL              = "feedback@mattermost.com"

	LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE = ""
	LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE  = ""
	LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE      = ""
	LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE         = ""
	LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME     = ""

	SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE = ""
	SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE  = ""
	SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE      = ""
	SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE     = ""
	SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE   = ""

	NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK         = "https://about.mattermost.com/downloads/"
	NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK = "https://about.mattermost.com/mattermost-android-app/"
	NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK     = "https://about.mattermost.com/mattermost-ios-app/"

	WEBRTC_SETTINGS_DEFAULT_STUN_URI = ""
	WEBRTC_SETTINGS_DEFAULT_TURN_URI = ""

	ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS = 2500

	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR      = "#f2a93b"
	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR = "#333333"

	TEAM_SETTINGS_DEFAULT_TEAM_TEXT = "default"

	ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL                    = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME                          = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD                          = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS               = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS                 = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS        = 365
	ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME   = "03:00"
	ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX                      = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE          = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS = 3600
	ELASTICSEARCH_SETTINGS_DEFAULT_REQUEST_TIMEOUT_SECONDS           = 30

	DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS  = 365
	DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS     = 365
	DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME = "02:00"

	PLUGIN_SETTINGS_DEFAULT_DIRECTORY        = "./plugins"
	PLUGIN_SETTINGS_DEFAULT_CLIENT_DIRECTORY = "./client/plugins"
)

type ServiceSettings struct {
	SiteURL                                  *string
	LicenseFileLocation                      *string
	ListenAddress                            *string
	ConnectionSecurity                       *string
	TLSCertFile                              *string
	TLSKeyFile                               *string
	UseLetsEncrypt                           *bool
	LetsEncryptCertificateCacheFile          *string
	Forward80To443                           *bool
	ReadTimeout                              *int
	WriteTimeout                             *int
	MaximumLoginAttempts                     *int
	GoroutineHealthThreshold                 *int
	GoogleDeveloperKey                       string
	EnableOAuthServiceProvider               bool
	EnableIncomingWebhooks                   bool
	EnableOutgoingWebhooks                   bool
	EnableCommands                           *bool
	EnableOnlyAdminIntegrations              *bool
	EnablePostUsernameOverride               bool
	EnablePostIconOverride                   bool
	EnableAPIv3                              *bool
	EnableLinkPreviews                       *bool
	EnableTesting                            bool
	EnableDeveloper                          *bool
	EnableSecurityFixAlert                   *bool
	EnableInsecureOutgoingConnections        *bool
	AllowedUntrustedInternalConnections      *string
	EnableMultifactorAuthentication          *bool
	EnforceMultifactorAuthentication         *bool
	EnableUserAccessTokens                   *bool
	AllowCorsFrom                            *string
	SessionLengthWebInDays                   *int
	SessionLengthMobileInDays                *int
	SessionLengthSSOInDays                   *int
	SessionCacheInMinutes                    *int
	SessionIdleTimeoutInMinutes              *int
	WebsocketSecurePort                      *int
	WebsocketPort                            *int
	WebserverMode                            *string
	EnableCustomEmoji                        *bool
	EnableEmojiPicker                        *bool
	RestrictCustomEmojiCreation              *string
	RestrictPostDelete                       *string
	AllowEditPost                            *string
	PostEditTimeLimit                        *int
	TimeBetweenUserTypingUpdatesMilliseconds *int64
	EnablePostSearch                         *bool
	EnableUserTypingMessages                 *bool
	EnableChannelViewedMessages              *bool
	EnableUserStatuses                       *bool
	ExperimentalEnableAuthenticationTransfer *bool
	ClusterLogTimeoutMilliseconds            *int
	CloseUnusedDirectMessages                *bool
	EnablePreviewFeatures                    *bool
	EnableTutorial                           *bool
}

func (s *ServiceSettings) SetDefaults() {
	if s.SiteURL == nil {
		s.SiteURL = NewString(SERVICE_SETTINGS_DEFAULT_SITE_URL)
	}

	if s.LicenseFileLocation == nil {
		s.LicenseFileLocation = NewString("")
	}

	if s.ListenAddress == nil {
		s.ListenAddress = NewString(SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS)
	}

	if s.EnableAPIv3 == nil {
		s.EnableAPIv3 = NewBool(true)
	}

	if s.EnableLinkPreviews == nil {
		s.EnableLinkPreviews = NewBool(false)
	}

	if s.EnableDeveloper == nil {
		s.EnableDeveloper = NewBool(false)
	}

	if s.EnableSecurityFixAlert == nil {
		s.EnableSecurityFixAlert = NewBool(true)
	}

	if s.EnableInsecureOutgoingConnections == nil {
		s.EnableInsecureOutgoingConnections = NewBool(false)
	}

	if s.AllowedUntrustedInternalConnections == nil {
		s.AllowedUntrustedInternalConnections = new(string)
	}

	if s.EnableMultifactorAuthentication == nil {
		s.EnableMultifactorAuthentication = NewBool(false)
	}

	if s.EnforceMultifactorAuthentication == nil {
		s.EnforceMultifactorAuthentication = NewBool(false)
	}

	if s.EnableUserAccessTokens == nil {
		s.EnableUserAccessTokens = NewBool(false)
	}

	if s.GoroutineHealthThreshold == nil {
		s.GoroutineHealthThreshold = NewInt(-1)
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewString("")
	}

	if s.TLSKeyFile == nil {
		s.TLSKeyFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE)
	}

	if s.TLSCertFile == nil {
		s.TLSCertFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE)
	}

	if s.UseLetsEncrypt == nil {
		s.UseLetsEncrypt = NewBool(false)
	}

	if s.LetsEncryptCertificateCacheFile == nil {
		s.LetsEncryptCertificateCacheFile = NewString("./config/letsencrypt.cache")
	}

	if s.ReadTimeout == nil {
		s.ReadTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT)
	}

	if s.WriteTimeout == nil {
		s.WriteTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT)
	}

	if s.MaximumLoginAttempts == nil {
		s.MaximumLoginAttempts = NewInt(SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS)
	}

	if s.Forward80To443 == nil {
		s.Forward80To443 = NewBool(false)
	}

	if s.TimeBetweenUserTypingUpdatesMilliseconds == nil {
		s.TimeBetweenUserTypingUpdatesMilliseconds = NewInt64(5000)
	}

	if s.EnablePostSearch == nil {
		s.EnablePostSearch = NewBool(true)
	}

	if s.EnableUserTypingMessages == nil {
		s.EnableUserTypingMessages = NewBool(true)
	}

	if s.EnableChannelViewedMessages == nil {
		s.EnableChannelViewedMessages = NewBool(true)
	}

	if s.EnableUserStatuses == nil {
		s.EnableUserStatuses = NewBool(true)
	}

	if s.ClusterLogTimeoutMilliseconds == nil {
		s.ClusterLogTimeoutMilliseconds = NewInt(2000)
	}

	if s.CloseUnusedDirectMessages == nil {
		s.CloseUnusedDirectMessages = NewBool(false)
	}

	if s.EnableTutorial == nil {
		s.EnableTutorial = NewBool(true)
	}

	if s.SessionLengthWebInDays == nil {
		s.SessionLengthWebInDays = NewInt(30)
	}

	if s.SessionLengthMobileInDays == nil {
		s.SessionLengthMobileInDays = NewInt(30)
	}

	if s.SessionLengthSSOInDays == nil {
		s.SessionLengthSSOInDays = NewInt(30)
	}

	if s.SessionCacheInMinutes == nil {
		s.SessionCacheInMinutes = NewInt(10)
	}

	if s.SessionIdleTimeoutInMinutes == nil {
		s.SessionIdleTimeoutInMinutes = NewInt(0)
	}

	if s.EnableCommands == nil {
		s.EnableCommands = NewBool(false)
	}

	if s.EnableOnlyAdminIntegrations == nil {
		s.EnableOnlyAdminIntegrations = NewBool(true)
	}

	if s.WebsocketPort == nil {
		s.WebsocketPort = NewInt(80)
	}

	if s.WebsocketSecurePort == nil {
		s.WebsocketSecurePort = NewInt(443)
	}

	if s.AllowCorsFrom == nil {
		s.AllowCorsFrom = NewString(SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM)
	}

	if s.WebserverMode == nil {
		s.WebserverMode = NewString("gzip")
	} else if *s.WebserverMode == "regular" {
		*s.WebserverMode = "gzip"
	}

	if s.EnableCustomEmoji == nil {
		s.EnableCustomEmoji = NewBool(false)
	}

	if s.EnableEmojiPicker == nil {
		s.EnableEmojiPicker = NewBool(true)
	}

	if s.RestrictCustomEmojiCreation == nil {
		s.RestrictCustomEmojiCreation = NewString(RESTRICT_EMOJI_CREATION_ALL)
	}

	if s.RestrictPostDelete == nil {
		s.RestrictPostDelete = NewString(PERMISSIONS_DELETE_POST_ALL)
	}

	if s.AllowEditPost == nil {
		s.AllowEditPost = NewString(ALLOW_EDIT_POST_ALWAYS)
	}

	if s.ExperimentalEnableAuthenticationTransfer == nil {
		s.ExperimentalEnableAuthenticationTransfer = NewBool(true)
	}

	if s.PostEditTimeLimit == nil {
		s.PostEditTimeLimit = NewInt(300)
	}

	if s.EnablePreviewFeatures == nil {
		s.EnablePreviewFeatures = NewBool(true)
	}
}

type ClusterSettings struct {
	Enable                *bool
	ClusterName           *string
	OverrideHostname      *string
	UseIpAddress          *bool
	UseExperimentalGossip *bool
	ReadOnlyConfig        *bool
	GossipPort            *int
	StreamingPort         *int
}

func (s *ClusterSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.ClusterName == nil {
		s.ClusterName = NewString("")
	}

	if s.OverrideHostname == nil {
		s.OverrideHostname = NewString("")
	}

	if s.UseIpAddress == nil {
		s.UseIpAddress = NewBool(true)
	}

	if s.UseExperimentalGossip == nil {
		s.UseExperimentalGossip = NewBool(false)
	}

	if s.ReadOnlyConfig == nil {
		s.ReadOnlyConfig = NewBool(true)
	}

	if s.GossipPort == nil {
		s.GossipPort = NewInt(8074)
	}

	if s.StreamingPort == nil {
		s.StreamingPort = NewInt(8075)
	}
}

type MetricsSettings struct {
	Enable           *bool
	BlockProfileRate *int
	ListenAddress    *string
}

func (s *MetricsSettings) SetDefaults() {
	if s.ListenAddress == nil {
		s.ListenAddress = NewString(":8067")
	}

	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.BlockProfileRate == nil {
		s.BlockProfileRate = NewInt(0)
	}
}

type AnalyticsSettings struct {
	MaxUsersForStatistics *int
}

func (s *AnalyticsSettings) SetDefaults() {
	if s.MaxUsersForStatistics == nil {
		s.MaxUsersForStatistics = NewInt(ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS)
	}
}

type SSOSettings struct {
	Enable          bool
	Secret          string
	Id              string
	Scope           string
	AuthEndpoint    string
	TokenEndpoint   string
	UserApiEndpoint string
}

type SqlSettings struct {
	DriverName               *string
	DataSource               *string
	DataSourceReplicas       []string
	DataSourceSearchReplicas []string
	MaxIdleConns             *int
	MaxOpenConns             *int
	Trace                    bool
	AtRestEncryptKey         string
	QueryTimeout             *int
}

func (s *SqlSettings) SetDefaults() {
	if s.DriverName == nil {
		s.DriverName = NewString(DATABASE_DRIVER_MYSQL)
	}

	if s.DataSource == nil {
		s.DataSource = NewString(SQL_SETTINGS_DEFAULT_DATA_SOURCE)
	}

	if len(s.AtRestEncryptKey) == 0 {
		s.AtRestEncryptKey = NewRandomString(32)
	}

	if s.MaxIdleConns == nil {
		s.MaxIdleConns = NewInt(20)
	}

	if s.MaxOpenConns == nil {
		s.MaxOpenConns = NewInt(300)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewInt(30)
	}
}

type LogSettings struct {
	EnableConsole          bool
	ConsoleLevel           string
	EnableFile             bool
	FileLevel              string
	FileFormat             string
	FileLocation           string
	EnableWebhookDebugging bool
	EnableDiagnostics      *bool
}

func (s *LogSettings) SetDefaults() {
	if s.EnableDiagnostics == nil {
		s.EnableDiagnostics = NewBool(true)
	}
}

type PasswordSettings struct {
	MinimumLength *int
	Lowercase     *bool
	Number        *bool
	Uppercase     *bool
	Symbol        *bool
}

func (s *PasswordSettings) SetDefaults() {
	if s.MinimumLength == nil {
		s.MinimumLength = NewInt(PASSWORD_MINIMUM_LENGTH)
	}

	if s.Lowercase == nil {
		s.Lowercase = NewBool(false)
	}

	if s.Number == nil {
		s.Number = NewBool(false)
	}

	if s.Uppercase == nil {
		s.Uppercase = NewBool(false)
	}

	if s.Symbol == nil {
		s.Symbol = NewBool(false)
	}
}

type FileSettings struct {
	EnableFileAttachments   *bool
	EnableMobileUpload      *bool
	EnableMobileDownload    *bool
	MaxFileSize             *int64
	DriverName              *string
	Directory               string
	EnablePublicLink        bool
	PublicLinkSalt          *string
	InitialFont             string
	AmazonS3AccessKeyId     string
	AmazonS3SecretAccessKey string
	AmazonS3Bucket          string
	AmazonS3Region          string
	AmazonS3Endpoint        string
	AmazonS3SSL             *bool
	AmazonS3SignV2          *bool
	AmazonS3SSE             *bool
	AmazonS3Trace           *bool
}

func (s *FileSettings) SetDefaults() {
	if s.DriverName == nil {
		s.DriverName = NewString(IMAGE_DRIVER_LOCAL)
	}

	if s.AmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		s.AmazonS3Endpoint = "s3.amazonaws.com"
	}

	if s.AmazonS3SSL == nil {
		s.AmazonS3SSL = NewBool(true) // Secure by default.
	}

	if s.AmazonS3SignV2 == nil {
		s.AmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if s.AmazonS3SSE == nil {
		s.AmazonS3SSE = NewBool(false) // Not Encrypted by default.
	}

	if s.AmazonS3Trace == nil {
		s.AmazonS3Trace = NewBool(false)
	}

	if s.EnableFileAttachments == nil {
		s.EnableFileAttachments = NewBool(true)
	}

	if s.EnableMobileUpload == nil {
		s.EnableMobileUpload = NewBool(true)
	}

	if s.EnableMobileDownload == nil {
		s.EnableMobileDownload = NewBool(true)
	}

	if s.MaxFileSize == nil {
		s.MaxFileSize = NewInt64(52428800) // 50 MB
	}

	if s.PublicLinkSalt == nil || len(*s.PublicLinkSalt) == 0 {
		s.PublicLinkSalt = NewString(NewRandomString(32))
	}

	if s.InitialFont == "" {
		// Defaults to "luximbi.ttf"
		s.InitialFont = "luximbi.ttf"
	}

	if s.Directory == "" {
		s.Directory = "./data/"
	}
}

type EmailSettings struct {
	EnableSignUpWithEmail             bool
	EnableSignInWithEmail             *bool
	EnableSignInWithUsername          *bool
	SendEmailNotifications            bool
	UseChannelInEmailNotifications    *bool
	RequireEmailVerification          bool
	FeedbackName                      string
	FeedbackEmail                     string
	FeedbackOrganization              *string
	EnableSMTPAuth                    *bool
	SMTPUsername                      string
	SMTPPassword                      string
	SMTPServer                        string
	SMTPPort                          string
	ConnectionSecurity                string
	InviteSalt                        string
	SendPushNotifications             *bool
	PushNotificationServer            *string
	PushNotificationContents          *string
	EnableEmailBatching               *bool
	EmailBatchingBufferSize           *int
	EmailBatchingInterval             *int
	SkipServerCertificateVerification *bool
	EmailNotificationContentsType     *string
	LoginButtonColor                  *string
	LoginButtonBorderColor            *string
	LoginButtonTextColor              *string
}

func (s *EmailSettings) SetDefaults() {
	if len(s.InviteSalt) == 0 {
		s.InviteSalt = NewRandomString(32)
	}

	if s.EnableSignInWithEmail == nil {
		s.EnableSignInWithEmail = NewBool(s.EnableSignUpWithEmail)
	}

	if s.EnableSignInWithUsername == nil {
		s.EnableSignInWithUsername = NewBool(false)
	}

	if s.UseChannelInEmailNotifications == nil {
		s.UseChannelInEmailNotifications = NewBool(false)
	}

	if s.SendPushNotifications == nil {
		s.SendPushNotifications = NewBool(false)
	}

	if s.PushNotificationServer == nil {
		s.PushNotificationServer = NewString("")
	}

	if s.PushNotificationContents == nil {
		s.PushNotificationContents = NewString(GENERIC_NOTIFICATION)
	}

	if s.FeedbackOrganization == nil {
		s.FeedbackOrganization = NewString(EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION)
	}

	if s.EnableEmailBatching == nil {
		s.EnableEmailBatching = NewBool(false)
	}

	if s.EmailBatchingBufferSize == nil {
		s.EmailBatchingBufferSize = NewInt(EMAIL_BATCHING_BUFFER_SIZE)
	}

	if s.EmailBatchingInterval == nil {
		s.EmailBatchingInterval = NewInt(EMAIL_BATCHING_INTERVAL)
	}

	if s.EnableSMTPAuth == nil {
		s.EnableSMTPAuth = new(bool)
		if s.ConnectionSecurity == CONN_SECURITY_NONE {
			*s.EnableSMTPAuth = false
		} else {
			*s.EnableSMTPAuth = true
		}
	}

	if s.ConnectionSecurity == CONN_SECURITY_PLAIN {
		s.ConnectionSecurity = CONN_SECURITY_NONE
	}

	if s.SkipServerCertificateVerification == nil {
		s.SkipServerCertificateVerification = NewBool(false)
	}

	if s.EmailNotificationContentsType == nil {
		s.EmailNotificationContentsType = NewString(EMAIL_NOTIFICATION_CONTENTS_FULL)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#2389D7")
	}
}

type RateLimitSettings struct {
	Enable           *bool
	PerSec           *int
	MaxBurst         *int
	MemoryStoreSize  *int
	VaryByRemoteAddr bool
	VaryByHeader     string
}

func (s *RateLimitSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.PerSec == nil {
		s.PerSec = NewInt(10)
	}

	if s.MaxBurst == nil {
		s.MaxBurst = NewInt(100)
	}

	if s.MemoryStoreSize == nil {
		s.MemoryStoreSize = NewInt(10000)
	}
}

type PrivacySettings struct {
	ShowEmailAddress bool
	ShowFullName     bool
}

type SupportSettings struct {
	TermsOfServiceLink *string
	PrivacyPolicyLink  *string
	AboutLink          *string
	HelpLink           *string
	ReportAProblemLink *string
	SupportEmail       *string
}

func (s *SupportSettings) SetDefaults() {
	if !IsSafeLink(s.TermsOfServiceLink) {
		*s.TermsOfServiceLink = SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK
	}

	if s.TermsOfServiceLink == nil {
		s.TermsOfServiceLink = NewString(SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK)
	}

	if !IsSafeLink(s.PrivacyPolicyLink) {
		*s.PrivacyPolicyLink = ""
	}

	if s.PrivacyPolicyLink == nil {
		s.PrivacyPolicyLink = NewString(SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK)
	}

	if !IsSafeLink(s.AboutLink) {
		*s.AboutLink = ""
	}

	if s.AboutLink == nil {
		s.AboutLink = NewString(SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK)
	}

	if !IsSafeLink(s.HelpLink) {
		*s.HelpLink = ""
	}

	if s.HelpLink == nil {
		s.HelpLink = NewString(SUPPORT_SETTINGS_DEFAULT_HELP_LINK)
	}

	if !IsSafeLink(s.ReportAProblemLink) {
		*s.ReportAProblemLink = ""
	}

	if s.ReportAProblemLink == nil {
		s.ReportAProblemLink = NewString(SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK)
	}

	if s.SupportEmail == nil {
		s.SupportEmail = NewString(SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL)
	}
}

type AnnouncementSettings struct {
	EnableBanner         *bool
	BannerText           *string
	BannerColor          *string
	BannerTextColor      *string
	AllowBannerDismissal *bool
}

func (s *AnnouncementSettings) SetDefaults() {
	if s.EnableBanner == nil {
		s.EnableBanner = NewBool(false)
	}

	if s.BannerText == nil {
		s.BannerText = NewString("")
	}

	if s.BannerColor == nil {
		s.BannerColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR)
	}

	if s.BannerTextColor == nil {
		s.BannerTextColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR)
	}

	if s.AllowBannerDismissal == nil {
		s.AllowBannerDismissal = NewBool(true)
	}
}

type ThemeSettings struct {
	EnableThemeSelection *bool
	DefaultTheme         *string
	AllowCustomThemes    *bool
	AllowedThemes        []string
}

func (s *ThemeSettings) SetDefaults() {
	if s.EnableThemeSelection == nil {
		s.EnableThemeSelection = NewBool(true)
	}

	if s.DefaultTheme == nil {
		s.DefaultTheme = NewString(TEAM_SETTINGS_DEFAULT_TEAM_TEXT)
	}

	if s.AllowCustomThemes == nil {
		s.AllowCustomThemes = NewBool(true)
	}

	if s.AllowedThemes == nil {
		s.AllowedThemes = []string{}
	}
}

type TeamSettings struct {
	SiteName                            string
	MaxUsersPerTeam                     *int
	EnableTeamCreation                  bool
	EnableUserCreation                  bool
	EnableOpenServer                    *bool
	RestrictCreationToDomains           string
	EnableCustomBrand                   *bool
	CustomBrandText                     *string
	CustomDescriptionText               *string
	RestrictDirectMessage               *string
	RestrictTeamInvite                  *string
	RestrictPublicChannelManagement     *string
	RestrictPrivateChannelManagement    *string
	RestrictPublicChannelCreation       *string
	RestrictPrivateChannelCreation      *string
	RestrictPublicChannelDeletion       *string
	RestrictPrivateChannelDeletion      *string
	RestrictPrivateChannelManageMembers *string
	EnableXToLeaveChannelsFromLHS       *bool
	UserStatusAwayTimeout               *int64
	MaxChannelsPerTeam                  *int64
	MaxNotificationsPerChannel          *int64
	EnableConfirmNotificationsToChannel *bool
	TeammateNameDisplay                 *string
	ExperimentalTownSquareIsReadOnly    *bool
	ExperimentalPrimaryTeam             *string
}

func (s *TeamSettings) SetDefaults() {
	if s.MaxUsersPerTeam == nil {
		s.MaxUsersPerTeam = NewInt(TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM)
	}

	if s.EnableCustomBrand == nil {
		s.EnableCustomBrand = NewBool(false)
	}

	if s.CustomBrandText == nil {
		s.CustomBrandText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT)
	}

	if s.CustomDescriptionText == nil {
		s.CustomDescriptionText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT)
	}

	if s.EnableOpenServer == nil {
		s.EnableOpenServer = NewBool(false)
	}

	if s.RestrictDirectMessage == nil {
		s.RestrictDirectMessage = NewString(DIRECT_MESSAGE_ANY)
	}

	if s.RestrictTeamInvite == nil {
		s.RestrictTeamInvite = NewString(PERMISSIONS_ALL)
	}

	if s.RestrictPublicChannelManagement == nil {
		s.RestrictPublicChannelManagement = NewString(PERMISSIONS_ALL)
	}

	if s.RestrictPrivateChannelManagement == nil {
		s.RestrictPrivateChannelManagement = NewString(PERMISSIONS_ALL)
	}

	if s.RestrictPublicChannelCreation == nil {
		s.RestrictPublicChannelCreation = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *s.RestrictPublicChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			*s.RestrictPublicChannelCreation = PERMISSIONS_TEAM_ADMIN
		} else {
			*s.RestrictPublicChannelCreation = *s.RestrictPublicChannelManagement
		}
	}

	if s.RestrictPrivateChannelCreation == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *s.RestrictPrivateChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			s.RestrictPrivateChannelCreation = NewString(PERMISSIONS_TEAM_ADMIN)
		} else {
			s.RestrictPrivateChannelCreation = NewString(*s.RestrictPrivateChannelManagement)
		}
	}

	if s.RestrictPublicChannelDeletion == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		s.RestrictPublicChannelDeletion = NewString(*s.RestrictPublicChannelManagement)
	}

	if s.RestrictPrivateChannelDeletion == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		s.RestrictPrivateChannelDeletion = NewString(*s.RestrictPrivateChannelManagement)
	}

	if s.RestrictPrivateChannelManageMembers == nil {
		s.RestrictPrivateChannelManageMembers = NewString(PERMISSIONS_ALL)
	}

	if s.EnableXToLeaveChannelsFromLHS == nil {
		s.EnableXToLeaveChannelsFromLHS = NewBool(false)
	}

	if s.UserStatusAwayTimeout == nil {
		s.UserStatusAwayTimeout = NewInt64(TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT)
	}

	if s.MaxChannelsPerTeam == nil {
		s.MaxChannelsPerTeam = NewInt64(2000)
	}

	if s.MaxNotificationsPerChannel == nil {
		s.MaxNotificationsPerChannel = NewInt64(1000)
	}

	if s.EnableConfirmNotificationsToChannel == nil {
		s.EnableConfirmNotificationsToChannel = NewBool(true)
	}

	if s.ExperimentalTownSquareIsReadOnly == nil {
		s.ExperimentalTownSquareIsReadOnly = NewBool(false)
	}

	if s.ExperimentalPrimaryTeam == nil {
		s.ExperimentalPrimaryTeam = NewString("")
	}
}

type ClientRequirements struct {
	AndroidLatestVersion string
	AndroidMinVersion    string
	DesktopLatestVersion string
	DesktopMinVersion    string
	IosLatestVersion     string
	IosMinVersion        string
}

type LdapSettings struct {
	// Basic
	Enable             *bool
	EnableSync         *bool
	LdapServer         *string
	LdapPort           *int
	ConnectionSecurity *string
	BaseDN             *string
	BindUsername       *string
	BindPassword       *string

	// Filtering
	UserFilter *string

	// User Mapping
	FirstNameAttribute *string
	LastNameAttribute  *string
	EmailAttribute     *string
	UsernameAttribute  *string
	NicknameAttribute  *string
	IdAttribute        *string
	PositionAttribute  *string

	// Syncronization
	SyncIntervalMinutes *int

	// Advanced
	SkipCertificateVerification *bool
	QueryTimeout                *int
	MaxPageSize                 *int

	// Customization
	LoginFieldName *string

	LoginButtonColor       *string
	LoginButtonBorderColor *string
	LoginButtonTextColor   *string
}

func (s *LdapSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	// When unset should default to LDAP Enabled
	if s.EnableSync == nil {
		s.EnableSync = NewBool(*s.Enable)
	}

	if s.LdapServer == nil {
		s.LdapServer = NewString("")
	}

	if s.LdapPort == nil {
		s.LdapPort = NewInt(389)
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewString("")
	}

	if s.BaseDN == nil {
		s.BaseDN = NewString("")
	}

	if s.BindUsername == nil {
		s.BindUsername = NewString("")
	}

	if s.BindPassword == nil {
		s.BindPassword = NewString("")
	}

	if s.UserFilter == nil {
		s.UserFilter = NewString("")
	}

	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewString(LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewString(LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewString(LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if s.IdAttribute == nil {
		s.IdAttribute = NewString(LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewString(LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if s.SyncIntervalMinutes == nil {
		s.SyncIntervalMinutes = NewInt(60)
	}

	if s.SkipCertificateVerification == nil {
		s.SkipCertificateVerification = NewBool(false)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewInt(60)
	}

	if s.MaxPageSize == nil {
		s.MaxPageSize = NewInt(0)
	}

	if s.LoginFieldName == nil {
		s.LoginFieldName = NewString(LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#2389D7")
	}
}

type ComplianceSettings struct {
	Enable      *bool
	Directory   *string
	EnableDaily *bool
}

func (s *ComplianceSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.Directory == nil {
		s.Directory = NewString("./data/")
	}

	if s.EnableDaily == nil {
		s.EnableDaily = NewBool(false)
	}
}

type LocalizationSettings struct {
	DefaultServerLocale *string
	DefaultClientLocale *string
	AvailableLocales    *string
}

func (s *LocalizationSettings) SetDefaults() {
	if s.DefaultServerLocale == nil {
		s.DefaultServerLocale = NewString(DEFAULT_LOCALE)
	}

	if s.DefaultClientLocale == nil {
		s.DefaultClientLocale = NewString(DEFAULT_LOCALE)
	}

	if s.AvailableLocales == nil {
		s.AvailableLocales = NewString("")
	}
}

type SamlSettings struct {
	// Basic
	Enable             *bool
	EnableSyncWithLdap *bool

	Verify  *bool
	Encrypt *bool

	IdpUrl                      *string
	IdpDescriptorUrl            *string
	AssertionConsumerServiceURL *string

	IdpCertificateFile    *string
	PublicCertificateFile *string
	PrivateKeyFile        *string

	// User Mapping
	FirstNameAttribute *string
	LastNameAttribute  *string
	EmailAttribute     *string
	UsernameAttribute  *string
	NicknameAttribute  *string
	LocaleAttribute    *string
	PositionAttribute  *string

	LoginButtonText *string

	LoginButtonColor       *string
	LoginButtonBorderColor *string
	LoginButtonTextColor   *string
}

func (s *SamlSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.EnableSyncWithLdap == nil {
		s.EnableSyncWithLdap = NewBool(false)
	}

	if s.Verify == nil {
		s.Verify = NewBool(true)
	}

	if s.Encrypt == nil {
		s.Encrypt = NewBool(true)
	}

	if s.IdpUrl == nil {
		s.IdpUrl = NewString("")
	}

	if s.IdpDescriptorUrl == nil {
		s.IdpDescriptorUrl = NewString("")
	}

	if s.IdpCertificateFile == nil {
		s.IdpCertificateFile = NewString("")
	}

	if s.PublicCertificateFile == nil {
		s.PublicCertificateFile = NewString("")
	}

	if s.PrivateKeyFile == nil {
		s.PrivateKeyFile = NewString("")
	}

	if s.AssertionConsumerServiceURL == nil {
		s.AssertionConsumerServiceURL = NewString("")
	}

	if s.LoginButtonText == nil || *s.LoginButtonText == "" {
		s.LoginButtonText = NewString(USER_AUTH_SERVICE_SAML_TEXT)
	}

	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewString(SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewString(SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewString(SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewString(SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewString(SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewString(SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if s.LocaleAttribute == nil {
		s.LocaleAttribute = NewString(SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#34a28b")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#ffffff")
	}
}

type NativeAppSettings struct {
	AppDownloadLink        *string
	AndroidAppDownloadLink *string
	IosAppDownloadLink     *string
}

func (s *NativeAppSettings) SetDefaults() {
	if s.AppDownloadLink == nil {
		s.AppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK)
	}

	if s.AndroidAppDownloadLink == nil {
		s.AndroidAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK)
	}

	if s.IosAppDownloadLink == nil {
		s.IosAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK)
	}
}

type WebrtcSettings struct {
	Enable              *bool
	GatewayWebsocketUrl *string
	GatewayAdminUrl     *string
	GatewayAdminSecret  *string
	StunURI             *string
	TurnURI             *string
	TurnUsername        *string
	TurnSharedKey       *string
}

func (s *WebrtcSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.GatewayWebsocketUrl == nil {
		s.GatewayWebsocketUrl = NewString("")
	}

	if s.GatewayAdminUrl == nil {
		s.GatewayAdminUrl = NewString("")
	}

	if s.GatewayAdminSecret == nil {
		s.GatewayAdminSecret = NewString("")
	}

	if s.StunURI == nil {
		s.StunURI = NewString(WEBRTC_SETTINGS_DEFAULT_STUN_URI)
	}

	if s.TurnURI == nil {
		s.TurnURI = NewString(WEBRTC_SETTINGS_DEFAULT_TURN_URI)
	}

	if s.TurnUsername == nil {
		s.TurnUsername = NewString("")
	}

	if s.TurnSharedKey == nil {
		s.TurnSharedKey = NewString("")
	}
}

type ElasticsearchSettings struct {
	ConnectionUrl                 *string
	Username                      *string
	Password                      *string
	EnableIndexing                *bool
	EnableSearching               *bool
	Sniff                         *bool
	PostIndexReplicas             *int
	PostIndexShards               *int
	AggregatePostsAfterDays       *int
	PostsAggregatorJobStartTime   *string
	IndexPrefix                   *string
	LiveIndexingBatchSize         *int
	BulkIndexingTimeWindowSeconds *int
	RequestTimeoutSeconds         *int
}

func (s *ElasticsearchSettings) SetDefaults() {
	if s.ConnectionUrl == nil {
		s.ConnectionUrl = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL)
	}

	if s.Username == nil {
		s.Username = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME)
	}

	if s.Password == nil {
		s.Password = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD)
	}

	if s.EnableIndexing == nil {
		s.EnableIndexing = NewBool(false)
	}

	if s.EnableSearching == nil {
		s.EnableSearching = NewBool(false)
	}

	if s.Sniff == nil {
		s.Sniff = NewBool(true)
	}

	if s.PostIndexReplicas == nil {
		s.PostIndexReplicas = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS)
	}

	if s.PostIndexShards == nil {
		s.PostIndexShards = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS)
	}

	if s.AggregatePostsAfterDays == nil {
		s.AggregatePostsAfterDays = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS)
	}

	if s.PostsAggregatorJobStartTime == nil {
		s.PostsAggregatorJobStartTime = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME)
	}

	if s.IndexPrefix == nil {
		s.IndexPrefix = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX)
	}

	if s.LiveIndexingBatchSize == nil {
		s.LiveIndexingBatchSize = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE)
	}

	if s.BulkIndexingTimeWindowSeconds == nil {
		s.BulkIndexingTimeWindowSeconds = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS)
	}

	if s.RequestTimeoutSeconds == nil {
		s.RequestTimeoutSeconds = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_REQUEST_TIMEOUT_SECONDS)
	}
}

type DataRetentionSettings struct {
	EnableMessageDeletion *bool
	EnableFileDeletion    *bool
	MessageRetentionDays  *int
	FileRetentionDays     *int
	DeletionJobStartTime  *string
}

func (s *DataRetentionSettings) SetDefaults() {
	if s.EnableMessageDeletion == nil {
		s.EnableMessageDeletion = NewBool(false)
	}

	if s.EnableFileDeletion == nil {
		s.EnableFileDeletion = NewBool(false)
	}

	if s.MessageRetentionDays == nil {
		s.MessageRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS)
	}

	if s.FileRetentionDays == nil {
		s.FileRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS)
	}

	if s.DeletionJobStartTime == nil {
		s.DeletionJobStartTime = NewString(DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME)
	}
}

type JobSettings struct {
	RunJobs      *bool
	RunScheduler *bool
}

func (s *JobSettings) SetDefaults() {
	if s.RunJobs == nil {
		s.RunJobs = NewBool(true)
	}

	if s.RunScheduler == nil {
		s.RunScheduler = NewBool(true)
	}
}

type PluginState struct {
	Enable bool
}

type PluginSettings struct {
	Enable          *bool
	EnableUploads   *bool
	Directory       *string
	ClientDirectory *string
	Plugins         map[string]interface{}
	PluginStates    map[string]*PluginState
}

func (s *PluginSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(true)
	}

	if s.EnableUploads == nil {
		s.EnableUploads = NewBool(false)
	}

	if s.Directory == nil {
		s.Directory = NewString(PLUGIN_SETTINGS_DEFAULT_DIRECTORY)
	}

	if *s.Directory == "" {
		*s.Directory = PLUGIN_SETTINGS_DEFAULT_DIRECTORY
	}

	if s.ClientDirectory == nil {
		s.ClientDirectory = NewString(PLUGIN_SETTINGS_DEFAULT_CLIENT_DIRECTORY)
	}

	if *s.ClientDirectory == "" {
		*s.ClientDirectory = PLUGIN_SETTINGS_DEFAULT_CLIENT_DIRECTORY
	}

	if s.Plugins == nil {
		s.Plugins = make(map[string]interface{})
	}

	if s.PluginStates == nil {
		s.PluginStates = make(map[string]*PluginState)
	}
}

type MessageExportSettings struct {
	EnableExport        *bool
	DailyRunTime        *string
	ExportFromTimestamp *int64
	BatchSize           *int
}

func (s *MessageExportSettings) SetDefaults() {
	if s.EnableExport == nil {
		s.EnableExport = NewBool(false)
	}

	if s.DailyRunTime == nil {
		s.DailyRunTime = NewString("01:00")
	}

	if s.ExportFromTimestamp == nil {
		s.ExportFromTimestamp = NewInt64(0)
	}

	if s.EnableExport != nil && *s.EnableExport && *s.ExportFromTimestamp == int64(0) {
		// when the feature is enabled via the System Console, use the current timestamp as the start time for future exports
		s.ExportFromTimestamp = NewInt64(GetMillis())
	} else if s.EnableExport != nil && !*s.EnableExport {
		// when the feature is disabled, reset the timestamp so that the timestamp will be set if the feature is re-enabled
		s.ExportFromTimestamp = NewInt64(0)
	}

	if s.BatchSize == nil {
		s.BatchSize = NewInt(10000)
	}
}

type ConfigFunc func() *Config

type Config struct {
	ServiceSettings       ServiceSettings
	TeamSettings          TeamSettings
	ClientRequirements    ClientRequirements
	SqlSettings           SqlSettings
	LogSettings           LogSettings
	PasswordSettings      PasswordSettings
	FileSettings          FileSettings
	EmailSettings         EmailSettings
	RateLimitSettings     RateLimitSettings
	PrivacySettings       PrivacySettings
	SupportSettings       SupportSettings
	AnnouncementSettings  AnnouncementSettings
	ThemeSettings         ThemeSettings
	GitLabSettings        SSOSettings
	GoogleSettings        SSOSettings
	Office365Settings     SSOSettings
	LdapSettings          LdapSettings
	ComplianceSettings    ComplianceSettings
	LocalizationSettings  LocalizationSettings
	SamlSettings          SamlSettings
	NativeAppSettings     NativeAppSettings
	ClusterSettings       ClusterSettings
	MetricsSettings       MetricsSettings
	AnalyticsSettings     AnalyticsSettings
	WebrtcSettings        WebrtcSettings
	ElasticsearchSettings ElasticsearchSettings
	DataRetentionSettings DataRetentionSettings
	MessageExportSettings MessageExportSettings
	JobSettings           JobSettings
	PluginSettings        PluginSettings
}

func (o *Config) Clone() *Config {
	var ret Config
	if err := json.Unmarshal([]byte(o.ToJson()), &ret); err != nil {
		panic(err)
	}
	return &ret
}

func (o *Config) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *Config) GetSSOService(service string) *SSOSettings {
	switch service {
	case SERVICE_GITLAB:
		return &o.GitLabSettings
	case SERVICE_GOOGLE:
		return &o.GoogleSettings
	case SERVICE_OFFICE365:
		return &o.Office365Settings
	}

	return nil
}

func ConfigFromJson(data io.Reader) *Config {
	decoder := json.NewDecoder(data)
	var o Config
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Config) SetDefaults() {
	o.LdapSettings.SetDefaults()
	o.SamlSettings.SetDefaults()

	if o.TeamSettings.TeammateNameDisplay == nil {
		o.TeamSettings.TeammateNameDisplay = NewString(SHOW_USERNAME)

		if *o.SamlSettings.Enable || *o.LdapSettings.Enable {
			*o.TeamSettings.TeammateNameDisplay = SHOW_FULLNAME
		}
	}

	o.SqlSettings.SetDefaults()
	o.FileSettings.SetDefaults()
	o.EmailSettings.SetDefaults()
	o.ServiceSettings.SetDefaults()
	o.PasswordSettings.SetDefaults()
	o.TeamSettings.SetDefaults()
	o.MetricsSettings.SetDefaults()
	o.SupportSettings.SetDefaults()
	o.AnnouncementSettings.SetDefaults()
	o.ThemeSettings.SetDefaults()
	o.ClusterSettings.SetDefaults()
	o.PluginSettings.SetDefaults()
	o.AnalyticsSettings.SetDefaults()
	o.ComplianceSettings.SetDefaults()
	o.LocalizationSettings.SetDefaults()
	o.ElasticsearchSettings.SetDefaults()
	o.NativeAppSettings.SetDefaults()
	o.DataRetentionSettings.SetDefaults()
	o.RateLimitSettings.SetDefaults()
	o.LogSettings.SetDefaults()
	o.JobSettings.SetDefaults()
	o.WebrtcSettings.SetDefaults()
	o.MessageExportSettings.SetDefaults()
}

func (o *Config) IsValid() *AppError {
	if len(*o.ServiceSettings.SiteURL) == 0 && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.site_url_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if *o.ClusterSettings.Enable && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.cluster_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if err := o.TeamSettings.isValid(); err != nil {
		return err
	}

	if err := o.SqlSettings.isValid(); err != nil {
		return err
	}

	if err := o.FileSettings.isValid(); err != nil {
		return err
	}

	if err := o.EmailSettings.isValid(); err != nil {
		return err
	}

	if err := o.LdapSettings.isValid(); err != nil {
		return err
	}

	if err := o.SamlSettings.isValid(); err != nil {
		return err
	}

	if *o.PasswordSettings.MinimumLength < PASSWORD_MINIMUM_LENGTH || *o.PasswordSettings.MinimumLength > PASSWORD_MAXIMUM_LENGTH {
		return NewAppError("Config.IsValid", "model.config.is_valid.password_length.app_error", map[string]interface{}{"MinLength": PASSWORD_MINIMUM_LENGTH, "MaxLength": PASSWORD_MAXIMUM_LENGTH}, "", http.StatusBadRequest)
	}

	if err := o.RateLimitSettings.isValid(); err != nil {
		return err
	}

	if err := o.WebrtcSettings.isValid(); err != nil {
		return err
	}

	if err := o.ServiceSettings.isValid(); err != nil {
		return err
	}

	if err := o.ElasticsearchSettings.isValid(); err != nil {
		return err
	}

	if err := o.DataRetentionSettings.isValid(); err != nil {
		return err
	}

	if err := o.LocalizationSettings.isValid(); err != nil {
		return err
	}

	if err := o.MessageExportSettings.isValid(o.FileSettings); err != nil {
		return err
	}

	return nil
}

func (ts *TeamSettings) isValid() *AppError {
	if *ts.MaxUsersPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "", http.StatusBadRequest)
	}

	if *ts.MaxChannelsPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_channels.app_error", nil, "", http.StatusBadRequest)
	}

	if *ts.MaxNotificationsPerChannel <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_notify_per_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ts.RestrictDirectMessage == DIRECT_MESSAGE_ANY || *ts.RestrictDirectMessage == DIRECT_MESSAGE_TEAM) {
		return NewAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ts.TeammateNameDisplay == SHOW_FULLNAME || *ts.TeammateNameDisplay == SHOW_NICKNAME_FULLNAME || *ts.TeammateNameDisplay == SHOW_USERNAME) {
		return NewAppError("Config.IsValid", "model.config.is_valid.teammate_name_display.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ts.SiteName) > SITENAME_MAX_LENGTH {
		return NewAppError("Config.IsValid", "model.config.is_valid.sitename_length.app_error", map[string]interface{}{"MaxLength": SITENAME_MAX_LENGTH}, "", http.StatusBadRequest)
	}

	return nil
}

func (ss *SqlSettings) isValid() *AppError {
	if len(ss.AtRestEncryptKey) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.encrypt_sql.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ss.DriverName == DATABASE_DRIVER_MYSQL || *ss.DriverName == DATABASE_DRIVER_POSTGRES) {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaxIdleConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_idle.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.QueryTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_query_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*ss.DataSource) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_data_src.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaxOpenConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_max_conn.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (fs *FileSettings) isValid() *AppError {
	if *fs.MaxFileSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_file_size.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*fs.DriverName == IMAGE_DRIVER_LOCAL || *fs.DriverName == IMAGE_DRIVER_S3) {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*fs.PublicLinkSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (es *EmailSettings) isValid() *AppError {
	if !(es.ConnectionSecurity == CONN_SECURITY_NONE || es.ConnectionSecurity == CONN_SECURITY_TLS || es.ConnectionSecurity == CONN_SECURITY_STARTTLS || es.ConnectionSecurity == CONN_SECURITY_PLAIN) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "", http.StatusBadRequest)
	}

	if len(es.InviteSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_salt.app_error", nil, "", http.StatusBadRequest)
	}

	if *es.EmailBatchingBufferSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_buffer_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *es.EmailBatchingInterval < 30 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*es.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_FULL || *es.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_GENERIC) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_notification_contents_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (rls *RateLimitSettings) isValid() *AppError {
	if *rls.MemoryStoreSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_mem.app_error", nil, "", http.StatusBadRequest)
	}

	if *rls.PerSec <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_sec.app_error", nil, "", http.StatusBadRequest)
	}

	if *rls.MaxBurst <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_burst.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (ls *LdapSettings) isValid() *AppError {
	if !(*ls.ConnectionSecurity == CONN_SECURITY_NONE || *ls.ConnectionSecurity == CONN_SECURITY_TLS || *ls.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.SyncIntervalMinutes <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_sync_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.MaxPageSize < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_max_page_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.Enable {
		if *ls.LdapServer == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_server", nil, "", http.StatusBadRequest)
		}

		if *ls.BaseDN == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_basedn", nil, "", http.StatusBadRequest)
		}

		if *ls.EmailAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_email", nil, "", http.StatusBadRequest)
		}

		if *ls.UsernameAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_username", nil, "", http.StatusBadRequest)
		}

		if *ls.IdAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_id", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (ss *SamlSettings) isValid() *AppError {
	if *ss.Enable {
		if len(*ss.IdpUrl) == 0 || !IsValidHttpUrl(*ss.IdpUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_url.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.IdpDescriptorUrl) == 0 || !IsValidHttpUrl(*ss.IdpDescriptorUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_descriptor_url.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.IdpCertificateFile) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_cert.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.EmailAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.UsernameAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_username_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if *ss.Verify {
			if len(*ss.AssertionConsumerServiceURL) == 0 || !IsValidHttpUrl(*ss.AssertionConsumerServiceURL) {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_assertion_consumer_service_url.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *ss.Encrypt {
			if len(*ss.PrivateKeyFile) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_private_key.app_error", nil, "", http.StatusBadRequest)
			}

			if len(*ss.PublicCertificateFile) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_public_cert.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if len(*ss.EmailAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (ws *WebrtcSettings) isValid() *AppError {
	if *ws.Enable {
		if len(*ws.GatewayWebsocketUrl) == 0 || !IsValidWebsocketUrl(*ws.GatewayWebsocketUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_ws_url.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.GatewayAdminUrl) == 0 || !IsValidHttpUrl(*ws.GatewayAdminUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_url.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.GatewayAdminSecret) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_secret.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.StunURI) != 0 && !IsValidTurnOrStunServer(*ws.StunURI) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_stun_uri.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.TurnURI) != 0 {
			if !IsValidTurnOrStunServer(*ws.TurnURI) {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_uri.app_error", nil, "", http.StatusBadRequest)
			}
			if len(*ws.TurnUsername) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_username.app_error", nil, "", http.StatusBadRequest)
			} else if len(*ws.TurnSharedKey) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_shared_key.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (ss *ServiceSettings) isValid() *AppError {
	if !(*ss.ConnectionSecurity == CONN_SECURITY_NONE || *ss.ConnectionSecurity == CONN_SECURITY_TLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.webserver_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.ReadTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.read_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.WriteTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.write_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.TimeBetweenUserTypingUpdatesMilliseconds < 1000 {
		return NewAppError("Config.IsValid", "model.config.is_valid.time_between_user_typing.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaximumLoginAttempts <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.login_attempts.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*ss.SiteURL) != 0 {
		if _, err := url.ParseRequestURI(*ss.SiteURL); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.site_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if len(*ss.ListenAddress) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (ess *ElasticsearchSettings) isValid() *AppError {
	if *ess.EnableIndexing {
		if len(*ess.ConnectionUrl) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.connection_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if *ess.EnableSearching && !*ess.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_searching.app_error", nil, "", http.StatusBadRequest)
	}

	if *ess.AggregatePostsAfterDays < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.aggregate_posts_after_days.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *ess.PostsAggregatorJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.posts_aggregator_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if *ess.LiveIndexingBatchSize < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.live_indexing_batch_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *ess.BulkIndexingTimeWindowSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.bulk_indexing_time_window_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	if *ess.RequestTimeoutSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.request_timeout_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (drs *DataRetentionSettings) isValid() *AppError {
	if *drs.MessageRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if *drs.FileRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *drs.DeletionJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.deletion_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

func (ls *LocalizationSettings) isValid() *AppError {
	if len(*ls.AvailableLocales) > 0 {
		if !strings.Contains(*ls.AvailableLocales, *ls.DefaultClientLocale) {
			return NewAppError("Config.IsValid", "model.config.is_valid.localization.available_locales.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (mes *MessageExportSettings) isValid(fs FileSettings) *AppError {
	if mes.EnableExport == nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.message_export.enable.app_error", nil, "", http.StatusBadRequest)
	}
	if *mes.EnableExport {
		if mes.ExportFromTimestamp == nil || *mes.ExportFromTimestamp < 0 || *mes.ExportFromTimestamp > GetMillis() {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.export_from.app_error", nil, "", http.StatusBadRequest)
		} else if mes.DailyRunTime == nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, "", http.StatusBadRequest)
		} else if _, err := time.Parse("15:04", *mes.DailyRunTime); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, err.Error(), http.StatusBadRequest)
		} else if mes.BatchSize == nil || *mes.BatchSize < 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.batch_size.app_error", nil, "", http.StatusBadRequest)
		}
	}
	return nil
}

func (o *Config) GetSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = o.PrivacySettings.ShowFullName
	options["email"] = o.PrivacySettings.ShowEmailAddress

	return options
}

func (o *Config) Sanitize() {
	if o.LdapSettings.BindPassword != nil && len(*o.LdapSettings.BindPassword) > 0 {
		*o.LdapSettings.BindPassword = FAKE_SETTING
	}

	*o.FileSettings.PublicLinkSalt = FAKE_SETTING
	if len(o.FileSettings.AmazonS3SecretAccessKey) > 0 {
		o.FileSettings.AmazonS3SecretAccessKey = FAKE_SETTING
	}

	o.EmailSettings.InviteSalt = FAKE_SETTING
	if len(o.EmailSettings.SMTPPassword) > 0 {
		o.EmailSettings.SMTPPassword = FAKE_SETTING
	}

	if len(o.GitLabSettings.Secret) > 0 {
		o.GitLabSettings.Secret = FAKE_SETTING
	}

	*o.SqlSettings.DataSource = FAKE_SETTING
	o.SqlSettings.AtRestEncryptKey = FAKE_SETTING

	for i := range o.SqlSettings.DataSourceReplicas {
		o.SqlSettings.DataSourceReplicas[i] = FAKE_SETTING
	}

	for i := range o.SqlSettings.DataSourceSearchReplicas {
		o.SqlSettings.DataSourceSearchReplicas[i] = FAKE_SETTING
	}

	*o.ElasticsearchSettings.Password = FAKE_SETTING
}
