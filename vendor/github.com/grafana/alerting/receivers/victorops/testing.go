package victorops

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url" : "http://localhost",
	"messageType" :"test-messagetype",
	"title" :"test-title",
	"description" :"test-description"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"url": "http://localhost-secret"
}`
