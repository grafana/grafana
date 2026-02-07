package goidentity

type Authenticator interface {
	Authenticate() (Identity, bool, error)
	Mechanism() string // gives the name of the type of authentication mechanism
}
