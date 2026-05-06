package sns

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"subject": "subject",
	"message": "message",
	"api_url": "https://sns.us-east-1.amazonaws.com",
	"topic_arn": "arn:aws:sns:us-east-1:0123456789:SNSTopicName",
	"target_arn": "arn:aws:sns:us-east-1:0123456789:SNSTopicName",
	"phone_number": "123-456-7890",
	"attributes": {"attr1": "val1"},
	"sigv4": {
		"region": "us-east-1",
		"access_key": "access-key",
		"secret_key": "secret-key",
		"profile": "default",
		"role_arn": "arn:aws:iam:us-east-1:0123456789:role/my-role"
	}
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"sigv4.access_key": "secret-access-key",
	"sigv4.secret_key": "secret-secret-key"
}`
