package redis

import "context"

type PubSubCmdable interface {
	Publish(ctx context.Context, channel string, message interface{}) *IntCmd
	SPublish(ctx context.Context, channel string, message interface{}) *IntCmd
	PubSubChannels(ctx context.Context, pattern string) *StringSliceCmd
	PubSubNumSub(ctx context.Context, channels ...string) *MapStringIntCmd
	PubSubNumPat(ctx context.Context) *IntCmd
	PubSubShardChannels(ctx context.Context, pattern string) *StringSliceCmd
	PubSubShardNumSub(ctx context.Context, channels ...string) *MapStringIntCmd
}

// Publish posts the message to the channel.
func (c cmdable) Publish(ctx context.Context, channel string, message interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "publish", channel, message)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SPublish(ctx context.Context, channel string, message interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "spublish", channel, message)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubChannels(ctx context.Context, pattern string) *StringSliceCmd {
	args := []interface{}{"pubsub", "channels"}
	if pattern != "*" {
		args = append(args, pattern)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubNumSub(ctx context.Context, channels ...string) *MapStringIntCmd {
	args := make([]interface{}, 2+len(channels))
	args[0] = "pubsub"
	args[1] = "numsub"
	for i, channel := range channels {
		args[2+i] = channel
	}
	cmd := NewMapStringIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubShardChannels(ctx context.Context, pattern string) *StringSliceCmd {
	args := []interface{}{"pubsub", "shardchannels"}
	if pattern != "*" {
		args = append(args, pattern)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubShardNumSub(ctx context.Context, channels ...string) *MapStringIntCmd {
	args := make([]interface{}, 2+len(channels))
	args[0] = "pubsub"
	args[1] = "shardnumsub"
	for i, channel := range channels {
		args[2+i] = channel
	}
	cmd := NewMapStringIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubNumPat(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "pubsub", "numpat")
	_ = c(ctx, cmd)
	return cmd
}
