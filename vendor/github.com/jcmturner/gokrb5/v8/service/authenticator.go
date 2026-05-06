package service

import (
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	goidentity "github.com/jcmturner/goidentity/v6"
	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/config"
	"github.com/jcmturner/gokrb5/v8/credentials"
)

// NewKRB5BasicAuthenticator creates a new NewKRB5BasicAuthenticator
func NewKRB5BasicAuthenticator(headerVal string, krb5conf *config.Config, serviceSettings *Settings, clientSettings *client.Settings) KRB5BasicAuthenticator {
	return KRB5BasicAuthenticator{
		BasicHeaderValue: headerVal,
		clientConfig:     krb5conf,
		serviceSettings:  serviceSettings,
		clientSettings:   clientSettings,
	}
}

// KRB5BasicAuthenticator implements gokrb5.com/jcmturner/goidentity.Authenticator interface.
// It takes username and password so can be used for basic authentication.
type KRB5BasicAuthenticator struct {
	BasicHeaderValue string
	serviceSettings  *Settings
	clientSettings   *client.Settings
	clientConfig     *config.Config
	realm            string
	username         string
	password         string
}

// Authenticate and return the identity. The boolean indicates if the authentication was successful.
func (a KRB5BasicAuthenticator) Authenticate() (i goidentity.Identity, ok bool, err error) {
	a.realm, a.username, a.password, err = parseBasicHeaderValue(a.BasicHeaderValue)
	if err != nil {
		err = fmt.Errorf("could not parse basic authentication header: %v", err)
		return
	}
	cl := client.NewWithPassword(a.username, a.realm, a.password, a.clientConfig)
	err = cl.Login()
	if err != nil {
		// Username and/or password could be wrong
		err = fmt.Errorf("error with user credentials during login: %v", err)
		return
	}
	tkt, _, err := cl.GetServiceTicket(a.serviceSettings.SName())
	if err != nil {
		err = fmt.Errorf("could not get service ticket: %v", err)
		return
	}
	err = tkt.DecryptEncPart(a.serviceSettings.Keytab, a.serviceSettings.KeytabPrincipal())
	if err != nil {
		err = fmt.Errorf("could not decrypt service ticket: %v", err)
		return
	}
	cl.Credentials.SetAuthTime(time.Now().UTC())
	cl.Credentials.SetAuthenticated(true)
	isPAC, pac, err := tkt.GetPACType(a.serviceSettings.Keytab, a.serviceSettings.KeytabPrincipal(), a.serviceSettings.Logger())
	if isPAC && err != nil {
		err = fmt.Errorf("error processing PAC: %v", err)
		return
	}
	if isPAC {
		// There is a valid PAC. Adding attributes to creds
		cl.Credentials.SetADCredentials(credentials.ADCredentials{
			GroupMembershipSIDs: pac.KerbValidationInfo.GetGroupMembershipSIDs(),
			LogOnTime:           pac.KerbValidationInfo.LogOnTime.Time(),
			LogOffTime:          pac.KerbValidationInfo.LogOffTime.Time(),
			PasswordLastSet:     pac.KerbValidationInfo.PasswordLastSet.Time(),
			EffectiveName:       pac.KerbValidationInfo.EffectiveName.Value,
			FullName:            pac.KerbValidationInfo.FullName.Value,
			UserID:              int(pac.KerbValidationInfo.UserID),
			PrimaryGroupID:      int(pac.KerbValidationInfo.PrimaryGroupID),
			LogonServer:         pac.KerbValidationInfo.LogonServer.Value,
			LogonDomainName:     pac.KerbValidationInfo.LogonDomainName.Value,
			LogonDomainID:       pac.KerbValidationInfo.LogonDomainID.String(),
		})
	}
	ok = true
	i = cl.Credentials
	return
}

// Mechanism returns the authentication mechanism.
func (a KRB5BasicAuthenticator) Mechanism() string {
	return "Kerberos Basic"
}

func parseBasicHeaderValue(s string) (domain, username, password string, err error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return
	}
	v := string(b)
	vc := strings.SplitN(v, ":", 2)
	password = vc[1]
	// Domain and username can be specified in 2 formats:
	// <Username> - no domain specified
	// <Domain>\<Username>
	// <Username>@<Domain>
	if strings.Contains(vc[0], `\`) {
		u := strings.SplitN(vc[0], `\`, 2)
		domain = u[0]
		username = u[1]
	} else if strings.Contains(vc[0], `@`) {
		u := strings.SplitN(vc[0], `@`, 2)
		domain = u[1]
		username = u[0]
	} else {
		username = vc[0]
	}
	return
}
