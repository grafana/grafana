package retry

import (
	"math"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/internal/sdk"
)

type adaptiveRateLimit struct {
	tokenBucketEnabled bool

	smooth        float64
	beta          float64
	scaleConstant float64
	minFillRate   float64

	fillRate         float64
	calculatedRate   float64
	lastRefilled     time.Time
	measuredTxRate   float64
	lastTxRateBucket float64
	requestCount     int64
	lastMaxRate      float64
	lastThrottleTime time.Time
	timeWindow       float64

	tokenBucket *adaptiveTokenBucket

	mu sync.Mutex
}

func newAdaptiveRateLimit() *adaptiveRateLimit {
	now := sdk.NowTime()
	return &adaptiveRateLimit{
		smooth:        0.8,
		beta:          0.7,
		scaleConstant: 0.4,

		minFillRate: 0.5,

		lastTxRateBucket: math.Floor(timeFloat64Seconds(now)),
		lastThrottleTime: now,

		tokenBucket: newAdaptiveTokenBucket(0),
	}
}

func (a *adaptiveRateLimit) Enable(v bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.tokenBucketEnabled = v
}

func (a *adaptiveRateLimit) AcquireToken(amount uint) (
	tokenAcquired bool, waitTryAgain time.Duration,
) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.tokenBucketEnabled {
		return true, 0
	}

	a.tokenBucketRefill()

	available, ok := a.tokenBucket.Retrieve(float64(amount))
	if !ok {
		waitDur := float64Seconds((float64(amount) - available) / a.fillRate)
		return false, waitDur
	}

	return true, 0
}

func (a *adaptiveRateLimit) Update(throttled bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.updateMeasuredRate()

	if throttled {
		rateToUse := a.measuredTxRate
		if a.tokenBucketEnabled {
			rateToUse = math.Min(a.measuredTxRate, a.fillRate)
		}

		a.lastMaxRate = rateToUse
		a.calculateTimeWindow()
		a.lastThrottleTime = sdk.NowTime()
		a.calculatedRate = a.cubicThrottle(rateToUse)
		a.tokenBucketEnabled = true
	} else {
		a.calculateTimeWindow()
		a.calculatedRate = a.cubicSuccess(sdk.NowTime())
	}

	newRate := math.Min(a.calculatedRate, 2*a.measuredTxRate)
	a.tokenBucketUpdateRate(newRate)
}

func (a *adaptiveRateLimit) cubicSuccess(t time.Time) float64 {
	dt := secondsFloat64(t.Sub(a.lastThrottleTime))
	return (a.scaleConstant * math.Pow(dt-a.timeWindow, 3)) + a.lastMaxRate
}

func (a *adaptiveRateLimit) cubicThrottle(rateToUse float64) float64 {
	return rateToUse * a.beta
}

func (a *adaptiveRateLimit) calculateTimeWindow() {
	a.timeWindow = math.Pow((a.lastMaxRate*(1.-a.beta))/a.scaleConstant, 1./3.)
}

func (a *adaptiveRateLimit) tokenBucketUpdateRate(newRPS float64) {
	a.tokenBucketRefill()
	a.fillRate = math.Max(newRPS, a.minFillRate)
	a.tokenBucket.Resize(newRPS)
}

func (a *adaptiveRateLimit) updateMeasuredRate() {
	now := sdk.NowTime()
	timeBucket := math.Floor(timeFloat64Seconds(now)*2.) / 2.
	a.requestCount++

	if timeBucket > a.lastTxRateBucket {
		currentRate := float64(a.requestCount) / (timeBucket - a.lastTxRateBucket)
		a.measuredTxRate = (currentRate * a.smooth) + (a.measuredTxRate * (1. - a.smooth))
		a.requestCount = 0
		a.lastTxRateBucket = timeBucket
	}
}

func (a *adaptiveRateLimit) tokenBucketRefill() {
	now := sdk.NowTime()
	if a.lastRefilled.IsZero() {
		a.lastRefilled = now
		return
	}

	fillAmount := secondsFloat64(now.Sub(a.lastRefilled)) * a.fillRate
	a.tokenBucket.Refund(fillAmount)
	a.lastRefilled = now
}

func float64Seconds(v float64) time.Duration {
	return time.Duration(v * float64(time.Second))
}

func secondsFloat64(v time.Duration) float64 {
	return float64(v) / float64(time.Second)
}

func timeFloat64Seconds(v time.Time) float64 {
	return float64(v.UnixNano()) / float64(time.Second)
}
