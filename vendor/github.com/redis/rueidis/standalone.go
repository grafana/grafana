package rueidis

import (
	"context"
	"math/rand/v2"
	"sync/atomic"
	"time"

	"github.com/redis/rueidis/internal/cmds"
)

func newStandaloneClient(opt *ClientOption, connFn connFn, retryer retryHandler) (*standalone, error) {
	if len(opt.InitAddress) == 0 {
		return nil, ErrNoAddr
	}

	p := connFn(opt.InitAddress[0], opt)
	if err := p.Dial(); err != nil {
		return nil, err
	}
	s := &standalone{
		toReplicas:     opt.SendToReplicas,
		replicas:       make([]*singleClient, len(opt.Standalone.ReplicaAddress)),
		enableRedirect: opt.Standalone.EnableRedirect,
		connFn:         connFn,
		opt:            opt,
		retryer:        retryer,
	}
	s.primary.Store(newSingleClientWithConn(p, cmds.NewBuilder(cmds.NoSlot), !opt.DisableRetry, opt.DisableCache, retryer, false))

	for i := range s.replicas {
		replicaConn := connFn(opt.Standalone.ReplicaAddress[i], opt)
		if err := replicaConn.Dial(); err != nil {
			s.primary.Load().Close() // close primary if any replica fails
			for j := 0; j < i; j++ {
				s.replicas[j].Close()
			}
			return nil, err
		}
		s.replicas[i] = newSingleClientWithConn(replicaConn, cmds.NewBuilder(cmds.NoSlot), !opt.DisableRetry, opt.DisableCache, retryer, false)
	}
	return s, nil
}

type standalone struct {
	retryer        retryHandler
	toReplicas     func(Completed) bool
	primary        atomic.Pointer[singleClient]
	connFn         connFn
	opt            *ClientOption
	redirectCall   call
	replicas       []*singleClient
	enableRedirect bool
}

func (s *standalone) B() Builder {
	return s.primary.Load().B()
}

func (s *standalone) pick() int {
	if len(s.replicas) == 1 {
		return 0
	}
	return rand.IntN(len(s.replicas))
}

func (s *standalone) redirectToPrimary(addr string) error {
	// Create a new connection to the redirect address
	redirectOpt := *s.opt
	redirectOpt.InitAddress = []string{addr}
	redirectConn := s.connFn(addr, &redirectOpt)
	if err := redirectConn.Dial(); err != nil {
		return err
	}

	// Create a new primary client with the redirect connection
	newPrimary := newSingleClientWithConn(redirectConn, cmds.NewBuilder(cmds.NoSlot), !s.opt.DisableRetry, s.opt.DisableCache, s.retryer, false)

	// Atomically swap the primary and close the old one
	oldPrimary := s.primary.Swap(newPrimary)
	go func(oldPrimary *singleClient) {
		time.Sleep(time.Second * 5)
		oldPrimary.Close()
	}(oldPrimary)

	return nil
}

func (s *standalone) handleRedirect(ctx context.Context, err error) (error, bool) {
	if ret, yes := IsRedisErr(err); yes {
		if addr, ok := ret.IsRedirect(); ok {
			return s.redirectCall.Do(ctx, func() error {
				return s.redirectToPrimary(addr)
			}), ok
		}
	}
	return nil, false
}

func (s *standalone) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	attempts := 1

	if s.enableRedirect {
		cmd = cmd.Pin()
	}

retry:
	if s.toReplicas != nil && s.toReplicas(cmd) {
		resp = s.replicas[s.pick()].Do(ctx, cmd)
	} else {
		resp = s.primary.Load().Do(ctx, cmd)
	}

	if s.enableRedirect {
		if err, ok := s.handleRedirect(ctx, resp.Error()); ok {
			if err == nil || s.retryer.WaitOrSkipRetry(ctx, attempts, cmd, resp.Error()) {
				attempts++
				goto retry
			}
		}
		if resp.NonRedisError() == nil {
			cmds.PutCompletedForce(cmd)
		}
	}

	return resp
}

