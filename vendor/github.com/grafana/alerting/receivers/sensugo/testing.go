package sensugo

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url": "http://localhost",  
	"apikey": "test-api-key",
	"entity" : "test-entity",
	"check" : "test-check",
	"namespace" : "test-namespace",
	"handler" : "test-handler",
	"message" : "test-message"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"apikey": "test-secret-api-key"
}`
