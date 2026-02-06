package query

import (
	"math"
	"sort"
	"strings"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/csvq/lib/json"
	"github.com/mithrandie/csvq/lib/value"
	txjson "github.com/mithrandie/go-text/json"

	"github.com/mithrandie/ternary"
)

type AggregateFunction func([]value.Primary, *option.Flags) value.Primary

var AggregateFunctions = map[string]AggregateFunction{
	"COUNT":  Count,
	"MAX":    Max,
	"MIN":    Min,
	"SUM":    Sum,
	"AVG":    Avg,
	"STDEV":  StdEV,
	"STDEVP": StdEVP,
	"VAR":    Var,
	"VARP":   VarP,
	"MEDIAN": Median,
}

func Count(list []value.Primary, _ *option.Flags) value.Primary {
	var count int64
	for _, v := range list {
		if !value.IsNull(v) {
			count++
		}
	}

	return value.NewInteger(count)
}

func Max(list []value.Primary, flags *option.Flags) value.Primary {
	var result value.Primary
	result = value.NewNull()

	for _, v := range list {
		if value.IsNull(v) {
			continue
		}

		if value.IsNull(result) {
			result = v
			continue
		}

		if value.Greater(v, result, flags.DatetimeFormat, flags.GetTimeLocation()) == ternary.TRUE {
			result = v
		}
	}

	return result
}

func Min(list []value.Primary, flags *option.Flags) value.Primary {
	var result value.Primary
	result = value.NewNull()

	for _, v := range list {
		if value.IsNull(v) {
			continue
		}

		if value.IsNull(result) {
			result = v
			continue
		}

		if value.Less(v, result, flags.DatetimeFormat, flags.GetTimeLocation()) == ternary.TRUE {
			result = v
		}
	}

	return result
}

func Sum(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 1 {
		return value.NewNull()
	}
	return value.NewFloat(sum(values))
}

func Avg(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 1 {
		return value.NewNull()
	}
	return value.NewFloat(average(values))
}

func StdEV(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 2 {
		return value.NewNull()
	}
	return value.NewFloat(standardDeviation(values, false))
}

func StdEVP(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 1 {
		return value.NewNull()
	}
	return value.NewFloat(standardDeviation(values, true))
}

func Var(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 2 {
		return value.NewNull()
	}
	return value.NewFloat(variance(values, false))
}

func VarP(list []value.Primary, _ *option.Flags) value.Primary {
	values := floatList(list)
	if len(values) < 1 {
		return value.NewNull()
	}
	return value.NewFloat(variance(values, true))
}

func floatList(list []value.Primary) []float64 {
	values := make([]float64, 0, len(list))
	for _, v := range list {
		if f := value.ToFloat(v); !value.IsNull(f) {
			values = append(values, f.(*value.Float).Raw())
		}
	}
	return values
}

func sum(list []float64) float64 {
	var sum float64
	for _, v := range list {
		sum += v
	}
	return sum
}

func average(list []float64) float64 {
	denom := float64(len(list))
	sum := sum(list)

	if denom == 0 || sum == 0 {
		return 0
	}

	return sum / denom
}

func variance(list []float64, isP bool) float64 {
	avg := average(list)
	denom := float64(len(list))
	if !isP {
		denom = denom - 1
	}

	var sum float64
	for _, v := range list {
		sum += math.Pow(v-avg, 2)
	}

	if denom == 0 || sum == 0 {
		return 0
	}

	return sum / denom
}

func standardDeviation(list []float64, isP bool) float64 {
	return math.Sqrt(variance(list, isP))
}

func Median(list []value.Primary, flags *option.Flags) value.Primary {
	var values []float64

	for _, v := range list {
		if f := value.ToFloat(v); !value.IsNull(f) {
			values = append(values, f.(*value.Float).Raw())
			continue
		}
		if d := value.ToDatetime(v, flags.DatetimeFormat, flags.GetTimeLocation()); !value.IsNull(d) {
			values = append(values, float64(d.(*value.Datetime).Raw().UnixNano())/1e9)
			continue
		}
	}

	if values == nil || len(values) < 1 {
		return value.NewNull()
	}

	sort.Float64s(values)

	var median float64
	if len(values)%2 == 1 {
		idx := ((len(values) + 1) / 2) - 1
		median = values[idx]
	} else {
		idx := (len(values) / 2) - 1
		median = (values[idx] + values[idx+1]) / float64(2)
	}
	return value.NewFloat(median)
}

func ListAgg(list []value.Primary, separator string) value.Primary {
	strlist := make([]string, 0)
	for _, v := range list {
		s := value.ToString(v)
		if value.IsNull(s) {
			continue
		}
		strlist = append(strlist, s.(*value.String).Raw())
	}

	if len(strlist) < 1 {
		return value.NewNull()
	}

	return value.NewString(strings.Join(strlist, separator))
}

func JsonAgg(list []value.Primary) value.Primary {
	if len(list) < 1 {
		return value.NewNull()
	}

	array := make(txjson.Array, 0, len(list))

	for _, v := range list {
		array = append(array, json.ParseValueToStructure(v))
	}

	return value.NewString(array.Encode())
}
