package telegram

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"bottoken" :"test-token",
	"chatid" :"12345678",
	"message" :"test-message",
	"message_thread_id" :"13579",
	"parse_mode" :"html",
	"disable_web_page_preview" :true,
	"protect_content" :true,
	"disable_notifications" :true
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"bottoken": "test-secret-token"
}`
