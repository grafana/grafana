package v1

// FullValidConfigForTesting is a string representation of a JSON object that contains all fields supported by the notifier Config. It can be used without secrets.
const FullValidConfigForTesting = `{
	"api_url":           	"http://localhost",
	"project":           	"Test Project",
	"summary":           	"Test Summary",
	"description":       	"Test Description",
	"labels":            	["Test Label", "Test Label 2"],
	"priority":          	"Test Priority",
	"issue_type":         	"Test Issue Type",
	"reopen_transition":  	"Test Reopen Transition",
	"resolve_transition": 	"Test Resolve Transition",
	"wont_fix_resolution":	"Test Won't Fix Resolution",
	"reopen_duration":    	"1m",
	"dedup_key_field":    	"10000",
	"fields": {
		"test-field": "test-value"
	},
	"user": "user",
	"password": "password"
}`

// FullValidSecretsForTesting is a string representation of JSON object that contains all fields that can be overridden from secrets
const FullValidSecretsForTesting = `{
	"user": "test-user",
	"password": "test-password"
}`
