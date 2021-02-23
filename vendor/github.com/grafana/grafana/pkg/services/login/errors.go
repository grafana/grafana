package login

import "errors"

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUsersQuotaReached  = errors.New("users quota reached")
	ErrGettingUserQuota   = errors.New("error getting user quota")
)
