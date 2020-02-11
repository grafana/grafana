package redis

import (
	"fmt"
	"net"
	"strconv"
	"time"

	"gopkg.in/redis.v5/internal/proto"
)

// Implements proto.MultiBulkParse
func sliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	vals := make([]interface{}, 0, n)
	for i := int64(0); i < n; i++ {
		v, err := rd.ReadReply(sliceParser)
		if err == Nil {
			vals = append(vals, nil)
		} else if err != nil {
			return nil, err
		} else {
			switch vv := v.(type) {
			case []byte:
				vals = append(vals, string(vv))
			default:
				vals = append(vals, v)
			}
		}
	}
	return vals, nil
}

// Implements proto.MultiBulkParse
func intSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	ints := make([]int64, 0, n)
	for i := int64(0); i < n; i++ {
		n, err := rd.ReadIntReply()
		if err != nil {
			return nil, err
		}
		ints = append(ints, n)
	}
	return ints, nil
}

// Implements proto.MultiBulkParse
func boolSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	bools := make([]bool, 0, n)
	for i := int64(0); i < n; i++ {
		n, err := rd.ReadIntReply()
		if err != nil {
			return nil, err
		}
		bools = append(bools, n == 1)
	}
	return bools, nil
}

// Implements proto.MultiBulkParse
func stringSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	ss := make([]string, 0, n)
	for i := int64(0); i < n; i++ {
		s, err := rd.ReadStringReply()
		if err == Nil {
			ss = append(ss, "")
		} else if err != nil {
			return nil, err
		} else {
			ss = append(ss, s)
		}
	}
	return ss, nil
}

// Implements proto.MultiBulkParse
func floatSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	nn := make([]float64, 0, n)
	for i := int64(0); i < n; i++ {
		n, err := rd.ReadFloatReply()
		if err != nil {
			return nil, err
		}
		nn = append(nn, n)
	}
	return nn, nil
}

// Implements proto.MultiBulkParse
func stringStringMapParser(rd *proto.Reader, n int64) (interface{}, error) {
	m := make(map[string]string, n/2)
	for i := int64(0); i < n; i += 2 {
		key, err := rd.ReadStringReply()
		if err != nil {
			return nil, err
		}

		value, err := rd.ReadStringReply()
		if err != nil {
			return nil, err
		}

		m[key] = value
	}
	return m, nil
}

// Implements proto.MultiBulkParse
func stringIntMapParser(rd *proto.Reader, n int64) (interface{}, error) {
	m := make(map[string]int64, n/2)
	for i := int64(0); i < n; i += 2 {
		key, err := rd.ReadStringReply()
		if err != nil {
			return nil, err
		}

		n, err := rd.ReadIntReply()
		if err != nil {
			return nil, err
		}

		m[key] = n
	}
	return m, nil
}

// Implements proto.MultiBulkParse
func zSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	zz := make([]Z, n/2)
	for i := int64(0); i < n; i += 2 {
		var err error

		z := &zz[i/2]

		z.Member, err = rd.ReadStringReply()
		if err != nil {
			return nil, err
		}

		z.Score, err = rd.ReadFloatReply()
		if err != nil {
			return nil, err
		}
	}
	return zz, nil
}

// Implements proto.MultiBulkParse
func clusterSlotsParser(rd *proto.Reader, n int64) (interface{}, error) {
	slots := make([]ClusterSlot, n)
	for i := 0; i < len(slots); i++ {
		n, err := rd.ReadArrayLen()
		if err != nil {
			return nil, err
		}
		if n < 2 {
			err := fmt.Errorf("redis: got %d elements in cluster info, expected at least 2", n)
			return nil, err
		}

		start, err := rd.ReadIntReply()
		if err != nil {
			return nil, err
		}

		end, err := rd.ReadIntReply()
		if err != nil {
			return nil, err
		}

		nodes := make([]ClusterNode, n-2)
		for j := 0; j < len(nodes); j++ {
			n, err := rd.ReadArrayLen()
			if err != nil {
				return nil, err
			}
			if n != 2 && n != 3 {
				err := fmt.Errorf("got %d elements in cluster info address, expected 2 or 3", n)
				return nil, err
			}

			ip, err := rd.ReadStringReply()
			if err != nil {
				return nil, err
			}

			port, err := rd.ReadIntReply()
			if err != nil {
				return nil, err
			}
			nodes[j].Addr = net.JoinHostPort(ip, strconv.FormatInt(port, 10))

			if n == 3 {
				id, err := rd.ReadStringReply()
				if err != nil {
					return nil, err
				}
				nodes[j].Id = id
			}
		}

		slots[i] = ClusterSlot{
			Start: int(start),
			End:   int(end),
			Nodes: nodes,
		}
	}
	return slots, nil
}

