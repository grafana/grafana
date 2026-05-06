//go:build go1.18
// +build go1.18

package azuread

import (
	"context"
	"crypto"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	mssql "github.com/microsoft/go-mssqldb"
	"github.com/microsoft/go-mssqldb/msdsn"
)

const (
	ActiveDirectoryDefault     = "ActiveDirectoryDefault"
	ActiveDirectoryIntegrated  = "ActiveDirectoryIntegrated"
	ActiveDirectoryPassword    = "ActiveDirectoryPassword"
	ActiveDirectoryInteractive = "ActiveDirectoryInteractive"
	// ActiveDirectoryMSI is a synonym for ActiveDirectoryManagedIdentity
	ActiveDirectoryMSI             = "ActiveDirectoryMSI"
	ActiveDirectoryManagedIdentity = "ActiveDirectoryManagedIdentity"
	// ActiveDirectoryApplication is a synonym for ActiveDirectoryServicePrincipal
	ActiveDirectoryApplication                 = "ActiveDirectoryApplication"
	ActiveDirectoryServicePrincipal            = "ActiveDirectoryServicePrincipal"
	ActiveDirectoryServicePrincipalAccessToken = "ActiveDirectoryServicePrincipalAccessToken"
	ActiveDirectoryDeviceCode                  = "ActiveDirectoryDeviceCode"
	ActiveDirectoryAzCli                       = "ActiveDirectoryAzCli"
	// New credential types added in azidentity v1.7+
	ActiveDirectoryAzureDeveloperCli = "ActiveDirectoryAzureDeveloperCli"
	ActiveDirectoryAzurePipelines    = "ActiveDirectoryAzurePipelines"
	ActiveDirectoryEnvironment       = "ActiveDirectoryEnvironment"
	ActiveDirectoryWorkloadIdentity  = "ActiveDirectoryWorkloadIdentity"
	ActiveDirectoryClientAssertion   = "ActiveDirectoryClientAssertion"
	ActiveDirectoryOnBehalfOf        = "ActiveDirectoryOnBehalfOf"
	scopeDefaultSuffix               = "/.default"
)

type azureFedAuthConfig struct {
	adalWorkflow byte
	mssqlConfig  msdsn.Config
	// The detected federated authentication library
	fedAuthLibrary  int
	fedAuthWorkflow string
	// Service principal logins
	clientID        string
	tenantID        string
	clientSecret    string
	certificatePath string
	resourceID      string

	// AD password/managed identity/interactive
	user                string
	password            string
	applicationClientID string

	// New fields for additional credential types
	serviceConnectionID string // For Azure Pipelines
	systemAccessToken   string // For Azure Pipelines
	userAssertion       string // For On-Behalf-Of flow
	clientAssertion     string // For Client Assertion
	
	// Common credential options
	additionallyAllowedTenants []string // For most credential types
	disableInstanceDiscovery   bool     // For most credential types
	tokenFilePath              string   // For WorkloadIdentity
	sendCertificateChain       bool     // For ClientCertificate
}

// parse returns a config based on an msdsn-style connection string
func parse(dsn string) (*azureFedAuthConfig, error) {
	mssqlConfig, err := msdsn.Parse(dsn)
	if err != nil {
		return nil, err
	}
	config := &azureFedAuthConfig{
		fedAuthLibrary: mssql.FedAuthLibraryReserved,
		mssqlConfig:    mssqlConfig,
	}

	err = config.validateParameters(mssqlConfig.Parameters)
	if err != nil {
		return nil, err
	}

	return config, nil
}

