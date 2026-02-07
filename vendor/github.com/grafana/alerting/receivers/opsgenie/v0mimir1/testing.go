package v0mimir1

const FullValidConfigForTesting = `{
	"api_key": "api-secret-key",
	"api_url": "http://localhost",
	"http_config": {},
	"message": "test message",
	"description": "test description",
	"source": "Alertmanager",
	"details": {
		"firing": "test firing"
	},
	"entity": "test entity",
	"responders": [{ "type": "team", "name": "ops-team" }],
	"actions": "test actions",
	"tags": "test-tags",   
	"note": "Triggered by Alertmanager",
	"priority": "P3",
	"update_alerts": true,
	"send_resolved": true
}`
