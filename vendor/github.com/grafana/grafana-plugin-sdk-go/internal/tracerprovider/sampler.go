package tracerprovider

import (
	"fmt"
	"math"
	"sync"
	"time"

	"go.opentelemetry.io/contrib/samplers/jaegerremote"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

type SamplerType string

const (
	SamplerTypeNone          SamplerType = ""
	SamplerTypeConst         SamplerType = "const"
	SamplerTypeProbabilistic SamplerType = "probabilistic"
	SamplerTypeRateLimiting  SamplerType = "rateLimiting"
	SamplerTypeRemote        SamplerType = "remote"
)

type SamplerOptions struct {
	SamplerType SamplerType
	Param       float64
	Remote      RemoteSamplerOptions
}

type RemoteSamplerOptions struct {
	URL         string
	ServiceName string
}

func newOtelSampler(opts SamplerOptions) (tracesdk.Sampler, error) {
	switch opts.SamplerType {
	case SamplerTypeConst, SamplerTypeNone:
		if opts.Param >= 1 {
			return tracesdk.AlwaysSample(), nil
		} else if opts.Param <= 0 {
			return tracesdk.NeverSample(), nil
		}
		return nil, fmt.Errorf("invalid Param for const SamplerType - must be 0 or 1: %f", opts.Param)
	case SamplerTypeProbabilistic:
		return tracesdk.TraceIDRatioBased(opts.Param), nil
	case SamplerTypeRateLimiting:
		return newRateLimiter(opts.Param), nil
	case SamplerTypeRemote:
		return jaegerremote.New(opts.Remote.ServiceName,
			jaegerremote.WithSamplingServerURL(opts.Remote.URL),
			jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(opts.Param)),
		), nil
	default:
		return nil, fmt.Errorf("invalid SamplerType type: %s", opts.SamplerType)
	}
}

type rateLimiter struct {
	sync.Mutex
	description string
	rps         float64
	balance     float64
	maxBalance  float64
	lastTick    time.Time

	now func() time.Time
}

func newRateLimiter(rps float64) *rateLimiter {
	return &rateLimiter{
		rps:         rps,
		description: fmt.Sprintf("RateLimitingSampler{%g}", rps),
		balance:     math.Max(rps, 1),
		maxBalance:  math.Max(rps, 1),
		lastTick:    time.Now(),
		now:         time.Now,
	}
}
func (rl *rateLimiter) ShouldSample(p tracesdk.SamplingParameters) tracesdk.SamplingResult {
	rl.Lock()
	defer rl.Unlock()
	psc := trace.SpanContextFromContext(p.ParentContext)
	if rl.balance >= 1 {
		rl.balance--
		return tracesdk.SamplingResult{Decision: tracesdk.RecordAndSample, Tracestate: psc.TraceState()}
	}
	currentTime := rl.now()
	elapsedTime := currentTime.Sub(rl.lastTick).Seconds()
	rl.lastTick = currentTime
	rl.balance = math.Min(rl.maxBalance, rl.balance+elapsedTime*rl.rps)
	if rl.balance >= 1 {
		rl.balance--
		return tracesdk.SamplingResult{Decision: tracesdk.RecordAndSample, Tracestate: psc.TraceState()}
	}
	return tracesdk.SamplingResult{Decision: tracesdk.Drop, Tracestate: psc.TraceState()}
}

func (rl *rateLimiter) Description() string { return rl.description }