func (s *standalone) DoMulti(ctx context.Context, multi ...Completed) (resp []RedisResult) {
	attempts := 1

	if s.enableRedirect {
		for i := range multi {
			multi[i] = multi[i].Pin()
		}
	}

retry:
	toReplica := true
	for _, cmd := range multi {
		if s.toReplicas == nil || !s.toReplicas(cmd) {
			toReplica = false
			break
		}
	}
	if toReplica {
		resp = s.replicas[s.pick()].DoMulti(ctx, multi...)
	} else {
		resp = s.primary.Load().DoMulti(ctx, multi...)
	}

	if s.enableRedirect {
		for i, result := range resp {
			if err, ok := s.handleRedirect(ctx, result.Error()); ok {
				if err == nil || s.retryer.WaitOrSkipRetry(ctx, attempts, multi[i], result.Error()) {
					attempts++
					goto retry
				}
				break
			}
		}
		for i, result := range resp {
			if result.NonRedisError() == nil {
				cmds.PutCompletedForce(multi[i])
			}
		}
	}

	return resp
}

func (s *standalone) Receive(ctx context.Context, subscribe Completed, fn func(msg PubSubMessage)) error {
	if s.toReplicas != nil && s.toReplicas(subscribe) {
		return s.replicas[s.pick()].Receive(ctx, subscribe, fn)
	}
	return s.primary.Load().Receive(ctx, subscribe, fn)
}

func (s *standalone) Close() {
	s.primary.Load().Close()
	for _, replica := range s.replicas {
		replica.Close()
	}
}

func (s *standalone) DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) (resp RedisResult) {
	attempts := 1

	if s.enableRedirect {
		cmd = cmd.Pin()
	}

retry:
	resp = s.primary.Load().DoCache(ctx, cmd, ttl)

	if s.enableRedirect {
		if err, ok := s.handleRedirect(ctx, resp.Error()); ok {
			if err == nil || s.retryer.WaitOrSkipRetry(ctx, attempts, Completed(cmd), resp.Error()) {
				attempts++
				goto retry
			}
		}
		if resp.NonRedisError() == nil {
			cmds.PutCacheableForce(cmd)
		}
	}
	return
}

func (s *standalone) DoMultiCache(ctx context.Context, multi ...CacheableTTL) (resp []RedisResult) {
	attempts := 1

	if s.enableRedirect {
		for i := range multi {
			multi[i].Cmd = multi[i].Cmd.Pin()
		}
	}

retry:
	resp = s.primary.Load().DoMultiCache(ctx, multi...)

	if s.enableRedirect {
		for i, result := range resp {
			if err, ok := s.handleRedirect(ctx, result.Error()); ok {
				if err == nil || s.retryer.WaitOrSkipRetry(ctx, attempts, Completed(multi[i].Cmd), result.Error()) {
					attempts++
					goto retry
				}
				break
			}
		}
		for i, result := range resp {
			if result.NonRedisError() == nil {
				cmds.PutCacheableForce(multi[i].Cmd)
			}
		}
	}
	return
}

func (s *standalone) DoStream(ctx context.Context, cmd Completed) RedisResultStream {
	var stream RedisResultStream
	if s.toReplicas != nil && s.toReplicas(cmd) {
		stream = s.replicas[s.pick()].DoStream(ctx, cmd)
	} else {
		stream = s.primary.Load().DoStream(ctx, cmd)
	}
	return stream
}

func (s *standalone) DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream {
	var stream MultiRedisResultStream
	toReplica := true
	for _, cmd := range multi {
		if s.toReplicas == nil || !s.toReplicas(cmd) {
			toReplica = false
			break
		}
	}
	if toReplica {
		stream = s.replicas[s.pick()].DoMultiStream(ctx, multi...)
	} else {
		stream = s.primary.Load().DoMultiStream(ctx, multi...)
	}
	return stream
}

func (s *standalone) Dedicated(fn func(DedicatedClient) error) (err error) {
	return s.primary.Load().Dedicated(fn)
}

func (s *standalone) Dedicate() (client DedicatedClient, cancel func()) {
	return s.primary.Load().Dedicate()
}

func (s *standalone) Nodes() map[string]Client {
	nodes := make(map[string]Client, len(s.replicas)+1)
	for addr, client := range s.primary.Load().Nodes() {
		nodes[addr] = client
	}
	for _, replica := range s.replicas {
		for addr, client := range replica.Nodes() {
			nodes[addr] = client
		}
	}
	return nodes
}

func (s *standalone) Mode() ClientMode {
	return ClientModeStandalone
}
