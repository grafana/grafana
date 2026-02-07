package authn

import (
	"strings"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/types"
)

var _ types.AuthInfo = (*AuthInfo)(nil)

type AuthInfo struct {
	at Claims[AccessTokenClaims]
	id *Claims[IDTokenClaims]
}

func NewAccessTokenAuthInfo(at Claims[AccessTokenClaims]) *AuthInfo {
	id := getIdInfo(at)
	return &AuthInfo{
		at: at,
		id: id,
	}
}

func NewIDTokenAuthInfo(at Claims[AccessTokenClaims], id *Claims[IDTokenClaims]) *AuthInfo {
	if id == nil {
		id = getIdInfo(at)
	}

	return &AuthInfo{
		at: at,
		id: id,
	}
}

// getIdInfo checks if user info from ID token claims are in the innermost actor of an access token.
// This can be the case if an ID token is sent in the request to sign an access token.
func getIdInfo(at Claims[AccessTokenClaims]) *Claims[IDTokenClaims] {
	identityActor := at.Rest.getIdentityActor()
	if identityActor == nil {
		return nil
	}

	claims := &Claims[IDTokenClaims]{
		Rest: identityActor.IDTokenClaims,
		Claims: jwt.Claims{
			Subject: identityActor.Subject,
		},
	}

	// Namespace is deliberately not set on the identity actor.
	// Instead use the namespace from the access token claims.
	claims.Rest.Namespace = at.Rest.Namespace
	return claims
}

func (a *AuthInfo) GetName() string {
	if a.id != nil {
		return a.id.Rest.getK8sName()
	}
	return a.GetSubject()
}

func (a *AuthInfo) GetUID() string {
	if a.id != nil {
		return a.id.Rest.getTypedUID()
	}
	return a.GetSubject()
}

func (a *AuthInfo) GetIdentifier() string {
	if a.id != nil {
		return a.id.Rest.Identifier
	}
	return strings.TrimPrefix(a.GetSubject(), string(types.TypeAccessPolicy)+":")
}

func (a *AuthInfo) GetIdentityType() types.IdentityType {
	if a.id != nil {
		return a.id.Rest.Type
	}
	return types.TypeAccessPolicy
}

func (a *AuthInfo) GetNamespace() string {
	if a.id != nil {
		return a.id.Rest.Namespace
	}
	return a.at.Rest.Namespace
}

func (a *AuthInfo) GetGroups() []string {
	return []string{}
}

func (a *AuthInfo) GetExtra() map[string][]string {
	result := map[string][]string{}

	if a.id != nil && a.id.token != "" {
		// Currently required for external k8s aggregation
		// but this should be removed in the not-to-distant future
		result["id-token"] = []string{a.id.token}
	}

	if a.at.Rest.ServiceIdentity != "" {
		result[ServiceIdentityKey] = []string{a.at.Rest.ServiceIdentity}
	}

	return result
}

func (a *AuthInfo) GetAudience() []string {
	return a.at.Audience
}

func (a *AuthInfo) GetSubject() string {
	if a.id != nil {
		return a.id.Subject
	}

	actor := a.at.Rest.getInnermostActor()
	if actor != nil {
		return actor.Subject
	}

	return a.at.Subject
}

func (a *AuthInfo) GetAuthenticatedBy() string {
	if a.id != nil {
		return a.id.Rest.AuthenticatedBy
	}
	return ""
}

func (a *AuthInfo) GetTokenPermissions() []string {
	// If it's a service acting on behalf of a user
	// we should not check token permission but delegated permissions instead
	// If it's a service acting on behalf of a second service
	// we currently just check the first service permissions
	if a.id != nil && a.id.Rest.Type != types.TypeAccessPolicy {
		return []string{}
	}
	return a.at.Rest.Permissions
}

func (a *AuthInfo) GetTokenDelegatedPermissions() []string {
	return a.at.Rest.DelegatedPermissions
}

func (a *AuthInfo) GetEmail() string {
	if a.id != nil {
		return a.id.Rest.Email
	}
	return ""
}

func (a *AuthInfo) GetEmailVerified() bool {
	if a.id != nil {
		return a.id.Rest.EmailVerified
	}
	return false
}

func (a *AuthInfo) GetUsername() string {
	if a.id != nil {
		return a.id.Rest.Username
	}
	return ""
}

func (a *AuthInfo) GetIDToken() string {
	if a.id != nil {
		return a.id.token
	}
	return ""
}