func newGeoLocationParser(q *GeoRadiusQuery) proto.MultiBulkParse {
	return func(rd *proto.Reader, n int64) (interface{}, error) {
		var loc GeoLocation
		var err error

		loc.Name, err = rd.ReadStringReply()
		if err != nil {
			return nil, err
		}
		if q.WithDist {
			loc.Dist, err = rd.ReadFloatReply()
			if err != nil {
				return nil, err
			}
		}
		if q.WithGeoHash {
			loc.GeoHash, err = rd.ReadIntReply()
			if err != nil {
				return nil, err
			}
		}
		if q.WithCoord {
			n, err := rd.ReadArrayLen()
			if err != nil {
				return nil, err
			}
			if n != 2 {
				return nil, fmt.Errorf("got %d coordinates, expected 2", n)
			}

			loc.Longitude, err = rd.ReadFloatReply()
			if err != nil {
				return nil, err
			}
			loc.Latitude, err = rd.ReadFloatReply()
			if err != nil {
				return nil, err
			}
		}

		return &loc, nil
	}
}

func newGeoLocationSliceParser(q *GeoRadiusQuery) proto.MultiBulkParse {
	return func(rd *proto.Reader, n int64) (interface{}, error) {
		locs := make([]GeoLocation, 0, n)
		for i := int64(0); i < n; i++ {
			v, err := rd.ReadReply(newGeoLocationParser(q))
			if err != nil {
				return nil, err
			}
			switch vv := v.(type) {
			case []byte:
				locs = append(locs, GeoLocation{
					Name: string(vv),
				})
			case *GeoLocation:
				locs = append(locs, *vv)
			default:
				return nil, fmt.Errorf("got %T, expected string or *GeoLocation", v)
			}
		}
		return locs, nil
	}
}

func geoPosParser(rd *proto.Reader, n int64) (interface{}, error) {
	var pos GeoPos
	var err error

	pos.Longitude, err = rd.ReadFloatReply()
	if err != nil {
		return nil, err
	}

	pos.Latitude, err = rd.ReadFloatReply()
	if err != nil {
		return nil, err
	}

	return &pos, nil
}

func geoPosSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	positions := make([]*GeoPos, 0, n)
	for i := int64(0); i < n; i++ {
		v, err := rd.ReadReply(geoPosParser)
		if err != nil {
			if err == Nil {
				positions = append(positions, nil)
				continue
			}
			return nil, err
		}
		switch v := v.(type) {
		case *GeoPos:
			positions = append(positions, v)
		default:
			return nil, fmt.Errorf("got %T, expected *GeoPos", v)
		}
	}
	return positions, nil
}

func commandInfoParser(rd *proto.Reader, n int64) (interface{}, error) {
	var cmd CommandInfo
	var err error

	if n != 6 {
		return nil, fmt.Errorf("redis: got %d elements in COMMAND reply, wanted 6", n)
	}

	cmd.Name, err = rd.ReadStringReply()
	if err != nil {
		return nil, err
	}

	arity, err := rd.ReadIntReply()
	if err != nil {
		return nil, err
	}
	cmd.Arity = int8(arity)

	flags, err := rd.ReadReply(stringSliceParser)
	if err != nil {
		return nil, err
	}
	cmd.Flags = flags.([]string)

	firstKeyPos, err := rd.ReadIntReply()
	if err != nil {
		return nil, err
	}
	cmd.FirstKeyPos = int8(firstKeyPos)

	lastKeyPos, err := rd.ReadIntReply()
	if err != nil {
		return nil, err
	}
	cmd.LastKeyPos = int8(lastKeyPos)

	stepCount, err := rd.ReadIntReply()
	if err != nil {
		return nil, err
	}
	cmd.StepCount = int8(stepCount)

	for _, flag := range cmd.Flags {
		if flag == "readonly" {
			cmd.ReadOnly = true
			break
		}
	}

	return &cmd, nil
}

// Implements proto.MultiBulkParse
func commandInfoSliceParser(rd *proto.Reader, n int64) (interface{}, error) {
	m := make(map[string]*CommandInfo, n)
	for i := int64(0); i < n; i++ {
		v, err := rd.ReadReply(commandInfoParser)
		if err != nil {
			return nil, err
		}
		vv := v.(*CommandInfo)
		m[vv.Name] = vv

	}
	return m, nil
}

// Implements proto.MultiBulkParse
func timeParser(rd *proto.Reader, n int64) (interface{}, error) {
	if n != 2 {
		return nil, fmt.Errorf("got %d elements, expected 2", n)
	}

	sec, err := rd.ReadInt()
	if err != nil {
		return nil, err
	}

	microsec, err := rd.ReadInt()
	if err != nil {
		return nil, err
	}

	return time.Unix(sec, microsec*1000), nil
}
