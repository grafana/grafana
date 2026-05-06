package threema

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"gateway_id": "*1234567",
	"recipient_id": "*1234567",
	"api_secret": "test-secret",
	"title" : "test-title",
	"description": "test-description"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"api_secret": "test-secret-secret"
}`
