package webex

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"message" :"test-message",  
	"room_id" :"test-room-id",
	"api_url" :"http://localhost",
	"bot_token" :"12345"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"bot_token" :"12345-secret"
}`