func (p *azureFedAuthConfig) validateParameters(params map[string]string) error {

	fedAuthWorkflow := params["fedauth"]
	if fedAuthWorkflow == "" {
		return nil
	}

	p.fedAuthLibrary = mssql.FedAuthLibraryADAL

	p.applicationClientID = params["applicationclientid"]

	switch {
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryPassword):
		if p.applicationClientID == "" {
			return errors.New("applicationclientid parameter is required for " + ActiveDirectoryPassword)
		}
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		p.user = params["user id"]
		p.password = params["password"]
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryIntegrated):
		// Active Directory Integrated authentication is not fully supported:
		// you can only use this by also implementing an a token provider
		// and supplying it via ActiveDirectoryTokenProvider in the Connection.
		p.adalWorkflow = mssql.FedAuthADALWorkflowIntegrated
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryManagedIdentity) || strings.EqualFold(fedAuthWorkflow, ActiveDirectoryMSI):
		// When using MSI, to request a specific client ID or user-assigned identity,
		// provide the ID in the "user id" parameter
		p.adalWorkflow = mssql.FedAuthADALWorkflowMSI
		p.resourceID = params["resource id"]
		p.clientID, _ = splitTenantAndClientID(params["user id"])
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryApplication) || strings.EqualFold(fedAuthWorkflow, ActiveDirectoryServicePrincipal):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		// Split the clientID@tenantID format
		// If no tenant is provided we'll use the one from the server
		p.clientID, p.tenantID = splitTenantAndClientID(params["user id"])
		if p.clientID == "" {
			return errors.New("Must provide 'client id[@tenant id]' as username parameter when using ActiveDirectoryApplication authentication")
		}

		p.clientSecret = params["password"]

		p.certificatePath = params["clientcertpath"]

		if p.certificatePath == "" && p.clientSecret == "" {
			return errors.New("Must provide 'password' parameter when using ActiveDirectoryApplication authentication without cert/key credentials")
		}
	case isPasswordWorkflowAuth(fedAuthWorkflow):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryInteractive):
		if p.applicationClientID == "" {
			return errors.New("applicationclientid parameter is required for " + ActiveDirectoryInteractive)
		}
		// user is an optional login hint
		p.user = params["user id"]
		// we don't really have a password but we need to use some value.
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryServicePrincipalAccessToken):
		p.fedAuthLibrary = mssql.FedAuthLibrarySecurityToken
		p.adalWorkflow = mssql.FedAuthADALWorkflowNone
		p.password = params["password"]

		if p.password == "" {
			return errors.New("Must provide 'password' parameter when using ActiveDirectoryServicePrincipalAccessToken authentication")
		}
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryAzurePipelines):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		// Split the clientID@tenantID format from connection string
		p.clientID, p.tenantID = splitTenantAndClientID(params["user id"])
		
		// If not provided in connection string, check environment variables
		if p.clientID == "" {
			p.clientID = os.Getenv("AZURESUBSCRIPTION_CLIENT_ID")
		}
		if p.tenantID == "" {
			p.tenantID = os.Getenv("AZURESUBSCRIPTION_TENANT_ID")
		}
		
		if p.clientID == "" {
			return errors.New("Must provide 'client id[@tenant id]' as username parameter or set AZURESUBSCRIPTION_CLIENT_ID environment variable when using ActiveDirectoryAzurePipelines authentication")
		}
		
		p.serviceConnectionID = params["serviceconnectionid"]
		if p.serviceConnectionID == "" {
			p.serviceConnectionID = os.Getenv("AZURESUBSCRIPTION_SERVICE_CONNECTION_ID")
		}
		if p.serviceConnectionID == "" {
			return errors.New("Must provide 'serviceconnectionid' parameter or set AZURESUBSCRIPTION_SERVICE_CONNECTION_ID environment variable when using ActiveDirectoryAzurePipelines authentication")
		}
		
		p.systemAccessToken = params["systemtoken"]
		if p.systemAccessToken == "" {
			p.systemAccessToken = os.Getenv("SYSTEM_ACCESSTOKEN")
		}
		if p.systemAccessToken == "" {
			return errors.New("Must provide 'systemtoken' parameter or set SYSTEM_ACCESSTOKEN environment variable when using ActiveDirectoryAzurePipelines authentication")
		}
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryClientAssertion):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		// Split the clientID@tenantID format
		p.clientID, p.tenantID = splitTenantAndClientID(params["user id"])
		if p.clientID == "" {
			return errors.New("Must provide 'client id[@tenant id]' as username parameter when using ActiveDirectoryClientAssertion authentication")
		}
		p.clientAssertion = params["clientassertion"]
		if p.clientAssertion == "" {
			return errors.New("Must provide 'clientassertion' parameter when using ActiveDirectoryClientAssertion authentication")
		}
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryWorkloadIdentity):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		// Split the clientID@tenantID format if provided
		// If no user id is provided, the credential will use environment variables
		if userID := params["user id"]; userID != "" {
			p.clientID, p.tenantID = splitTenantAndClientID(userID)
		}
	case strings.EqualFold(fedAuthWorkflow, ActiveDirectoryOnBehalfOf):
		p.adalWorkflow = mssql.FedAuthADALWorkflowPassword
		// Split the clientID@tenantID format
		p.clientID, p.tenantID = splitTenantAndClientID(params["user id"])
		if p.clientID == "" {
			return errors.New("Must provide 'client id[@tenant id]' as username parameter when using ActiveDirectoryOnBehalfOf authentication")
		}
		p.userAssertion = params["userassertion"]
		if p.userAssertion == "" {
			return errors.New("Must provide 'userassertion' parameter when using ActiveDirectoryOnBehalfOf authentication")
		}
		// On-behalf-of can use client secret, certificate, or client assertion
		p.clientSecret = params["password"]
		p.certificatePath = params["clientcertpath"]
		p.clientAssertion = params["clientassertion"]
		if p.clientSecret == "" && p.certificatePath == "" && p.clientAssertion == "" {
			return errors.New("Must provide one of 'password', 'clientcertpath', or 'clientassertion' parameter when using ActiveDirectoryOnBehalfOf authentication")
		}
	default:
		return fmt.Errorf("Invalid federated authentication type '%s': expected one of %+v",
			fedAuthWorkflow,
			[]string{ActiveDirectoryApplication, ActiveDirectoryServicePrincipal, ActiveDirectoryDefault, ActiveDirectoryIntegrated, ActiveDirectoryInteractive, ActiveDirectoryManagedIdentity, ActiveDirectoryMSI, ActiveDirectoryPassword, ActiveDirectoryAzCli, ActiveDirectoryDeviceCode, ActiveDirectoryAzureDeveloperCli, ActiveDirectoryAzurePipelines, ActiveDirectoryEnvironment, ActiveDirectoryWorkloadIdentity, ActiveDirectoryClientAssertion, ActiveDirectoryOnBehalfOf})
	}
	
	// Parse common credential options that apply to multiple auth types
	p.parseCommonCredentialOptions(params)
	
	p.fedAuthWorkflow = fedAuthWorkflow
	return nil
}

