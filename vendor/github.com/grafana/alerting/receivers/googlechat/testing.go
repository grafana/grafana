package googlechat

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url": "http://localhost", 
	"title": "test-title", 
	"message": "test-message"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets.
const FullValidSecretsForTesting = `{
	"url": "http://localhost/url-secret"
}`
