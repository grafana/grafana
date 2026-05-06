package pushover

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"priority": 1,
	"okPriority": 2,
	"retry": 555,
	"expire": 333,
	"device": "test-device",
	"sound": "test-sound",
	"okSound": "test-ok-sound",
	"uploadImage": false,
	"title": "test-title",
	"message": "test-message",
	"userKey": "test-user-key",
	"apiToken": "test-api-token"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"userKey": "test-secret-user-key",
	"apiToken": "test-secret-api-token"
}`
