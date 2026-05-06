package opsgenie

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
  "apiUrl": "http://localhost",
  "apiKey": "test-api-key",
  "message": "test-message",
  "description": "test-description",
  "autoClose": false,
  "overridePriority": false,
  "sendTagsAs": "both",
  "responders": [
    {
      "type": "team",
      "id": "test-id"
    },
    {
      "type": "user",
      "username": "test-user"
    },
    {
      "type": "schedule",
      "name": "test-schedule"
    }
  ]
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"apiKey": "test-secret-api-key"
}`
