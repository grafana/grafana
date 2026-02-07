package v0mimir1

const FullValidConfigForTesting = `{
	"api_url": "http://localhost",
	"http_config": {},
	"channel": "#alerts",
	"username": "Alerting Team",
	"color": "danger",
	"title": "test title",
	"title_link": "http://localhost",
	"pretext": "test pretext",
	"text": "test text",
	"fields": [ 
		{
			"title": "test title",
			"value": "test value",
			"short": true   
		}
	],
	"short_fields": true,
	"footer": "test footer",
	"fallback": "test fallback",
	"callback_id": "test callback id",
	"icon_emoji": ":warning:",
	"icon_url": "https://example.com/icon.png",
	"image_url": "https://example.com/image.png",
	"thumb_url": "https://example.com/thumb.png",
	"link_names": true,
	"mrkdwn_in": ["fallback", "pretext", "text"],
	"actions": [
		{
			"type": "test-type",
			"text": "test-text",
			"url": "http://localhost",
			"style": "test-style",
			"name": "test-name",
			"value": "test-value",
			"confirm": {
				"title": "test-title",
				"text": "test-text",
				"ok_text": "test-ok-text",
				"dismiss_text": "test-dismiss-text"     
			}
		}
	],
	"send_resolved": true
}`
