package evaluate

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/open-feature/go-sdk-contrib/providers/ofrep/internal/outbound"
	of "github.com/open-feature/go-sdk/openfeature"
)

// OutboundResolver is responsible for resolving flags with outbound communications.
// It contains domain logic of the OFREP specification.
type OutboundResolver struct {
	client Outbound
}

// Outbound defines the contract for resolver's outbound communication, matching OFREP API.
type Outbound interface {
	// Single flag resolving
	Single(ctx context.Context, key string, payload []byte) (*outbound.Resolution, error)
}

func NewOutboundResolver(cfg outbound.Configuration) *OutboundResolver {
	return &OutboundResolver{client: outbound.NewHttp(cfg)}
}

func (g *OutboundResolver) resolveSingle(ctx context.Context, key string, evalCtx map[string]interface{}) (
	*successDto, *of.ResolutionError) {

	b, err := json.Marshal(requestFrom(evalCtx))
	if err != nil {
		resErr := of.NewGeneralResolutionError(fmt.Sprintf("context marshelling error: %v", err))
		return nil, &resErr
	}

	rsp, err := g.client.Single(ctx, key, b)
	if err != nil {
		resErr := of.NewGeneralResolutionError(fmt.Sprintf("ofrep request error: %v", err))
		return nil, &resErr
	}

	// detect handler based on known ofrep status codes
	switch rsp.Status {
	case 200:
		var success evaluationSuccess
		err := json.Unmarshal(rsp.Data, &success)
		if err != nil {
			resErr := of.NewParseErrorResolutionError(fmt.Sprintf("error parsing the response: %v", err))
			return nil, &resErr
		}
		return toSuccessDto(success)
	case 400:
		return nil, parseError400(rsp.Data)
	case 401, 403:
		resErr := of.NewGeneralResolutionError("authentication/authorization error")
		return nil, &resErr
	case 404:
		resErr := of.NewFlagNotFoundResolutionError(fmt.Sprintf("flag for key '%s' does not exist", key))
		return nil, &resErr
	case 429:
		after := parse429(rsp)
		var resErr of.ResolutionError
		if after == 0 {
			resErr = of.NewGeneralResolutionError("rate limit exceeded")
		} else {
			// todo - we may introduce a request blocker with derived time
			resErr = of.NewGeneralResolutionError(
				fmt.Sprintf("rate limit exceeded, try again after %f seconds", after.Seconds()))
		}
		return nil, &resErr
	case 500:
		return nil, parseError500(rsp.Data)
	default:
		resErr := of.NewGeneralResolutionError("invalid response")
		return nil, &resErr
	}
}

func parseError400(data []byte) *of.ResolutionError {
	var evalError evaluationError
	err := json.Unmarshal(data, &evalError)
	if err != nil {
		resErr := of.NewGeneralResolutionError(fmt.Sprintf("error parsing error payload: %v", err))
		return &resErr
	}

	var resErr of.ResolutionError
	switch evalError.ErrorCode {
	case string(of.ParseErrorCode):
		resErr = of.NewParseErrorResolutionError(evalError.ErrorDetails)
	case string(of.TargetingKeyMissingCode):
		resErr = of.NewTargetingKeyMissingResolutionError(evalError.ErrorDetails)
	case string(of.InvalidContextCode):
		resErr = of.NewInvalidContextResolutionError(evalError.ErrorDetails)
	case string(of.GeneralCode):
		resErr = of.NewGeneralResolutionError(evalError.ErrorDetails)
	default:
		resErr = of.NewGeneralResolutionError(evalError.ErrorDetails)
	}

	return &resErr
}

func parse429(rsp *outbound.Resolution) time.Duration {
	retryHeader := rsp.Headers.Get("Retry-After")
	if retryHeader == "" {
		return 0
	}

	if i, err := strconv.Atoi(retryHeader); err == nil {
		return time.Duration(i) * time.Second
	}

	parsed, err := http.ParseTime(retryHeader)
	if err != nil {
		return 0
	}

	return time.Until(parsed)
}

func parseError500(data []byte) *of.ResolutionError {
	var evalError errorResponse
	var resErr of.ResolutionError

	err := json.Unmarshal(data, &evalError)
	if err != nil {
		resErr = of.NewGeneralResolutionError(fmt.Sprintf("error parsing error payload: %v", err))
	} else {
		resErr = of.NewGeneralResolutionError(evalError.ErrorDetails)
	}

	return &resErr
}

// DTOs and OFREP models

type successDto struct {
	Value    interface{}
	Reason   string
	Variant  string
	Metadata map[string]interface{}
}

func toSuccessDto(e evaluationSuccess) (*successDto, *of.ResolutionError) {
	dto := &successDto{
		Value:   e.Value,
		Reason:  e.Reason,
		Variant: e.Variant,
	}

	if e.Metadata != nil {
		m, ok := e.Metadata.(map[string]interface{})
		if !ok {
			resErr := of.NewParseErrorResolutionError("metadata must be a map of string keys and arbitrary values")
			return nil, &resErr
		}
		dto.Metadata = m
	}
	return dto, nil
}

type request struct {
	Context interface{} `json:"context"`
}

func requestFrom(ctx map[string]interface{}) request {
	return request{
		Context: ctx,
	}
}

type evaluationSuccess struct {
	Value    interface{} `json:"value"`
	Key      string      `json:"key"`
	Reason   string      `json:"reason"`
	Variant  string      `json:"variant"`
	Metadata interface{} `json:"metadata"`
}

type evaluationError struct {
	Key          string `json:"key"`
	ErrorCode    string `json:"errorCode"`
	ErrorDetails string `json:"errorDetails"`
}

type errorResponse struct {
	ErrorDetails string `json:"errorDetails"`
}
