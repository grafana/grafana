package grpcutils

type AuthenticatorConfig struct {
	SigningKeysURL   string
	AllowedAudiences []string
	AllowInsecure    bool
}
