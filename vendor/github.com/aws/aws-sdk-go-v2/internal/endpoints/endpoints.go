package endpoints

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
)

const (
	defaultProtocol = "https"
	defaultSigner   = "v4"
)

var (
	protocolPriority = []string{"https", "http"}
	signerPriority   = []string{"v4"}
)

// Options provide configuration needed to direct how endpoints are resolved.
type Options struct {
	// Disable usage of HTTPS (TLS / SSL)
	DisableHTTPS bool
}

// Partitions is a slice of partition
type Partitions []Partition

// ResolveEndpoint resolves a service endpoint for the given region and options.
func (ps Partitions) ResolveEndpoint(region string, opts Options) (aws.Endpoint, error) {
	if len(ps) == 0 {
		return aws.Endpoint{}, fmt.Errorf("no partitions found")
	}

	for i := 0; i < len(ps); i++ {
		if !ps[i].canResolveEndpoint(region) {
			continue
		}

		return ps[i].ResolveEndpoint(region, opts)
	}

	// fallback to first partition format to use when resolving the endpoint.
	return ps[0].ResolveEndpoint(region, opts)
}

// Partition is an AWS partition description for a service and its' region endpoints.
type Partition struct {
	ID                string
	RegionRegex       *regexp.Regexp
	PartitionEndpoint string
	IsRegionalized    bool
	Defaults          Endpoint
	Endpoints         Endpoints
}

func (p Partition) canResolveEndpoint(region string) bool {
	_, ok := p.Endpoints[region]
	return ok || p.RegionRegex.MatchString(region)
}

// ResolveEndpoint resolves and service endpoint for the given region and options.
func (p Partition) ResolveEndpoint(region string, options Options) (resolved aws.Endpoint, err error) {
	if len(region) == 0 && len(p.PartitionEndpoint) != 0 {
		region = p.PartitionEndpoint
	}

	e, _ := p.endpointForRegion(region)

	return e.resolve(p.ID, region, p.Defaults, options), nil
}

func (p Partition) endpointForRegion(region string) (Endpoint, bool) {
	if e, ok := p.Endpoints[region]; ok {
		return e, true
	}

	if !p.IsRegionalized {
		return p.Endpoints[p.PartitionEndpoint], region == p.PartitionEndpoint
	}

	// Unable to find any matching endpoint, return
	// blank that will be used for generic endpoint creation.
	return Endpoint{}, false
}

// Endpoints is a map of service config regions to endpoints
type Endpoints map[string]Endpoint

// CredentialScope is the credential scope of a region and service
type CredentialScope struct {
	Region  string
	Service string
}

// Endpoint is a service endpoint description
type Endpoint struct {
	// True if the endpoint cannot be resolved for this partition/region/service
	Unresolveable aws.Ternary

	Hostname  string
	Protocols []string

	CredentialScope CredentialScope

	SignatureVersions []string `json:"signatureVersions"`
}

func (e Endpoint) resolve(partition, region string, def Endpoint, options Options) aws.Endpoint {
	var merged Endpoint
	merged.mergeIn(def)
	merged.mergeIn(e)
	e = merged

	var u string
	if e.Unresolveable != aws.TrueTernary {
		// Only attempt to resolve the endpoint if it can be resolved.
		hostname := strings.Replace(e.Hostname, "{region}", region, 1)

		scheme := getEndpointScheme(e.Protocols, options.DisableHTTPS)
		u = scheme + "://" + hostname
	}

	signingRegion := e.CredentialScope.Region
	if len(signingRegion) == 0 {
		signingRegion = region
	}
	signingName := e.CredentialScope.Service

	return aws.Endpoint{
		URL:           u,
		PartitionID:   partition,
		SigningRegion: signingRegion,
		SigningName:   signingName,
		SigningMethod: getByPriority(e.SignatureVersions, signerPriority, defaultSigner),
	}
}

func (e *Endpoint) mergeIn(other Endpoint) {
	if other.Unresolveable != aws.UnknownTernary {
		e.Unresolveable = other.Unresolveable
	}
	if len(other.Hostname) > 0 {
		e.Hostname = other.Hostname
	}
	if len(other.Protocols) > 0 {
		e.Protocols = other.Protocols
	}
	if len(other.CredentialScope.Region) > 0 {
		e.CredentialScope.Region = other.CredentialScope.Region
	}
	if len(other.CredentialScope.Service) > 0 {
		e.CredentialScope.Service = other.CredentialScope.Service
	}
	if len(other.SignatureVersions) > 0 {
		e.SignatureVersions = other.SignatureVersions
	}
}

func getEndpointScheme(protocols []string, disableHTTPS bool) string {
	if disableHTTPS {
		return "http"
	}

	return getByPriority(protocols, protocolPriority, defaultProtocol)
}

func getByPriority(s []string, p []string, def string) string {
	if len(s) == 0 {
		return def
	}

	for i := 0; i < len(p); i++ {
		for j := 0; j < len(s); j++ {
			if s[j] == p[i] {
				return s[j]
			}
		}
	}

	return s[0]
}

// MapFIPSRegion extracts the intrinsic AWS region from one that may have an
// embedded FIPS microformat.
func MapFIPSRegion(region string) string {
	const fipsInfix = "-fips-"
	const fipsPrefix = "fips-"
	const fipsSuffix = "-fips"

	if strings.Contains(region, fipsInfix) ||
		strings.Contains(region, fipsPrefix) ||
		strings.Contains(region, fipsSuffix) {
		region = strings.ReplaceAll(region, fipsInfix, "-")
		region = strings.ReplaceAll(region, fipsPrefix, "")
		region = strings.ReplaceAll(region, fipsSuffix, "")
	}

	return region
}
