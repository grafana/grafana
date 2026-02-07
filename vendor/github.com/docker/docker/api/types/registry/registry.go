package registry // import "github.com/docker/docker/api/types/registry"

import (
	"encoding/json"
	"net"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// ServiceConfig stores daemon registry services configuration.
type ServiceConfig struct {
	AllowNondistributableArtifactsCIDRs     []*NetIPNet `json:"AllowNondistributableArtifactsCIDRs,omitempty"`     // Deprecated: non-distributable artifacts are deprecated and enabled by default. This field will be removed in the next release.
	AllowNondistributableArtifactsHostnames []string    `json:"AllowNondistributableArtifactsHostnames,omitempty"` // Deprecated: non-distributable artifacts are deprecated and enabled by default. This field will be removed in the next release.

	InsecureRegistryCIDRs []*NetIPNet           `json:"InsecureRegistryCIDRs"`
	IndexConfigs          map[string]*IndexInfo `json:"IndexConfigs"`
	Mirrors               []string
}

// MarshalJSON implements a custom marshaler to include legacy fields
// in API responses.
func (sc ServiceConfig) MarshalJSON() ([]byte, error) {
	tmp := map[string]interface{}{
		"InsecureRegistryCIDRs": sc.InsecureRegistryCIDRs,
		"IndexConfigs":          sc.IndexConfigs,
		"Mirrors":               sc.Mirrors,
	}
	if sc.AllowNondistributableArtifactsCIDRs != nil {
		tmp["AllowNondistributableArtifactsCIDRs"] = nil
	}
	if sc.AllowNondistributableArtifactsHostnames != nil {
		tmp["AllowNondistributableArtifactsHostnames"] = nil
	}
	return json.Marshal(tmp)
}

// NetIPNet is the net.IPNet type, which can be marshalled and
// unmarshalled to JSON
type NetIPNet net.IPNet

// String returns the CIDR notation of ipnet
func (ipnet *NetIPNet) String() string {
	return (*net.IPNet)(ipnet).String()
}

// MarshalJSON returns the JSON representation of the IPNet
func (ipnet *NetIPNet) MarshalJSON() ([]byte, error) {
	return json.Marshal((*net.IPNet)(ipnet).String())
}

// UnmarshalJSON sets the IPNet from a byte array of JSON
func (ipnet *NetIPNet) UnmarshalJSON(b []byte) (err error) {
	var ipnetStr string
	if err = json.Unmarshal(b, &ipnetStr); err == nil {
		var cidr *net.IPNet
		if _, cidr, err = net.ParseCIDR(ipnetStr); err == nil {
			*ipnet = NetIPNet(*cidr)
		}
	}
	return
}

// IndexInfo contains information about a registry
//
// RepositoryInfo Examples:
//
//	{
//	  "Index" : {
//	    "Name" : "docker.io",
//	    "Mirrors" : ["https://registry-2.docker.io/v1/", "https://registry-3.docker.io/v1/"],
//	    "Secure" : true,
//	    "Official" : true,
//	  },
//	  "RemoteName" : "library/debian",
//	  "LocalName" : "debian",
//	  "CanonicalName" : "docker.io/debian"
//	  "Official" : true,
//	}
//
//	{
//	  "Index" : {
//	    "Name" : "127.0.0.1:5000",
//	    "Mirrors" : [],
//	    "Secure" : false,
//	    "Official" : false,
//	  },
//	  "RemoteName" : "user/repo",
//	  "LocalName" : "127.0.0.1:5000/user/repo",
//	  "CanonicalName" : "127.0.0.1:5000/user/repo",
//	  "Official" : false,
//	}
type IndexInfo struct {
	// Name is the name of the registry, such as "docker.io"
	Name string
	// Mirrors is a list of mirrors, expressed as URIs
	Mirrors []string
	// Secure is set to false if the registry is part of the list of
	// insecure registries. Insecure registries accept HTTP and/or accept
	// HTTPS with certificates from unknown CAs.
	Secure bool
	// Official indicates whether this is an official registry
	Official bool
}

// DistributionInspect describes the result obtained from contacting the
// registry to retrieve image metadata
type DistributionInspect struct {
	// Descriptor contains information about the manifest, including
	// the content addressable digest
	Descriptor ocispec.Descriptor
	// Platforms contains the list of platforms supported by the image,
	// obtained by parsing the manifest
	Platforms []ocispec.Platform
}
