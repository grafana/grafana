package datasources

import (
	"github.com/grafana/grafana/pkg/models"
)
import "github.com/grafana/grafana/pkg/components/simplejson"

type ConfigVersion struct {
	ApiVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type DatasourcesAsConfig struct {
	ApiVersion int64

	Datasources       []*DataSourceFromConfig
	DeleteDatasources []*DeleteDatasourceConfig
}

type DeleteDatasourceConfig struct {
	OrgId int64
	Name  string
}

type DataSourceFromConfig struct {
	OrgId   int64
	Version int

	Name              string
	Type              string
	Access            string
	Url               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
	WithCredentials   bool
	IsDefault         bool
	JsonData          map[string]interface{}
	SecureJsonData    map[string]string
	Editable          bool
}

type DatasourcesAsConfigV0 struct {
	ConfigVersion

	Datasources       []*DataSourceFromConfigV0   `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*DeleteDatasourceConfigV0 `json:"delete_datasources" yaml:"delete_datasources"`
}

type DatasourcesAsConfigV1 struct {
	ConfigVersion

	Datasources       []*DataSourceFromConfigV1   `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*DeleteDatasourceConfigV1 `json:"deleteDatasources" yaml:"deleteDatasources"`
}

type DeleteDatasourceConfigV0 struct {
	OrgId int64  `json:"org_id" yaml:"org_id"`
	Name  string `json:"name" yaml:"name"`
}

type DeleteDatasourceConfigV1 struct {
	OrgId int64  `json:"orgId" yaml:"orgId"`
	Name  string `json:"name" yaml:"name"`
}

type DataSourceFromConfigV0 struct {
	OrgId             int64                  `json:"org_id" yaml:"org_id"`
	Version           int                    `json:"version" yaml:"version"`
	Name              string                 `json:"name" yaml:"name"`
	Type              string                 `json:"type" yaml:"type"`
	Access            string                 `json:"access" yaml:"access"`
	Url               string                 `json:"url" yaml:"url"`
	Password          string                 `json:"password" yaml:"password"`
	User              string                 `json:"user" yaml:"user"`
	Database          string                 `json:"database" yaml:"database"`
	BasicAuth         bool                   `json:"basic_auth" yaml:"basic_auth"`
	BasicAuthUser     string                 `json:"basic_auth_user" yaml:"basic_auth_user"`
	BasicAuthPassword string                 `json:"basic_auth_password" yaml:"basic_auth_password"`
	WithCredentials   bool                   `json:"with_credentials" yaml:"with_credentials"`
	IsDefault         bool                   `json:"is_default" yaml:"is_default"`
	JsonData          map[string]interface{} `json:"json_data" yaml:"json_data"`
	SecureJsonData    map[string]string      `json:"secure_json_data" yaml:"secure_json_data"`
	Editable          bool                   `json:"editable" yaml:"editable"`
}

type DataSourceFromConfigV1 struct {
	OrgId             int64                  `json:"orgId" yaml:"orgId"`
	Version           int                    `json:"version" yaml:"version"`
	Name              string                 `json:"name" yaml:"name"`
	Type              string                 `json:"type" yaml:"type"`
	Access            string                 `json:"access" yaml:"access"`
	Url               string                 `json:"url" yaml:"url"`
	Password          string                 `json:"password" yaml:"password"`
	User              string                 `json:"user" yaml:"user"`
	Database          string                 `json:"database" yaml:"database"`
	BasicAuth         bool                   `json:"basicAuth" yaml:"basicAuth"`
	BasicAuthUser     string                 `json:"basicAuthUser" yaml:"basicAuthUser"`
	BasicAuthPassword string                 `json:"basicAuthPassword" yaml:"basicAuthPassword"`
	WithCredentials   bool                   `json:"withCredentials" yaml:"withCredentials"`
	IsDefault         bool                   `json:"isDefault" yaml:"isDefault"`
	JsonData          map[string]interface{} `json:"jsonData" yaml:"jsonData"`
	SecureJsonData    map[string]string      `json:"secureJsonData" yaml:"secureJsonData"`
	Editable          bool                   `json:"editable" yaml:"editable"`
}

func (cfg *DatasourcesAsConfigV1) mapToDatasourceFromConfig(apiVersion int64) *DatasourcesAsConfig {
	r := &DatasourcesAsConfig{}

	r.ApiVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &DataSourceFromConfig{
			OrgId:             ds.OrgId,
			Name:              ds.Name,
			Type:              ds.Type,
			Access:            ds.Access,
			Url:               ds.Url,
			Password:          ds.Password,
			User:              ds.User,
			Database:          ds.Database,
			BasicAuth:         ds.BasicAuth,
			BasicAuthUser:     ds.BasicAuthUser,
			BasicAuthPassword: ds.BasicAuthPassword,
			WithCredentials:   ds.WithCredentials,
			IsDefault:         ds.IsDefault,
			JsonData:          ds.JsonData,
			SecureJsonData:    ds.SecureJsonData,
			Editable:          ds.Editable,
			Version:           ds.Version,
		})
	}

	for _, ds := range cfg.DeleteDatasources {
		r.DeleteDatasources = append(r.DeleteDatasources, &DeleteDatasourceConfig{
			OrgId: ds.OrgId,
			Name:  ds.Name,
		})
	}

	return r
}

func (cfg *DatasourcesAsConfigV0) mapToDatasourceFromConfig(apiVersion int64) *DatasourcesAsConfig {
	r := &DatasourcesAsConfig{}

	r.ApiVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &DataSourceFromConfig{
			OrgId:             ds.OrgId,
			Name:              ds.Name,
			Type:              ds.Type,
			Access:            ds.Access,
			Url:               ds.Url,
			Password:          ds.Password,
			User:              ds.User,
			Database:          ds.Database,
			BasicAuth:         ds.BasicAuth,
			BasicAuthUser:     ds.BasicAuthUser,
			BasicAuthPassword: ds.BasicAuthPassword,
			WithCredentials:   ds.WithCredentials,
			IsDefault:         ds.IsDefault,
			JsonData:          ds.JsonData,
			SecureJsonData:    ds.SecureJsonData,
			Editable:          ds.Editable,
			Version:           ds.Version,
		})
	}

	for _, ds := range cfg.DeleteDatasources {
		r.DeleteDatasources = append(r.DeleteDatasources, &DeleteDatasourceConfig{
			OrgId: ds.OrgId,
			Name:  ds.Name,
		})
	}

	return r
}

func createInsertCommand(ds *DataSourceFromConfig) *models.AddDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JsonData) > 0 {
		for k, v := range ds.JsonData {
			jsonData.Set(k, v)
		}
	}

	return &models.AddDataSourceCommand{
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJsonData,
		ReadOnly:          !ds.Editable,
	}
}

func createUpdateCommand(ds *DataSourceFromConfig, id int64) *models.UpdateDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JsonData) > 0 {
		for k, v := range ds.JsonData {
			jsonData.Set(k, v)
		}
	}

	return &models.UpdateDataSourceCommand{
		Id:                id,
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJsonData,
		ReadOnly:          !ds.Editable,
	}
}
