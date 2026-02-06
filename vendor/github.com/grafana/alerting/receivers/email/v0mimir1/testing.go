package v0mimir1

const FullValidConfigForTesting = `{
	"to": "team@example.com",
	"from": "alertmanager@example.com",
	"smarthost": "smtp.example.com:587",
	"auth_username": "alertmanager",
	"auth_password": "password123",
	"auth_secret": "secret-auth",
	"auth_identity": "alertmanager",
	"require_tls": true,
	"text": "test email",
	"headers": {
		"Subject": "test subject"
	},
	"tls_config": {
		"insecure_skip_verify": false,     
		"server_name": "test-server-name"
	},
	"send_resolved": true
}`
