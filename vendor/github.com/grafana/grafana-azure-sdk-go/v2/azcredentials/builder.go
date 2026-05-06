package azcredentials

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"
)

func FromDatasourceData(data map[string]interface{}, secureData map[string]string) (AzureCredentials, error) {
	if credentialsObj, err := maputil.GetMapOptional(data, "azureCredentials"); err != nil {
		return nil, err
	} else if credentialsObj == nil {
		return nil, nil
	} else {
		return getFromCredentialsObject(credentialsObj, secureData)
	}
}

func getFromCredentialsObject(credentialsObj map[string]interface{}, secureData map[string]string) (AzureCredentials, error) {
	authType, err := maputil.GetString(credentialsObj, "authType")
	if err != nil {
		return nil, err
	}

	switch authType {
	case AzureAuthCurrentUserIdentity:
		serviceCredentialsEnabled, err := maputil.GetBoolOptional(credentialsObj, "serviceCredentialsEnabled")
		if err != nil {
			return nil, err
		}

		var fallbackCredentials AzureCredentials
		if serviceCredentialsEnabled {
			creds, err := maputil.GetMapOptional(credentialsObj, "serviceCredentials")
			if err != nil {
				return nil, err
			}
			fallbackCredentials, err = getFromCredentialsObject(creds, secureData)
			if err != nil {
				return nil, err
			}
		}
		credentials := &AadCurrentUserCredentials{
			ServiceCredentialsEnabled: serviceCredentialsEnabled,
			ServiceCredentials:        fallbackCredentials,
		}
		return credentials, nil

	case AzureAuthManagedIdentity:
		credentials := &AzureManagedIdentityCredentials{}
		return credentials, nil

	case AzureAuthWorkloadIdentity:
		credentials := &AzureWorkloadIdentityCredentials{}
		tenantId, err := maputil.GetStringOptional(credentialsObj, "tenantId")
		if err != nil {
			return nil, err
		}
		if tenantId != "" {
			credentials.TenantId = tenantId
		}
		clientId, err := maputil.GetStringOptional(credentialsObj, "clientId")
		if err != nil {
			return nil, err
		}
		if clientId != "" {
			credentials.ClientId = clientId
		}

		return credentials, nil

	case AzureAuthClientSecret:
		cloud, err := maputil.GetString(credentialsObj, "azureCloud")
		if err != nil {
			return nil, err
		}
		tenantId, err := maputil.GetString(credentialsObj, "tenantId")
		if err != nil {
			return nil, err
		}
		clientId, err := maputil.GetString(credentialsObj, "clientId")
		if err != nil {
			return nil, err
		}
		clientSecret, ok := secureData["azureClientSecret"]
		if !ok {
			// Use legacy client secret if it was preserved during migration of credentials
			clientSecret = secureData["clientSecret"]
		}

		credentials := &AzureClientSecretCredentials{
			AzureCloud:   cloud,
			TenantId:     tenantId,
			ClientId:     clientId,
			ClientSecret: clientSecret,
		}
		return credentials, nil

	case AzureAuthClientSecretObo:
		cloud, err := maputil.GetString(credentialsObj, "azureCloud")
		if err != nil {
			return nil, err
		}
		tenantId, err := maputil.GetString(credentialsObj, "tenantId")
		if err != nil {
			return nil, err
		}
		clientId, err := maputil.GetString(credentialsObj, "clientId")
		if err != nil {
			return nil, err
		}
		clientSecret, ok := secureData["azureClientSecret"]
		if !ok {
			// Use legacy client secret if it was preserved during migration of credentials
			clientSecret = secureData["clientSecret"]
		}

		credentials := &AzureClientSecretOboCredentials{
			ClientSecretCredentials: AzureClientSecretCredentials{
				AzureCloud:   cloud,
				TenantId:     tenantId,
				ClientId:     clientId,
				ClientSecret: clientSecret,
			},
		}
		return credentials, nil
	case AzureAuthEntraPasswordCredentials:
		userId, err := maputil.GetString(credentialsObj, "userId")
		if err != nil {
			return nil, err
		}
		clientId, err := maputil.GetString(credentialsObj, "clientId")
		if err != nil {
			return nil, err
		}
		password, ok := secureData["password"]
		if !ok {
			return nil, fmt.Errorf("no password provided")
		}

		credentials := &AzureEntraPasswordCredentials{
			Password: password,
			UserId:   userId,
			ClientId: clientId,
		}
		return credentials, nil
	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}
