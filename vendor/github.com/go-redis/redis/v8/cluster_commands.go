package redis

import (
	"context"
	"sync/atomic"
)

func (c *ClusterClient) DBSize(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "dbsize")
	var size int64
	err := c.ForEachMaster(ctx, func(ctx context.Context, master *Client) error {
		n, err := master.DBSize(ctx).Result()
		if err != nil {
			return err
		}
		atomic.AddInt64(&size, n)
		return nil
	})
	if err != nil {
		cmd.SetErr(err)
		return cmd
	}
	cmd.val = size
	return cmd
}
