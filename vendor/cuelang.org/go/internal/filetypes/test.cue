file: {

	filename: "foo.json"
	encoding: "json"
	form:     string | *""

	// extensions[".json"]

	form: "schema"
} & json

// tags maps command line tags to file properties.
json: {
	encoding: "json"
	form:     _
	if form == "schema" {
		interpretations: *"jsonschema" | _
	}
}
