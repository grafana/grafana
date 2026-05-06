package kafka

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"kafkaRestProxy": "http://localhost/", 
	"kafkaTopic" : "test-topic", 
	"description" : "test-description", 
	"details": "test-details", 
	"username": "test-user", 
	"password": "password", 
	"apiVersion": "v2", 
	"kafkaClusterId": "12345"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"password": "test-password"
}`
