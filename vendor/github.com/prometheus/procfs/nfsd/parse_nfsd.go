// Copyright 2018 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package nfsd

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"github.com/prometheus/procfs/internal/util"
)

// ParseRPCStats returns stats read from /proc/net/rpc/nfsd
func ParseRPCStats(r io.Reader) (*RPCStats, error) {
	stats := &RPCStats{}

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Fields(scanner.Text())
		// require at least <key> <value>
		if len(parts) < 2 {
			return nil, fmt.Errorf("invalid NFSd metric line %q", line)
		}
		label := parts[0]

		var values []uint64
		var err error
		if label == "th" {
			if len(parts) < 3 {
				return nil, fmt.Errorf("invalid NFSd th metric line %q", line)
			}
			values, err = util.ParseUint64s(parts[1:3])
		} else {
			values, err = util.ParseUint64s(parts[1:])
		}
		if err != nil {
			return nil, fmt.Errorf("error parsing NFSd metric line: %s", err)
		}

		switch metricLine := parts[0]; metricLine {
		case "rc":
			stats.ReplyCache, err = parseReplyCache(values)
		case "fh":
			stats.FileHandles, err = parseFileHandles(values)
		case "io":
			stats.InputOutput, err = parseInputOutput(values)
		case "th":
			stats.Threads, err = parseThreads(values)
		case "ra":
			stats.ReadAheadCache, err = parseReadAheadCache(values)
		case "net":
			stats.Network, err = parseNetwork(values)
		case "rpc":
			stats.RPC, err = parseRPC(values)
		case "proc2":
			stats.V2Stats, err = parseV2Stats(values)
		case "proc3":
			stats.V3Stats, err = parseV3Stats(values)
		case "proc4":
			stats.V4Stats, err = parseV4Stats(values)
		case "proc4ops":
			stats.V4Ops, err = parseV4Ops(values)
		default:
			return nil, fmt.Errorf("unknown NFSd metric line %q", metricLine)
		}
		if err != nil {
			return nil, fmt.Errorf("errors parsing NFSd metric line: %s", err)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error scanning NFSd file: %s", err)
	}

	return stats, nil
}

func parseReplyCache(v []uint64) (ReplyCache, error) {
	if len(v) != 3 {
		return ReplyCache{}, fmt.Errorf("invalid ReplyCache line %q", v)
	}

	return ReplyCache{
		Hits:    v[0],
		Misses:  v[1],
		NoCache: v[2],
	}, nil
}

func parseFileHandles(v []uint64) (FileHandles, error) {
	if len(v) != 5 {
		return FileHandles{}, fmt.Errorf("invalid FileHandles, line %q", v)
	}

	return FileHandles{
		Stale:        v[0],
		TotalLookups: v[1],
		AnonLookups:  v[2],
		DirNoCache:   v[3],
		NoDirNoCache: v[4],
	}, nil
}

func parseInputOutput(v []uint64) (InputOutput, error) {
	if len(v) != 2 {
		return InputOutput{}, fmt.Errorf("invalid InputOutput line %q", v)
	}

	return InputOutput{
		Read:  v[0],
		Write: v[1],
	}, nil
}

func parseThreads(v []uint64) (Threads, error) {
	if len(v) != 2 {
		return Threads{}, fmt.Errorf("invalid Threads line %q", v)
	}

	return Threads{
		Threads: v[0],
		FullCnt: v[1],
	}, nil
}

func parseReadAheadCache(v []uint64) (ReadAheadCache, error) {
	if len(v) != 12 {
		return ReadAheadCache{}, fmt.Errorf("invalid ReadAheadCache line %q", v)
	}

	return ReadAheadCache{
		CacheSize:      v[0],
		CacheHistogram: v[1:11],
		NotFound:       v[11],
	}, nil
}

func parseNetwork(v []uint64) (Network, error) {
	if len(v) != 4 {
		return Network{}, fmt.Errorf("invalid Network line %q", v)
	}

	return Network{
		NetCount:   v[0],
		UDPCount:   v[1],
		TCPCount:   v[2],
		TCPConnect: v[3],
	}, nil
}

