// SPDX-License-Identifier: BSD-3-Clause
//go:build aix && cgo

package net

import (
	"context"

	"github.com/power-devops/perfstat"
)

func IOCountersWithContext(ctx context.Context, pernic bool) ([]IOCountersStat, error) {
	ifs, err := perfstat.NetIfaceStat()
	if err != nil {
		return nil, err
	}

	iocounters := make([]IOCountersStat, 0, len(ifs))
	for _, netif := range ifs {
		n := IOCountersStat{
			Name:        netif.Name,
			BytesSent:   uint64(netif.OBytes),
			BytesRecv:   uint64(netif.IBytes),
			PacketsSent: uint64(netif.OPackets),
			PacketsRecv: uint64(netif.IPackets),
			Errin:       uint64(netif.OErrors),
			Errout:      uint64(netif.IErrors),
			Dropout:     uint64(netif.XmitDrops),
		}
		iocounters = append(iocounters, n)
	}
	if !pernic {
		return getIOCountersAll(iocounters), nil
	}
	return iocounters, nil
}
