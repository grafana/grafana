package email

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"addresses": "test@grafana.com", 
	"subject": "test-subject", 
	"message": "test-message", 
	"singleEmail": true
}`
