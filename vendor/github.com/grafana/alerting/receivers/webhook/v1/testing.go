package v1

import (
	"fmt"

	"github.com/grafana/alerting/http"
)

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
var FullValidConfigForTesting = fmt.Sprintf(`{
	"url": %q,
	"httpMethod": "PUT",
	"maxAlerts": "2",
	"authorization_scheme": "basic",
	"authorization_credentials": "",
	"username": "test-user",
	"password": "test-pass",
	"title": "test-title",
	"message": "test-message",
	"tlsConfig": {
		"insecureSkipVerify": false,
		"clientCertificate": %q,
		"clientKey": %q,
		"caCertificate": %q
	},
	"hmacConfig": {
		"secret": "test-hmac-secret",
		"header": "X-Grafana-Alerting-Signature",
		"timestampHeader": "X-Grafana-Alerting-Timestamp"
	}
}`, NoopURL, http.TestCertPem, http.TestKeyPem, http.TestCACert)

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
var FullValidSecretsForTesting = fmt.Sprintf(`{
	"username": "test-secret-user",
	"password": "test-secret-pass",
	"tlsConfig.clientCertificate": %q,
	"tlsConfig.clientKey": %q,
	"tlsConfig.caCertificate": %q,
	"hmacConfig.secret": "test-override-hmac-secret"
}`, http.TestCertPem, http.TestKeyPem, http.TestCACert)
