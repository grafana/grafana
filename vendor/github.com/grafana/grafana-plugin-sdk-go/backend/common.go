package backend

import (
	"encoding/json"
	"time"
)

// User represents a Grafana user.
type User struct {
	Login string
	Name  string
	Email string
	Role  string
}

// AppInstanceSettings represents settings for an app instance.
//
// In Grafana an app instance is an app plugin of certain
// type that have been configured and enabled in a Grafana organization.
type AppInstanceSettings struct {
	// JSONData repeats the properties at this level of the object (excluding DataSourceConfig), and also includes any custom properties associated with the plugin config instance.
	JSONData json.RawMessage

	// DecryptedSecureJSONData contains key,value pairs where the encrypted configuration plugin instance in Grafana server have been decrypted before passing them to the plugin.
	DecryptedSecureJSONData map[string]string

	// Updated is the last time this plugin instance's configuration was updated.
	Updated time.Time
}

// DataSourceInstanceSettings represents settings for a data source instance.
//
// In Grafana a data source instance is a data source plugin of certain
// type that have been configured and created in a Grafana organization.
type DataSourceInstanceSettings struct {
	// ID is the Grafana assigned numeric identifier of the the data source instance.
	ID int64

	// Name is the configured name of the data source instance.
	Name string

	// URL is the configured URL of a data source instance (e.g. the URL of an API endpoint).
	URL string

	// User is a configured user for a data source instance. This is not a Grafana user, rather an arbitrary string.
	User string

	// Database is the configured database for a data source instance. (e.g. the default Database a SQL data source would connect to).
	Database string

	// BasicAuthEnabled indicates if this data source instance should use basic authentication.
	BasicAuthEnabled bool

	// BasicAuthUser is the configured user for basic authentication. (e.g. when a data source uses basic authentication to connect to whatever API it fetches data from).
	BasicAuthUser string

	// JSONData contains the raw DataSourceConfig as JSON as stored by Grafana server. It repeats the properties in this object and includes custom properties.
	JSONData json.RawMessage

	// DecryptedSecureJSONData contains key,value pairs where the encrypted configuration in Grafana server have been decrypted before passing them to the plugin.
	DecryptedSecureJSONData map[string]string

	// Updated is the last time the configuration for the data source instance was updated.
	Updated time.Time
}

// PluginContext holds contextual information about a plugin request, such as
// Grafana organization, user and plugin instance settings.
type PluginContext struct {
	// OrgID is The Grafana organization identifier the request originating from.
	OrgID int64

	// PluginID is the unique identifier of the plugin that the request is for.
	PluginID string

	// User is the Grafana user making the request.
	//
	// Will not be provided if Grafana backend initiated the request,
	// for example when request is coming from Grafana Alerting.
	User *User

	// AppInstanceSettings is the configured app instance settings.
	//
	// In Grafana an app instance is an app plugin of certain
	// type that have been configured and enabled in a Grafana organization.
	//
	// Will only be set if request targeting an app instance.
	AppInstanceSettings *AppInstanceSettings

	// DataSourceConfig is the configured data source instance
	// settings.
	//
	// In Grafana a data source instance is a data source plugin of certain
	// type that have been configured and created in a Grafana organization.
	//
	// Will only be set if request targeting a data source instance.
	DataSourceInstanceSettings *DataSourceInstanceSettings
}
