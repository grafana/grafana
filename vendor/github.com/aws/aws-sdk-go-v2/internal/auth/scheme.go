package auth

import (
	"context"
	"fmt"

	smithy "github.com/aws/smithy-go"
	"github.com/aws/smithy-go/middleware"
)

// SigV4 is a constant representing
// Authentication Scheme Signature Version 4
const SigV4 = "sigv4"

// SigV4A is a constant representing
// Authentication Scheme Signature Version 4A
const SigV4A = "sigv4a"

// SigV4S3Express identifies the S3 S3Express auth scheme.
const SigV4S3Express = "sigv4-s3express"

// None is a constant representing the
// None Authentication Scheme
const None = "none"

// SupportedSchemes is a data structure
// that indicates the list of supported AWS
// authentication schemes
var SupportedSchemes = map[string]bool{
	SigV4:          true,
	SigV4A:         true,
	SigV4S3Express: true,
	None:           true,
}

// AuthenticationScheme is a representation of
// AWS authentication schemes
type AuthenticationScheme interface {
	isAuthenticationScheme()
}

// AuthenticationSchemeV4 is a AWS SigV4 representation
type AuthenticationSchemeV4 struct {
	Name                  string
	SigningName           *string
	SigningRegion         *string
	DisableDoubleEncoding *bool
}

func (a *AuthenticationSchemeV4) isAuthenticationScheme() {}

// AuthenticationSchemeV4A is a AWS SigV4A representation
type AuthenticationSchemeV4A struct {
	Name                  string
	SigningName           *string
	SigningRegionSet      []string
	DisableDoubleEncoding *bool
}

func (a *AuthenticationSchemeV4A) isAuthenticationScheme() {}

// AuthenticationSchemeNone is a representation for the none auth scheme
type AuthenticationSchemeNone struct{}

func (a *AuthenticationSchemeNone) isAuthenticationScheme() {}

// NoAuthenticationSchemesFoundError is used in signaling
// that no authentication schemes have been specified.
type NoAuthenticationSchemesFoundError struct{}

func (e *NoAuthenticationSchemesFoundError) Error() string {
	return fmt.Sprint("No authentication schemes specified.")
}

// UnSupportedAuthenticationSchemeSpecifiedError is used in
// signaling that only unsupported authentication schemes
// were specified.
type UnSupportedAuthenticationSchemeSpecifiedError struct {
	UnsupportedSchemes []string
}

func (e *UnSupportedAuthenticationSchemeSpecifiedError) Error() string {
	return fmt.Sprint("Unsupported authentication scheme specified.")
}

// GetAuthenticationSchemes extracts the relevant authentication scheme data
// into a custom strongly typed Go data structure.
func GetAuthenticationSchemes(p *smithy.Properties) ([]AuthenticationScheme, error) {
	var result []AuthenticationScheme
	if !p.Has("authSchemes") {
		return nil, &NoAuthenticationSchemesFoundError{}
	}

	authSchemes, _ := p.Get("authSchemes").([]interface{})

	var unsupportedSchemes []string
	for _, scheme := range authSchemes {
		authScheme, _ := scheme.(map[string]interface{})

		version := authScheme["name"].(string)
		switch version {
		case SigV4, SigV4S3Express:
			v4Scheme := AuthenticationSchemeV4{
				Name:                  version,
				SigningName:           getSigningName(authScheme),
				SigningRegion:         getSigningRegion(authScheme),
				DisableDoubleEncoding: getDisableDoubleEncoding(authScheme),
			}
			result = append(result, AuthenticationScheme(&v4Scheme))
		case SigV4A:
			v4aScheme := AuthenticationSchemeV4A{
				Name:                  SigV4A,
				SigningName:           getSigningName(authScheme),
				SigningRegionSet:      getSigningRegionSet(authScheme),
				DisableDoubleEncoding: getDisableDoubleEncoding(authScheme),
			}
			result = append(result, AuthenticationScheme(&v4aScheme))
		case None:
			noneScheme := AuthenticationSchemeNone{}
			result = append(result, AuthenticationScheme(&noneScheme))
		default:
			unsupportedSchemes = append(unsupportedSchemes, authScheme["name"].(string))
			continue
		}
	}

	if len(result) == 0 {
		return nil, &UnSupportedAuthenticationSchemeSpecifiedError{
			UnsupportedSchemes: unsupportedSchemes,
		}
	}

	return result, nil
}

type disableDoubleEncoding struct{}

// SetDisableDoubleEncoding sets or modifies the disable double encoding option
// on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetDisableDoubleEncoding(ctx context.Context, value bool) context.Context {
	return middleware.WithStackValue(ctx, disableDoubleEncoding{}, value)
}

// GetDisableDoubleEncoding retrieves the disable double encoding option
// from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetDisableDoubleEncoding(ctx context.Context) (value bool, ok bool) {
	value, ok = middleware.GetStackValue(ctx, disableDoubleEncoding{}).(bool)
	return value, ok
}

func getSigningName(authScheme map[string]interface{}) *string {
	signingName, ok := authScheme["signingName"].(string)
	if !ok || signingName == "" {
		return nil
	}
	return &signingName
}

func getSigningRegionSet(authScheme map[string]interface{}) []string {
	untypedSigningRegionSet, ok := authScheme["signingRegionSet"].([]interface{})
	if !ok {
		return nil
	}
	signingRegionSet := []string{}
	for _, item := range untypedSigningRegionSet {
		signingRegionSet = append(signingRegionSet, item.(string))
	}
	return signingRegionSet
}

func getSigningRegion(authScheme map[string]interface{}) *string {
	signingRegion, ok := authScheme["signingRegion"].(string)
	if !ok || signingRegion == "" {
		return nil
	}
	return &signingRegion
}

func getDisableDoubleEncoding(authScheme map[string]interface{}) *bool {
	disableDoubleEncoding, ok := authScheme["disableDoubleEncoding"].(bool)
	if !ok {
		return nil
	}
	return &disableDoubleEncoding
}
