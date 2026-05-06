package discord

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"url": "http://localhost", 
	"title": "test-title", 
	"message": "test-message", 
	"avatar_url" : "http://avatar", 
	"use_discord_username": true
}`
