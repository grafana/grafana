package stats

import (
	"bufio"
	"context"
	"os"
	"path/filepath"
	"strings"
)

type InterfaceStats struct {
	PacketsReceived  int64 // in packets
	Link             int   // link status
	PacketsSent      int64 // out packets
	NumCRCErr        int   // input CRC errors
	NumOverflows     int   // packet overflows
	NumSoftOverflows int   // software overflow
	NumFramingErr    int   // framing errors
	NumBufferingErr  int   // buffering errors
	NumOutputErr     int   // output errors
	Promiscuous      int   // number of promiscuous opens
	Mbps             int   // megabits per sec
	Addr             string
}

func ReadInterfaceStats(ctx context.Context, opts ...Option) (*InterfaceStats, error) {
	cfg := newConfig(opts...)
	file := filepath.Join(cfg.rootdir, "stats")
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var stats InterfaceStats
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		s := strings.TrimSpace(scanner.Text())
		a := strings.SplitN(s, ":", 2)
		if len(a) != 2 {
			continue
		}
		var p intParser
		v := strings.TrimSpace(a[1])
		switch a[0] {
		case "in":
			stats.PacketsReceived = p.ParseInt64(v, 10)
		case "link":
			stats.Link = p.ParseInt(v, 10)
		case "out":
			stats.PacketsSent = p.ParseInt64(v, 10)
		case "crc":
			stats.NumCRCErr = p.ParseInt(v, 10)
		case "overflows":
			stats.NumOverflows = p.ParseInt(v, 10)
		case "soft overflows":
			stats.NumSoftOverflows = p.ParseInt(v, 10)
		case "framing errs":
			stats.NumFramingErr = p.ParseInt(v, 10)
		case "buffer errs":
			stats.NumBufferingErr = p.ParseInt(v, 10)
		case "output errs":
			stats.NumOutputErr = p.ParseInt(v, 10)
		case "prom":
			stats.Promiscuous = p.ParseInt(v, 10)
		case "mbps":
			stats.Mbps = p.ParseInt(v, 10)
		case "addr":
			stats.Addr = v
		}
		if err := p.Err(); err != nil {
			return nil, err
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return &stats, nil
}

type TCPStats struct {
	MaxConn            int
	MaxSegment         int
	ActiveOpens        int
	PassiveOpens       int
	EstablishedResets  int
	CurrentEstablished int
}
