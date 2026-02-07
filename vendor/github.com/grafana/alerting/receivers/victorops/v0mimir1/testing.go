package v0mimir1

const FullValidConfigForTesting = ` {
	"api_url": "http://localhost",
	"api_key": "secret-api-key",
	"http_config": {},
	"routing_key": "team1",
	"message_type": "CRITICAL",
	"entity_display_name": "test entity",
	"state_message": "test state message",
	"monitoring_tool": "Grafana",
	"custom_fields": {
		"test": "test"
	},
	"send_resolved": true
}`
