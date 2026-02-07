package customizations

import (
	"github.com/aws/smithy-go/transport/http"
	"strings"
)

func updateS3HostForS3AccessPoint(req *http.Request) {
	updateHostPrefix(req, "s3", s3AccessPoint)
}

func updateS3HostForS3ObjectLambda(req *http.Request) {
	updateHostPrefix(req, "s3", s3ObjectLambda)
}

func updateHostPrefix(req *http.Request, oldEndpointPrefix, newEndpointPrefix string) {
	host := req.URL.Host
	if strings.HasPrefix(host, oldEndpointPrefix) {
		// For example if oldEndpointPrefix=s3 would replace to newEndpointPrefix
		req.URL.Host = newEndpointPrefix + host[len(oldEndpointPrefix):]
	}
}
