package graph

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/openfga/openfga/pkg/logger"
)

const Hundred = 100

type ShadowResolverOpt func(*ShadowResolver)

func ShadowResolverWithName(name string) ShadowResolverOpt {
	return func(shadowResolver *ShadowResolver) {
		shadowResolver.name = name
	}
}

func ShadowResolverWithTimeout(timeout time.Duration) ShadowResolverOpt {
	return func(shadowResolver *ShadowResolver) {
		shadowResolver.shadowTimeout = timeout
	}
}

func ShadowResolverWithLogger(logger logger.Logger) ShadowResolverOpt {
	return func(shadowResolver *ShadowResolver) {
		shadowResolver.logger = logger
	}
}

type ShadowResolver struct {
	name          string
	main          CheckResolver
	shadow        CheckResolver
	shadowTimeout time.Duration
	logger        logger.Logger
	// only used for testing signals
	wg *sync.WaitGroup
}

var _ CheckResolver = (*ShadowResolver)(nil)

func (s ShadowResolver) ResolveCheck(ctx context.Context, req *ResolveCheckRequest) (*ResolveCheckResponse, error) {
	ctxClone := context.WithoutCancel(ctx) // needs typesystem and datastore etc
	mainStart := time.Now()
	res, err := s.main.ResolveCheck(ctx, req)
	mainDuration := time.Since(mainStart)
	if err != nil {
		return nil, err
	}

	resClone := res.clone()
	reqClone := req.clone()
	reqClone.VisitedPaths = nil // reset completely for evaluation
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		defer func() {
			if r := recover(); r != nil {
				s.logger.ErrorWithContext(ctx, "panic recovered",
					zap.String("resolver", s.name),
					zap.Any("error", err),
					zap.String("request", reqClone.GetTupleKey().String()),
					zap.String("store_id", reqClone.GetStoreID()),
					zap.String("model_id", reqClone.GetAuthorizationModelID()),
					zap.String("function", "ShadowResolver.ResolveCheck"),
				)
			}
		}()

		ctx, cancel := context.WithTimeout(ctxClone, s.shadowTimeout)
		defer cancel()
		shadowStart := time.Now()
		shadowRes, err := s.shadow.ResolveCheck(ctx, reqClone)
		shadowDuration := time.Since(shadowStart)
		if err != nil {
			s.logger.WarnWithContext(ctx, "shadow check errored",
				zap.String("resolver", s.name),
				zap.Error(err),
				zap.String("request", reqClone.GetTupleKey().String()),
				zap.String("store_id", reqClone.GetStoreID()),
				zap.String("model_id", reqClone.GetAuthorizationModelID()),
			)
			return
		}
		if shadowRes.GetAllowed() != resClone.GetAllowed() {
			s.logger.InfoWithContext(ctx, "shadow check difference",
				zap.String("resolver", s.name),
				zap.String("request", reqClone.GetTupleKey().String()),
				zap.String("store_id", reqClone.GetStoreID()),
				zap.String("model_id", reqClone.GetAuthorizationModelID()),
				zap.Bool("main", resClone.GetAllowed()),
				zap.Bool("main_cycle", resClone.GetCycleDetected()),
				zap.Int64("main_latency", mainDuration.Milliseconds()),
				zap.Bool("shadow", shadowRes.GetAllowed()),
				zap.Bool("shadow_cycle", shadowRes.GetCycleDetected()),
				zap.Int64("shadow_latency", shadowDuration.Milliseconds()),
			)
		} else {
			s.logger.InfoWithContext(ctx, "shadow check match",
				zap.Int64("main_latency", mainDuration.Milliseconds()),
				zap.Int64("shadow_latency", shadowDuration.Milliseconds()),
			)
		}
	}()

	return res, nil
}

func (s ShadowResolver) Close() {
	s.main.Close()
	s.shadow.Close()
}

func (s ShadowResolver) SetDelegate(delegate CheckResolver) {
	s.main.SetDelegate(delegate)
	// shadow should result in noop regardless of outcome
}

func (s ShadowResolver) GetDelegate() CheckResolver {
	return s.main.GetDelegate()
}

func NewShadowChecker(main CheckResolver, shadow CheckResolver, opts ...ShadowResolverOpt) *ShadowResolver {
	r := &ShadowResolver{name: "check", main: main, shadow: shadow, wg: &sync.WaitGroup{}}

	for _, opt := range opts {
		opt(r)
	}

	return r
}
