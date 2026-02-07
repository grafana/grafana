// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO(msal): Write some tests. The original code this came from didn't have tests and I'm too
// tired at this point to do it. It, like many other *Manager code I found was broken because
// they didn't have mutex protection.

package oauth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops/authority"
)

type cacheEntry struct {
	Endpoints             authority.Endpoints
	ValidForDomainsInList map[string]bool
	// Aliases stores host aliases from instance discovery for quick lookup
	Aliases map[string]bool
}

func createcacheEntry(endpoints authority.Endpoints) cacheEntry {
	return cacheEntry{endpoints, map[string]bool{}, map[string]bool{}}
}

// AuthorityEndpoint retrieves endpoints from an authority for auth and token acquisition.
type authorityEndpoint struct {
	rest *ops.REST

	mu    sync.Mutex
	cache map[string]cacheEntry
}

// newAuthorityEndpoint is the constructor for AuthorityEndpoint.
func newAuthorityEndpoint(rest *ops.REST) *authorityEndpoint {
	m := &authorityEndpoint{rest: rest, cache: map[string]cacheEntry{}}
	return m
}

// ResolveEndpoints gets the authorization and token endpoints and creates an AuthorityEndpoints instance
func (m *authorityEndpoint) ResolveEndpoints(ctx context.Context, authorityInfo authority.Info, userPrincipalName string) (authority.Endpoints, error) {

	if endpoints, found := m.cachedEndpoints(authorityInfo, userPrincipalName); found {
		return endpoints, nil
	}

	endpoint, err := m.openIDConfigurationEndpoint(ctx, authorityInfo)
	if err != nil {
		return authority.Endpoints{}, err
	}

	resp, err := m.rest.Authority().GetTenantDiscoveryResponse(ctx, endpoint)
	if err != nil {
		return authority.Endpoints{}, err
	}
	if err := resp.Validate(); err != nil {
		return authority.Endpoints{}, fmt.Errorf("ResolveEndpoints(): %w", err)
	}

	tenant := authorityInfo.Tenant

	endpoints := authority.NewEndpoints(
		strings.Replace(resp.AuthorizationEndpoint, "{tenant}", tenant, -1),
		strings.Replace(resp.TokenEndpoint, "{tenant}", tenant, -1),
		strings.Replace(resp.Issuer, "{tenant}", tenant, -1),
		authorityInfo.Host)

	m.addCachedEndpoints(authorityInfo, userPrincipalName, endpoints)

	if err := resp.ValidateIssuerMatchesAuthority(authorityInfo.CanonicalAuthorityURI,
		m.cache[authorityInfo.CanonicalAuthorityURI].Aliases); err != nil {
		return authority.Endpoints{}, fmt.Errorf("ResolveEndpoints(): %w", err)
	}

	return endpoints, nil
}

// cachedEndpoints returns the cached endpoints if they exist. If not, we return false.
func (m *authorityEndpoint) cachedEndpoints(authorityInfo authority.Info, userPrincipalName string) (authority.Endpoints, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cacheEntry, ok := m.cache[authorityInfo.CanonicalAuthorityURI]; ok {
		if authorityInfo.AuthorityType == authority.ADFS {
			domain, err := adfsDomainFromUpn(userPrincipalName)
			if err == nil {
				if _, ok := cacheEntry.ValidForDomainsInList[domain]; ok {
					return cacheEntry.Endpoints, true
				}
			}
		}
		return cacheEntry.Endpoints, true
	}
	return authority.Endpoints{}, false
}

func (m *authorityEndpoint) addCachedEndpoints(authorityInfo authority.Info, userPrincipalName string, endpoints authority.Endpoints) {
	m.mu.Lock()
	defer m.mu.Unlock()

	updatedCacheEntry := createcacheEntry(endpoints)

	if authorityInfo.AuthorityType == authority.ADFS {
		// Since we're here, we've made a call to the backend.  We want to ensure we're caching
		// the latest values from the server.
		if cacheEntry, ok := m.cache[authorityInfo.CanonicalAuthorityURI]; ok {
			for k := range cacheEntry.ValidForDomainsInList {
				updatedCacheEntry.ValidForDomainsInList[k] = true
			}
		}
		domain, err := adfsDomainFromUpn(userPrincipalName)
		if err == nil {
			updatedCacheEntry.ValidForDomainsInList[domain] = true
		}
	}

	// Extract aliases from instance discovery metadata and add to cache
	for _, metadata := range authorityInfo.InstanceDiscoveryMetadata {
		for _, alias := range metadata.Aliases {
			updatedCacheEntry.Aliases[alias] = true
		}
	}

	m.cache[authorityInfo.CanonicalAuthorityURI] = updatedCacheEntry
}

func (m *authorityEndpoint) openIDConfigurationEndpoint(ctx context.Context, authorityInfo authority.Info) (string, error) {
	if authorityInfo.AuthorityType == authority.ADFS {
		return fmt.Sprintf("https://%s/adfs/.well-known/openid-configuration", authorityInfo.Host), nil
	} else if authorityInfo.AuthorityType == authority.DSTS {
		return fmt.Sprintf("https://%s/dstsv2/%s/v2.0/.well-known/openid-configuration", authorityInfo.Host, authority.DSTSTenant), nil

	} else if authorityInfo.ValidateAuthority && !authority.TrustedHost(authorityInfo.Host) {
		resp, err := m.rest.Authority().AADInstanceDiscovery(ctx, authorityInfo)
		if err != nil {
			return "", err
		}
		authorityInfo.InstanceDiscoveryMetadata = resp.Metadata
		return resp.TenantDiscoveryEndpoint, nil
	} else if authorityInfo.Region != "" {
		resp, err := m.rest.Authority().AADInstanceDiscovery(ctx, authorityInfo)
		if err != nil {
			return "", err
		}
		authorityInfo.InstanceDiscoveryMetadata = resp.Metadata
		return resp.TenantDiscoveryEndpoint, nil
	}

	return authorityInfo.CanonicalAuthorityURI + "v2.0/.well-known/openid-configuration", nil
}

func adfsDomainFromUpn(userPrincipalName string) (string, error) {
	parts := strings.Split(userPrincipalName, "@")
	if len(parts) < 2 {
		return "", errors.New("no @ present in user principal name")
	}
	return parts[1], nil
}