// parseCommonCredentialOptions parses connection string parameters that are common across multiple credential types
func (p *azureFedAuthConfig) parseCommonCredentialOptions(params map[string]string) {
	// AdditionallyAllowedTenants - comma or semicolon separated list of tenant IDs
	if allowedTenants := params["additionallyallowedtenants"]; allowedTenants != "" {
		// Support both comma and semicolon as separators (following Azure SDK convention)
		separators := []string{",", ";"}
		for _, sep := range separators {
			if strings.Contains(allowedTenants, sep) {
				p.additionallyAllowedTenants = strings.Split(allowedTenants, sep)
				// Trim whitespace from each tenant
				for i, tenant := range p.additionallyAllowedTenants {
					p.additionallyAllowedTenants[i] = strings.TrimSpace(tenant)
				}
				break
			}
		}
		// If no separators found, treat as single tenant
		if len(p.additionallyAllowedTenants) == 0 {
			p.additionallyAllowedTenants = []string{strings.TrimSpace(allowedTenants)}
		}
	}
	
	// DisableInstanceDiscovery - boolean flag for disconnected/private clouds
	if disableDiscovery := params["disableinstancediscovery"]; disableDiscovery != "" {
		p.disableInstanceDiscovery = strings.EqualFold(disableDiscovery, "true") || disableDiscovery == "1"
	}
	
	// TokenFilePath - for WorkloadIdentity specifically
	if tokenFilePath := params["tokenfilepath"]; tokenFilePath != "" {
		p.tokenFilePath = tokenFilePath
	}
	
	// SendCertificateChain - for ClientCertificate specifically  
	if sendCertChain := params["sendcertificatechain"]; sendCertChain != "" {
		p.sendCertificateChain = strings.EqualFold(sendCertChain, "true") || sendCertChain == "1"
	}
}

