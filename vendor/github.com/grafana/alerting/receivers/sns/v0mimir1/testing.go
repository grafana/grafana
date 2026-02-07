package v0mimir1

const FullValidConfigForTesting = ` {
	"http_config": {},
	"topic_arn": "arn:aws:sns:us-east-1:123456789012:alerts",
	"sigv4": {
		"Region": "us-east-1",
		"AccessKey": "secret-access-key",
		"SecretKey": "secret-secret-key",
		"Profile": "default",
		"RoleARN": "arn:aws:iam::123456789012:role/role-name"
	},
	"subject": "test subject",
	"message": "test message",
	"attributes": { "key1": "value1" },
	"send_resolved": true
}`