func parseRPC(v []uint64) (RPC, error) {
	if len(v) != 5 {
		return RPC{}, fmt.Errorf("invalid RPC line %q", v)
	}

	return RPC{
		RPCCount: v[0],
		BadCnt:   v[1],
		BadFmt:   v[2],
		BadAuth:  v[3],
		BadcInt:  v[4],
	}, nil
}

func parseV2Stats(v []uint64) (V2Stats, error) {
	values := int(v[0])
	if len(v[1:]) != values || values != 18 {
		return V2Stats{}, fmt.Errorf("invalid V2Stats line %q", v)
	}

	return V2Stats{
		Null:     v[1],
		GetAttr:  v[2],
		SetAttr:  v[3],
		Root:     v[4],
		Lookup:   v[5],
		ReadLink: v[6],
		Read:     v[7],
		WrCache:  v[8],
		Write:    v[9],
		Create:   v[10],
		Remove:   v[11],
		Rename:   v[12],
		Link:     v[13],
		SymLink:  v[14],
		MkDir:    v[15],
		RmDir:    v[16],
		ReadDir:  v[17],
		FsStat:   v[18],
	}, nil
}

func parseV3Stats(v []uint64) (V3Stats, error) {
	values := int(v[0])
	if len(v[1:]) != values || values != 22 {
		return V3Stats{}, fmt.Errorf("invalid V3Stats line %q", v)
	}

	return V3Stats{
		Null:        v[1],
		GetAttr:     v[2],
		SetAttr:     v[3],
		Lookup:      v[4],
		Access:      v[5],
		ReadLink:    v[6],
		Read:        v[7],
		Write:       v[8],
		Create:      v[9],
		MkDir:       v[10],
		SymLink:     v[11],
		MkNod:       v[12],
		Remove:      v[13],
		RmDir:       v[14],
		Rename:      v[15],
		Link:        v[16],
		ReadDir:     v[17],
		ReadDirPlus: v[18],
		FsStat:      v[19],
		FsInfo:      v[20],
		PathConf:    v[21],
		Commit:      v[22],
	}, nil
}

func parseV4Stats(v []uint64) (V4Stats, error) {
	values := int(v[0])
	if len(v[1:]) != values || values != 2 {
		return V4Stats{}, fmt.Errorf("invalid V4Stats line %q", v)
	}

	return V4Stats{
		Null:     v[1],
		Compound: v[2],
	}, nil
}

func parseV4Ops(v []uint64) (V4Ops, error) {
	values := int(v[0])
	if len(v[1:]) != values || values < 39 {
		return V4Ops{}, fmt.Errorf("invalid V4Ops line %q", v)
	}

	stats := V4Ops{
		Op0Unused:    v[1],
		Op1Unused:    v[2],
		Op2Future:    v[3],
		Access:       v[4],
		Close:        v[5],
		Commit:       v[6],
		Create:       v[7],
		DelegPurge:   v[8],
		DelegReturn:  v[9],
		GetAttr:      v[10],
		GetFH:        v[11],
		Link:         v[12],
		Lock:         v[13],
		Lockt:        v[14],
		Locku:        v[15],
		Lookup:       v[16],
		LookupRoot:   v[17],
		Nverify:      v[18],
		Open:         v[19],
		OpenAttr:     v[20],
		OpenConfirm:  v[21],
		OpenDgrd:     v[22],
		PutFH:        v[23],
		PutPubFH:     v[24],
		PutRootFH:    v[25],
		Read:         v[26],
		ReadDir:      v[27],
		ReadLink:     v[28],
		Remove:       v[29],
		Rename:       v[30],
		Renew:        v[31],
		RestoreFH:    v[32],
		SaveFH:       v[33],
		SecInfo:      v[34],
		SetAttr:      v[35],
		Verify:       v[36],
		Write:        v[37],
		RelLockOwner: v[38],
	}

	return stats, nil
}
