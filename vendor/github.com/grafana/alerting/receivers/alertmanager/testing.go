package alertmanager

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url": "https://alertmanager-01.com",
	"basicAuthUser": "grafana",
	"basicAuthPassword": "admin"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"basicAuthPassword": "grafana-admin"
}`