// isPasswordWorkflowAuth checks if the federated auth workflow uses the password workflow
func isPasswordWorkflowAuth(workflow string) bool {
	passwordWorkflows := []string{
		ActiveDirectoryDefault,
		ActiveDirectoryAzCli,
		ActiveDirectoryDeviceCode,
		ActiveDirectoryAzureDeveloperCli,
		ActiveDirectoryEnvironment,
	}
	
	for _, w := range passwordWorkflows {
		if strings.EqualFold(workflow, w) {
			return true
		}
	}
	return false
}

func splitTenantAndClientID(user string) (string, string) {
	// Split the user name into client id and tenant id at the @ symbol
	at := strings.IndexRune(user, '@')
	if at < 1 || at >= (len(user)-1) {
		return user, ""
	}

	return user[0:at], user[at+1:]
}

func splitAuthorityAndTenant(authorityURL string) (string, string) {
	separatorIndex := strings.LastIndex(authorityURL, "/")
	tenant := authorityURL[separatorIndex+1:]
	authority := authorityURL[:separatorIndex]
	return authority, tenant
}

func (p *azureFedAuthConfig) provideActiveDirectoryToken(ctx context.Context, serverSPN, stsURL string) (string, error) {
	var cred azcore.TokenCredential
	var err error
	authority, tenant := splitAuthorityAndTenant(stsURL)
	// client secret connection strings may override the server tenant
	if p.tenantID != "" {
		tenant = p.tenantID
	}
	scope := serverSPN
	if !strings.HasSuffix(serverSPN, scopeDefaultSuffix) {
		scope = serverSPN + scopeDefaultSuffix
	}

	switch p.fedAuthWorkflow {
	case ActiveDirectoryServicePrincipal, ActiveDirectoryApplication:
		switch {
		case p.certificatePath != "":
			var certData []byte
			certData, err = os.ReadFile(p.certificatePath)
			if err == nil {
				var certs []*x509.Certificate
				var key crypto.PrivateKey
				certs, key, err = azidentity.ParseCertificates(certData, []byte(p.clientSecret))
				if err == nil {
					options := &azidentity.ClientCertificateCredentialOptions{
						AdditionallyAllowedTenants: p.additionallyAllowedTenants,
						DisableInstanceDiscovery:   p.disableInstanceDiscovery,
						SendCertificateChain:       p.sendCertificateChain,
					}
					cred, err = azidentity.NewClientCertificateCredential(tenant, p.clientID, certs, key, options)
				}
			}
		default:
			options := &azidentity.ClientSecretCredentialOptions{
				AdditionallyAllowedTenants: p.additionallyAllowedTenants,
				DisableInstanceDiscovery:   p.disableInstanceDiscovery,
			}
			cred, err = azidentity.NewClientSecretCredential(tenant, p.clientID, p.clientSecret, options)
		}
	case ActiveDirectoryServicePrincipalAccessToken:
		return p.password, nil
	case ActiveDirectoryPassword:
		options := &azidentity.UsernamePasswordCredentialOptions{
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewUsernamePasswordCredential(tenant, p.applicationClientID, p.user, p.password, options)
	case ActiveDirectoryMSI, ActiveDirectoryManagedIdentity:
		if p.resourceID != "" {
			cred, err = azidentity.NewManagedIdentityCredential(&azidentity.ManagedIdentityCredentialOptions{ID: azidentity.ResourceID(p.resourceID)})
		} else if p.clientID != "" {
			cred, err = azidentity.NewManagedIdentityCredential(&azidentity.ManagedIdentityCredentialOptions{ID: azidentity.ClientID(p.clientID)})
		} else {
			cred, err = azidentity.NewManagedIdentityCredential(nil)
		}
	case ActiveDirectoryInteractive:
		c := cloud.Configuration{ActiveDirectoryAuthorityHost: authority}
		config := azcore.ClientOptions{Cloud: c}
		options := &azidentity.InteractiveBrowserCredentialOptions{
			ClientOptions:              config,
			ClientID:                   p.applicationClientID,
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewInteractiveBrowserCredential(options)

	case ActiveDirectoryDeviceCode:
		options := &azidentity.DeviceCodeCredentialOptions{
			ClientID:                   p.applicationClientID,
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewDeviceCodeCredential(options)
	case ActiveDirectoryAzCli:
		options := &azidentity.AzureCLICredentialOptions{
			TenantID:                   p.tenantID,
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
		}
		cred, err = azidentity.NewAzureCLICredential(options)
	case ActiveDirectoryAzureDeveloperCli:
		options := &azidentity.AzureDeveloperCLICredentialOptions{
			TenantID:                   p.tenantID,
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
		}
		cred, err = azidentity.NewAzureDeveloperCLICredential(options)
	case ActiveDirectoryAzurePipelines:
		cred, err = azidentity.NewAzurePipelinesCredential(tenant, p.clientID, p.serviceConnectionID, p.systemAccessToken, nil)
	case ActiveDirectoryEnvironment:
		options := &azidentity.EnvironmentCredentialOptions{
			DisableInstanceDiscovery: p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewEnvironmentCredential(options)
	case ActiveDirectoryWorkloadIdentity:
		options := &azidentity.WorkloadIdentityCredentialOptions{
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		if p.clientID != "" {
			options.ClientID = p.clientID
		}
		if p.tenantID != "" {
			options.TenantID = p.tenantID
		}
		if p.tokenFilePath != "" {
			options.TokenFilePath = p.tokenFilePath
		}
		cred, err = azidentity.NewWorkloadIdentityCredential(options)
	case ActiveDirectoryClientAssertion:
		assertionProvider := func(ctx context.Context) (string, error) {
			return p.clientAssertion, nil
		}
		options := &azidentity.ClientAssertionCredentialOptions{
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewClientAssertionCredential(tenant, p.clientID, assertionProvider, options)
	case ActiveDirectoryOnBehalfOf:
		switch {
		case p.certificatePath != "":
			var certData []byte
			certData, err = os.ReadFile(p.certificatePath)
			if err == nil {
				var certs []*x509.Certificate
				var key crypto.PrivateKey
				certs, key, err = azidentity.ParseCertificates(certData, []byte(p.clientSecret))
				if err == nil {
					options := &azidentity.OnBehalfOfCredentialOptions{
						AdditionallyAllowedTenants: p.additionallyAllowedTenants,
						DisableInstanceDiscovery:   p.disableInstanceDiscovery,
						SendCertificateChain:       p.sendCertificateChain,
					}
					cred, err = azidentity.NewOnBehalfOfCredentialWithCertificate(tenant, p.clientID, p.userAssertion, certs, key, options)
				}
			}
		case p.clientAssertion != "":
			assertionProvider := func(ctx context.Context) (string, error) {
				return p.clientAssertion, nil
			}
			options := &azidentity.OnBehalfOfCredentialOptions{
				AdditionallyAllowedTenants: p.additionallyAllowedTenants,
				DisableInstanceDiscovery:   p.disableInstanceDiscovery,
			}
			cred, err = azidentity.NewOnBehalfOfCredentialWithClientAssertions(tenant, p.clientID, p.userAssertion, assertionProvider, options)
		default:
			options := &azidentity.OnBehalfOfCredentialOptions{
				AdditionallyAllowedTenants: p.additionallyAllowedTenants,
				DisableInstanceDiscovery:   p.disableInstanceDiscovery,
			}
			cred, err = azidentity.NewOnBehalfOfCredentialWithSecret(tenant, p.clientID, p.userAssertion, p.clientSecret, options)
		}
	default:
		// Integrated just uses Default until azidentity adds Windows-specific authentication
		options := &azidentity.DefaultAzureCredentialOptions{
			AdditionallyAllowedTenants: p.additionallyAllowedTenants,
			DisableInstanceDiscovery:   p.disableInstanceDiscovery,
		}
		cred, err = azidentity.NewDefaultAzureCredential(options)
	}

	if err != nil {
		return "", err
	}
	opts := policy.TokenRequestOptions{Scopes: []string{scope}}
	tk, err := cred.GetToken(ctx, opts)
	if err != nil {
		return "", err
	}
	return tk.Token, err
}
