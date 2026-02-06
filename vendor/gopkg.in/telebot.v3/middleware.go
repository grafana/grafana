package telebot

// MiddlewareFunc represents a middleware processing function,
// which get called before the endpoint group or specific handler.
type MiddlewareFunc func(HandlerFunc) HandlerFunc

func appendMiddleware(a, b []MiddlewareFunc) []MiddlewareFunc {
	if len(a) == 0 {
		return b
	}

	m := make([]MiddlewareFunc, 0, len(a)+len(b))
	return append(m, append(a, b...)...)
}

func applyMiddleware(h HandlerFunc, m ...MiddlewareFunc) HandlerFunc {
	for i := len(m) - 1; i >= 0; i-- {
		h = m[i](h)
	}
	return h
}

// Group is a separated group of handlers, united by the general middleware.
type Group struct {
	b          *Bot
	middleware []MiddlewareFunc
}

// Use adds middleware to the chain.
func (g *Group) Use(middleware ...MiddlewareFunc) {
	g.middleware = append(g.middleware, middleware...)
}

// Handle adds endpoint handler to the bot, combining group's middleware
// with the optional given middleware.
func (g *Group) Handle(endpoint interface{}, h HandlerFunc, m ...MiddlewareFunc) {
	g.b.Handle(endpoint, h, appendMiddleware(g.middleware, m)...)
}
