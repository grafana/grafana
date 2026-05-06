package slack

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"endpointUrl": "http://localhost/endpoint_url",
	"url": "http://localhost/url",
	"token": "test-token",
	"recipient": "test-recipient",
	"text": "test-text",
	"title": "test-title",
	"username": "test-username",
	"icon_emoji": "test-icon",
	"icon_url": "http://localhost/icon_url",
	"mentionChannel": "channel",
	"mentionUsers": "test-mentionUsers",
	"mentionGroups": "test-mentionGroups",
	"color": "test-color"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"url": "http://localhost/url-secret",
	"token": "test-secret-token"
}`
