package kubeconfig

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/plugin/router"
)

// LoadingMiddleware returns a new middleware that can be used on a router for
// automatically extracting, loading and storing a Config into the context.
// The middleware does not return an error if Config cannot be loaded.
// The middleware uses a default loader.
func LoadingMiddleware() router.MiddlewareFunc {
	return LoadingMiddlewareWithLoader(NewCachingLoader())
}

// LoadingMiddlewareWithLoader returns a new middleware that can be used on a router for
// automatically extracting, loading and storing a Config into the context.
// The middleware does not return an error if Config cannot be loaded.
// The middleware will use loader for loading the Config from secureJsonData.
func LoadingMiddlewareWithLoader(loader ConfigLoader) router.MiddlewareFunc {
	return func(handler router.HandlerFunc) router.HandlerFunc {
		return func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) {
			var cfg NamespacedConfig

			if err := loader.LoadFromSettings(*req.PluginContext.AppInstanceSettings, &cfg); err != nil {
				log.DefaultLogger.Error("error loading kubeconfig", "err", err.Error())
			}

			// Continue if loading fails.
			// Handlers are expected to deal with the case of missing config.
			handler(WithContext(ctx, cfg), req, sender)
		}
	}
}

// MustLoadMiddleware returns a new middleware that can be used on a router for
// automatically extracting, loading and storing a Config into the context.
// The middleware will return an error response if it fails to extract and load a Config from request.
// The middleware uses a default loader.
func MustLoadMiddleware() router.MiddlewareFunc {
	return MustLoadMiddlewareWithLoader(NewCachingLoader())
}

// MustLoadMiddlewareWithLoader returns a new middleware that can be used on a router
// for automatically extracting, loading and storing a Config into the context.
// The middleware will return an error response if it fails to extract and load a Config from request.
// The middleware will use loader for loading the Config from secureJsonData.
func MustLoadMiddlewareWithLoader(loader ConfigLoader) router.MiddlewareFunc {
	return func(handler router.HandlerFunc) router.HandlerFunc {
		return func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) {
			var cfg NamespacedConfig

			if err := loader.LoadFromSettings(*req.PluginContext.AppInstanceSettings, &cfg); err != nil {
				sendErr(sender, err)
				return
			}

			handler(WithContext(ctx, cfg), req, sender)
		}
	}
}

func sendErr(sender backend.CallResourceResponseSender, err error) {
	log.DefaultLogger.Error("error loading kubeconfig", "err", err.Error())

	if err := sender.Send(plugin.InternalError(err)); err != nil {
		log.DefaultLogger.Error("error sending response", "err", err.Error())
	}
}
