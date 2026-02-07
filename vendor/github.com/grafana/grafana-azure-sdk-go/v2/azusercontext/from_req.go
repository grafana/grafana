package azusercontext

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func WithUserFromQueryReq(ctx context.Context, req *backend.QueryDataRequest) context.Context {
	if req == nil {
		return ctx
	}

	idToken := getQueryReqHeader(req, "X-ID-Token")
	accessToken := extractBearerToken(getQueryReqHeader(req, "Authorization"))
	grafanaIdToken := getQueryReqHeader(req, "http_X-Grafana-Id")
	cookies := req.GetHTTPHeader(backend.CookiesHeaderName)

	currentUser := CurrentUserContext{
		User:           req.PluginContext.User,
		IdToken:        idToken,
		AccessToken:    accessToken,
		GrafanaIdToken: grafanaIdToken,
		Cookies:        cookies,
	}

	return WithCurrentUser(ctx, currentUser)
}

func WithUserFromResourceReq(ctx context.Context, req *backend.CallResourceRequest) context.Context {
	if req == nil {
		return ctx
	}

	idToken := getResourceReqHeader(req, "X-ID-Token")
	accessToken := extractBearerToken(getResourceReqHeader(req, "Authorization"))
	grafanaIdToken := getResourceReqHeader(req, "X-Grafana-Id")
	cookies := req.GetHTTPHeader(backend.CookiesHeaderName)

	currentUser := CurrentUserContext{
		User:           req.PluginContext.User,
		IdToken:        idToken,
		AccessToken:    accessToken,
		GrafanaIdToken: grafanaIdToken,
		Cookies:        cookies,
	}

	return WithCurrentUser(ctx, currentUser)
}

func WithUserFromHealthCheckReq(ctx context.Context, req *backend.CheckHealthRequest) context.Context {
	if req == nil {
		return ctx
	}

	idToken := getCheckHealthReqHeader(req, "X-ID-Token")
	accessToken := extractBearerToken(getCheckHealthReqHeader(req, "Authorization"))
	grafanaIdToken := getCheckHealthReqHeader(req, "http_X-Grafana-Id")
	cookies := req.GetHTTPHeader(backend.CookiesHeaderName)

	currentUser := CurrentUserContext{
		User:           req.PluginContext.User,
		IdToken:        idToken,
		AccessToken:    accessToken,
		GrafanaIdToken: grafanaIdToken,
		Cookies:        cookies,
	}

	return WithCurrentUser(ctx, currentUser)
}

func getQueryReqHeader(req *backend.QueryDataRequest, headerName string) string {
	headerNameCI := strings.ToLower(headerName)

	for name, value := range req.Headers {
		if strings.ToLower(name) == headerNameCI {
			return value
		}
	}

	return ""
}

func getResourceReqHeader(req *backend.CallResourceRequest, headerName string) string {
	headerNameCI := strings.ToLower(headerName)

	for name, values := range req.Headers {
		if strings.ToLower(name) == headerNameCI {
			if len(values) > 0 {
				return values[0]
			} else {
				return ""
			}
		}
	}

	return ""
}

func getCheckHealthReqHeader(req *backend.CheckHealthRequest, headerName string) string {
	headerNameCI := strings.ToLower(headerName)

	for name, value := range req.Headers {
		if strings.ToLower(name) == headerNameCI {
			return value
		}
	}

	return ""
}

func extractBearerToken(authorizationHeader string) string {
	const bearerPrefix = "Bearer "

	var accessToken string
	if strings.HasPrefix(authorizationHeader, bearerPrefix) {
		accessToken = strings.TrimPrefix(authorizationHeader, bearerPrefix)
	}

	return accessToken
}
