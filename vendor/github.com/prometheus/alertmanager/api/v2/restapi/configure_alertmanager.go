// This file is safe to edit. Once it exists it will not be overwritten

// Copyright Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

package restapi

import (
	"crypto/tls"
	"net/http"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/runtime"
	"github.com/go-openapi/runtime/middleware"

	"github.com/prometheus/alertmanager/api/v2/restapi/operations"
	"github.com/prometheus/alertmanager/api/v2/restapi/operations/alert"
	"github.com/prometheus/alertmanager/api/v2/restapi/operations/alertgroup"
	"github.com/prometheus/alertmanager/api/v2/restapi/operations/general"
	"github.com/prometheus/alertmanager/api/v2/restapi/operations/receiver"
	"github.com/prometheus/alertmanager/api/v2/restapi/operations/silence"
)

//go:generate swagger generate server --target ../../v2 --name Alertmanager --spec ../openapi.yaml --principal interface{} --exclude-main

func configureFlags(api *operations.AlertmanagerAPI) {
	// api.CommandLineOptionsGroups = []swag.CommandLineOptionsGroup{ ... }
}

func configureAPI(api *operations.AlertmanagerAPI) http.Handler {
	// configure the api here
	api.ServeError = errors.ServeError

	// Set your custom logger if needed. Default one is log.Printf
	// Expected interface func(string, ...interface{})
	//
	// Example:
	// api.Logger = log.Printf

	api.UseSwaggerUI()
	// To continue using redoc as your UI, uncomment the following line
	// api.UseRedoc()

	api.JSONConsumer = runtime.JSONConsumer()

	api.JSONProducer = runtime.JSONProducer()

	if api.SilenceDeleteSilenceHandler == nil {
		api.SilenceDeleteSilenceHandler = silence.DeleteSilenceHandlerFunc(func(params silence.DeleteSilenceParams) middleware.Responder {
			return middleware.NotImplemented("operation silence.DeleteSilence has not yet been implemented")
		})
	}
	if api.AlertgroupGetAlertGroupsHandler == nil {
		api.AlertgroupGetAlertGroupsHandler = alertgroup.GetAlertGroupsHandlerFunc(func(params alertgroup.GetAlertGroupsParams) middleware.Responder {
			return middleware.NotImplemented("operation alertgroup.GetAlertGroups has not yet been implemented")
		})
	}
	if api.AlertGetAlertsHandler == nil {
		api.AlertGetAlertsHandler = alert.GetAlertsHandlerFunc(func(params alert.GetAlertsParams) middleware.Responder {
			return middleware.NotImplemented("operation alert.GetAlerts has not yet been implemented")
		})
	}
	if api.ReceiverGetReceiversHandler == nil {
		api.ReceiverGetReceiversHandler = receiver.GetReceiversHandlerFunc(func(params receiver.GetReceiversParams) middleware.Responder {
			return middleware.NotImplemented("operation receiver.GetReceivers has not yet been implemented")
		})
	}
	if api.SilenceGetSilenceHandler == nil {
		api.SilenceGetSilenceHandler = silence.GetSilenceHandlerFunc(func(params silence.GetSilenceParams) middleware.Responder {
			return middleware.NotImplemented("operation silence.GetSilence has not yet been implemented")
		})
	}
	if api.SilenceGetSilencesHandler == nil {
		api.SilenceGetSilencesHandler = silence.GetSilencesHandlerFunc(func(params silence.GetSilencesParams) middleware.Responder {
			return middleware.NotImplemented("operation silence.GetSilences has not yet been implemented")
		})
	}
	if api.GeneralGetStatusHandler == nil {
		api.GeneralGetStatusHandler = general.GetStatusHandlerFunc(func(params general.GetStatusParams) middleware.Responder {
			return middleware.NotImplemented("operation general.GetStatus has not yet been implemented")
		})
	}
	if api.AlertPostAlertsHandler == nil {
		api.AlertPostAlertsHandler = alert.PostAlertsHandlerFunc(func(params alert.PostAlertsParams) middleware.Responder {
			return middleware.NotImplemented("operation alert.PostAlerts has not yet been implemented")
		})
	}
	if api.SilencePostSilencesHandler == nil {
		api.SilencePostSilencesHandler = silence.PostSilencesHandlerFunc(func(params silence.PostSilencesParams) middleware.Responder {
			return middleware.NotImplemented("operation silence.PostSilences has not yet been implemented")
		})
	}

	api.PreServerShutdown = func() {}

	api.ServerShutdown = func() {}

	return setupGlobalMiddleware(api.Serve(setupMiddlewares))
}

// The TLS configuration before HTTPS server starts.
func configureTLS(tlsConfig *tls.Config) {
	// Make all necessary changes to the TLS configuration here.
}

// As soon as server is initialized but not run yet, this function will be called.
// If you need to modify a config, store server instance to stop it individually later, this is the place.
// This function can be called multiple times, depending on the number of serving schemes.
// scheme value will be set accordingly: "http", "https" or "unix".
func configureServer(s *http.Server, scheme, addr string) {
}

// The middleware configuration is for the handler executors. These do not apply to the swagger.json document.
// The middleware executes after routing but before authentication, binding and validation.
func setupMiddlewares(handler http.Handler) http.Handler {
	return handler
}

// The middleware configuration happens before anything, this middleware also applies to serving the swagger.json document.
// So this is a good place to plug in a panic handling middleware, logging and metrics.
func setupGlobalMiddleware(handler http.Handler) http.Handler {
	return handler
}
