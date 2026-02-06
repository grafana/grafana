package v1

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url": "http://localhost",
	"httpMethod": "PUT",
	"maxAlerts": "2",
	"authorization_scheme": "basic",
	"authorization_credentials": "",
	"username": "test-user",
	"password": "test-pass",
	"title": "test-title",
	"message": "test-message"		
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"username": "test-secret-user",
	"password": "test-secret-pass"
}`
