// +build js

package math

import (
	"github.com/gopherjs/gopherjs/js"
)

var math = js.Global.Get("Math")
var zero float64 = 0
var posInf = 1 / zero
var negInf = -1 / zero
var nan = 0 / zero

func Acos(x float64) float64 {
	return math.Call("acos", x).Float()
}

func Acosh(x float64) float64 {
	return math.Call("acosh", x).Float()
}

func Asin(x float64) float64 {
	return math.Call("asin", x).Float()
}

func Asinh(x float64) float64 {
	return math.Call("asinh", x).Float()
}

func Atan(x float64) float64 {
	return math.Call("atan", x).Float()
}

func Atanh(x float64) float64 {
	return math.Call("atanh", x).Float()
}

func Atan2(y, x float64) float64 {
	return math.Call("atan2", y, x).Float()
}

func Cbrt(x float64) float64 {
	return math.Call("cbrt", x).Float()
}

func Ceil(x float64) float64 {
	return math.Call("ceil", x).Float()
}

func Copysign(x, y float64) float64 {
	if (x < 0 || 1/x == negInf) != (y < 0 || 1/y == negInf) {
		return -x
	}
	return x
}

func Cos(x float64) float64 {
	return math.Call("cos", x).Float()
}

func Cosh(x float64) float64 {
	return math.Call("cosh", x).Float()
}

func Dim(x, y float64) float64 {
	return dim(x, y)
}

func Erf(x float64) float64 {
	return erf(x)
}

func Erfc(x float64) float64 {
	return erfc(x)
}

func Exp(x float64) float64 {
	return math.Call("exp", x).Float()
}

func Exp2(x float64) float64 {
	return math.Call("pow", 2, x).Float()
}

func Expm1(x float64) float64 {
	return expm1(x)
}

func Floor(x float64) float64 {
	return math.Call("floor", x).Float()
}

func Frexp(f float64) (frac float64, exp int) {
	return frexp(f)
}

func Hypot(p, q float64) float64 {
	return hypot(p, q)
}

func Inf(sign int) float64 {
	switch {
	case sign >= 0:
		return posInf
	default:
		return negInf
	}
}

func IsInf(f float64, sign int) bool {
	if f == posInf {
		return sign >= 0
	}
	if f == negInf {
		return sign <= 0
	}
	return false
}

func IsNaN(f float64) (is bool) {
	return f != f
}

func Ldexp(frac float64, exp int) float64 {
	if frac == 0 {
		return frac
	}
	if exp >= 1024 {
		return frac * math.Call("pow", 2, 1023).Float() * math.Call("pow", 2, exp-1023).Float()
	}
	if exp <= -1024 {
		return frac * math.Call("pow", 2, -1023).Float() * math.Call("pow", 2, exp+1023).Float()
	}
	return frac * math.Call("pow", 2, exp).Float()
}

func Log(x float64) float64 {
	if x != x { // workaround for optimizer bug in V8, remove at some point
		return nan
	}
	return math.Call("log", x).Float()
}

func Log10(x float64) float64 {
	return log10(x)
}

func Log1p(x float64) float64 {
	return log1p(x)
}

func Log2(x float64) float64 {
	return log2(x)
}

func Max(x, y float64) float64 {
	return max(x, y)
}

func Min(x, y float64) float64 {
	return min(x, y)
}

func Mod(x, y float64) float64 {
	return js.Global.Call("$mod", x, y).Float()
}

func Modf(f float64) (float64, float64) {
	if f == posInf || f == negInf {
		return f, nan
	}
	if 1/f == negInf {
		return f, f
	}
	frac := Mod(f, 1)
	return f - frac, frac
}

func NaN() float64 {
	return nan
}

func Pow(x, y float64) float64 {
	if x == 1 || (x == -1 && (y == posInf || y == negInf)) {
		return 1
	}
	return math.Call("pow", x, y).Float()
}

func Remainder(x, y float64) float64 {
	return remainder(x, y)
}

func Signbit(x float64) bool {
	return x < 0 || 1/x == negInf
}

func Sin(x float64) float64 {
	return math.Call("sin", x).Float()
}

func Sinh(x float64) float64 {
	return math.Call("sinh", x).Float()
}

func Sincos(x float64) (sin, cos float64) {
	return Sin(x), Cos(x)
}

func Sqrt(x float64) float64 {
	return math.Call("sqrt", x).Float()
}

func Tan(x float64) float64 {
	return math.Call("tan", x).Float()
}

func Tanh(x float64) float64 {
	return math.Call("tanh", x).Float()
}

func Trunc(x float64) float64 {
	if x == posInf || x == negInf || x != x || 1/x == negInf {
		return x
	}
	return float64(int(x))
}

var buf struct {
	uint32array  [2]uint32
	float32array [2]float32
	float64array [1]float64
}

func init() {
	ab := js.Global.Get("ArrayBuffer").New(8)
	js.InternalObject(buf).Set("uint32array", js.Global.Get("Uint32Array").New(ab))
	js.InternalObject(buf).Set("float32array", js.Global.Get("Float32Array").New(ab))
	js.InternalObject(buf).Set("float64array", js.Global.Get("Float64Array").New(ab))
}

func Float32bits(f float32) uint32 {
	buf.float32array[0] = f
	return buf.uint32array[0]
}

func Float32frombits(b uint32) float32 {
	buf.uint32array[0] = b
	return buf.float32array[0]
}

func Float64bits(f float64) uint64 {
	buf.float64array[0] = f
	return uint64(buf.uint32array[1])<<32 + uint64(buf.uint32array[0])
}

func Float64frombits(b uint64) float64 {
	buf.uint32array[0] = uint32(b)
	buf.uint32array[1] = uint32(b >> 32)
	return buf.float64array[0]
}
