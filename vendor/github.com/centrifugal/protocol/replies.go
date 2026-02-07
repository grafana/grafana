package protocol

import "sync"

type ReplyPoolCollection struct {
	connectReplyPool       sync.Pool
	subscribeReplyPool     sync.Pool
	unsubscribeReplyPool   sync.Pool
	publishReplyPool       sync.Pool
	rpcReplyPool           sync.Pool
	presenceReplyPool      sync.Pool
	presenceStatsReplyPool sync.Pool
	historyReplyPool       sync.Pool
	refreshReplyPool       sync.Pool
	subRefreshReplyPool    sync.Pool
}

//goland:noinspection GoUnusedGlobalVariable
var ReplyPool = &ReplyPoolCollection{}

func (p *ReplyPoolCollection) AcquireConnectReply(result *ConnectResult) *Reply {
	r := p.connectReplyPool.Get()
	if r == nil {
		return &Reply{
			Connect: result,
		}
	}
	reply := r.(*Reply)
	reply.Connect = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseConnectReply(r *Reply) {
	r.Connect = nil
	p.connectReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireSubscribeReply(result *SubscribeResult) *Reply {
	r := p.subscribeReplyPool.Get()
	if r == nil {
		return &Reply{
			Subscribe: result,
		}
	}
	reply := r.(*Reply)
	reply.Subscribe = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseSubscribeReply(r *Reply) {
	r.Subscribe = nil
	p.subscribeReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireUnsubscribeReply(result *UnsubscribeResult) *Reply {
	r := p.unsubscribeReplyPool.Get()
	if r == nil {
		return &Reply{
			Unsubscribe: result,
		}
	}
	reply := r.(*Reply)
	reply.Unsubscribe = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseUnsubscribeReply(r *Reply) {
	r.Unsubscribe = nil
	p.unsubscribeReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquirePublishReply(result *PublishResult) *Reply {
	r := p.publishReplyPool.Get()
	if r == nil {
		return &Reply{
			Publish: result,
		}
	}
	reply := r.(*Reply)
	reply.Publish = result
	return reply
}

func (p *ReplyPoolCollection) ReleasePublishReply(r *Reply) {
	r.Publish = nil
	p.publishReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireRPCReply(result *RPCResult) *Reply {
	r := p.rpcReplyPool.Get()
	if r == nil {
		return &Reply{
			Rpc: result,
		}
	}
	reply := r.(*Reply)
	reply.Rpc = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseRPCReply(r *Reply) {
	r.Rpc = nil
	p.rpcReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquirePresenceReply(result *PresenceResult) *Reply {
	r := p.presenceReplyPool.Get()
	if r == nil {
		return &Reply{
			Presence: result,
		}
	}
	reply := r.(*Reply)
	reply.Presence = result
	return reply
}

func (p *ReplyPoolCollection) ReleasePresenceReply(r *Reply) {
	r.Presence = nil
	p.presenceReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquirePresenceStatsReply(result *PresenceStatsResult) *Reply {
	r := p.presenceStatsReplyPool.Get()
	if r == nil {
		return &Reply{
			PresenceStats: result,
		}
	}
	reply := r.(*Reply)
	reply.PresenceStats = result
	return reply
}

func (p *ReplyPoolCollection) ReleasePresenceStatsReply(r *Reply) {
	r.PresenceStats = nil
	p.presenceStatsReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireHistoryReply(result *HistoryResult) *Reply {
	r := p.historyReplyPool.Get()
	if r == nil {
		return &Reply{
			History: result,
		}
	}
	reply := r.(*Reply)
	reply.History = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseHistoryReply(r *Reply) {
	r.History = nil
	p.historyReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireRefreshReply(result *RefreshResult) *Reply {
	r := p.refreshReplyPool.Get()
	if r == nil {
		return &Reply{
			Refresh: result,
		}
	}
	reply := r.(*Reply)
	reply.Refresh = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseRefreshReply(r *Reply) {
	r.Refresh = nil
	p.refreshReplyPool.Put(r)
}

func (p *ReplyPoolCollection) AcquireSubRefreshReply(result *SubRefreshResult) *Reply {
	r := p.subRefreshReplyPool.Get()
	if r == nil {
		return &Reply{
			SubRefresh: result,
		}
	}
	reply := r.(*Reply)
	reply.SubRefresh = result
	return reply
}

func (p *ReplyPoolCollection) ReleaseSubRefreshReply(r *Reply) {
	r.SubRefresh = nil
	p.subRefreshReplyPool.Put(r)
}
