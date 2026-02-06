package utils

import (
	"github.com/thomaspoignant/go-feature-flag/ffcontext"
)

// ContextToMap convert the context to a MAP to use the query on it.
func ContextToMap(ctx ffcontext.Context) map[string]interface{} {
	// We don't have a json copy of the user.
	userCopy := make(map[string]interface{})

	// Duplicate the map to keep User un-mutable
	for key, value := range ctx.GetCustom() {
		userCopy[key] = value
	}
	userCopy["anonymous"] = ctx.IsAnonymous()
	userCopy["key"] = ctx.GetKey()
	return userCopy
}
