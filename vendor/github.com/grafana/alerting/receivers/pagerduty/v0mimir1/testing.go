package v0mimir1

const FullValidConfigForTesting = ` {
	"url": "http://localhost/",
	"http_config": {},
	"routing_key": "test-routing-secret-key",
	"service_key": "test-service-secret-key",
	"client": "Alertmanager",
	"client_url": "https://monitoring.example.com",
	"description": "test description",
	"severity": "test severity",
	"details": {
	  "firing": "test firing"
	},
	"images": [
		{ 
			"alt": "test alt",
			"src": "test src",
			"href": "http://localhost"
		}
	],
	"links": [
		{
			"href": "http://localhost",
			"text": "test text"     
		}
	],
	"source": "test source",
	"class": "test class",
	"component": "test component",
	"group": "test group",
	"send_resolved": true
}`
