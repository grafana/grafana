package controller

type ConfigurationChangeStatus = string

const (
	FlagConfigurationInitialized ConfigurationChangeStatus = "FLAG_CONFIGURATION_INITIALIZED"
	FlagConfigurationUpdated     ConfigurationChangeStatus = "FLAG_CONFIGURATION_UPDATED"
	FlagConfigurationNotChanged  ConfigurationChangeStatus = "FLAG_CONFIGURATION_NOT_CHANGED"
	ErrorConfigurationChange     ConfigurationChangeStatus = "ERROR_CONFIGURATION_CHANGE"
)
