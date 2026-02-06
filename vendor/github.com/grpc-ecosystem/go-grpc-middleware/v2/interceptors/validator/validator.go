// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package validator

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The validateAller interface at protoc-gen-validate main branch.
// See https://github.com/envoyproxy/protoc-gen-validate/pull/468.
type validateAller interface {
	ValidateAll() error
}

// The validate interface starting with protoc-gen-validate v0.6.0.
// See https://github.com/envoyproxy/protoc-gen-validate/pull/455.
type validator interface {
	Validate(all bool) error
}

// The validate interface prior to protoc-gen-validate v0.6.0.
type validatorLegacy interface {
	Validate() error
}

func validate(ctx context.Context, reqOrRes interface{}, shouldFailFast bool, onValidationErrCallback OnValidationErrCallback) (err error) {
	if shouldFailFast {
		switch v := reqOrRes.(type) {
		case validatorLegacy:
			err = v.Validate()
		case validator:
			err = v.Validate(false)
		}
	} else {
		switch v := reqOrRes.(type) {
		case validateAller:
			err = v.ValidateAll()
		case validator:
			err = v.Validate(true)
		case validatorLegacy:
			err = v.Validate()
		}
	}

	if err == nil {
		return nil
	}

	if onValidationErrCallback != nil {
		onValidationErrCallback(ctx, err)
	}
	return status.Error(codes.InvalidArgument, err.Error())
}
