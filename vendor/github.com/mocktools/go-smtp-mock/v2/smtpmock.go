package smtpmock

// New builds new SMTP mock server based on passed configuration attributes
func New(config ConfigurationAttr) *Server {
	return newServer(newConfiguration(config))
}
