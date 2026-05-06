// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package coordinate

import (
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/hashicorp/go-metrics/compat"
)

// Client manages the estimated network coordinate for a given node, and adjusts
// it as the node observes round trip times and estimated coordinates from other
// nodes. The core algorithm is based on Vivaldi, see the documentation for Config
// for more details.
type Client struct {
	// coord is the current estimate of the client's network coordinate.
	coord *Coordinate

	// origin is a coordinate sitting at the origin.
	origin *Coordinate

	// config contains the tuning parameters that govern the performance of
	// the algorithm.
	config *Config

	// adjustmentIndex is the current index into the adjustmentSamples slice.
	adjustmentIndex uint

	// adjustment is used to store samples for the adjustment calculation.
	adjustmentSamples []float64

	// latencyFilterSamples is used to store the last several RTT samples,
	// keyed by node name. We will use the config's LatencyFilterSamples
	// value to determine how many samples we keep, per node.
	latencyFilterSamples map[string][]float64

	// stats is used to record events that occur when updating coordinates.
	stats ClientStats

	// mutex enables safe concurrent access to the client.
	mutex sync.RWMutex
}

// ClientStats is used to record events that occur when updating coordinates.
type ClientStats struct {
	// Resets is incremented any time we reset our local coordinate because
	// our calculations have resulted in an invalid state.
	Resets int
}

// NewClient creates a new Client and verifies the configuration is valid.
func NewClient(config *Config) (*Client, error) {
	if !(config.Dimensionality > 0) {
		return nil, fmt.Errorf("dimensionality must be >0")
	}

	return &Client{
		coord:                NewCoordinate(config),
		origin:               NewCoordinate(config),
		config:               config,
		adjustmentIndex:      0,
		adjustmentSamples:    make([]float64, config.AdjustmentWindowSize),
		latencyFilterSamples: make(map[string][]float64),
	}, nil
}

// GetCoordinate returns a copy of the coordinate for this client.
func (c *Client) GetCoordinate() *Coordinate {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.coord.Clone()
}

// SetCoordinate forces the client's coordinate to a known state.
func (c *Client) SetCoordinate(coord *Coordinate) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if err := c.checkCoordinate(coord); err != nil {
		return err
	}

	c.coord = coord.Clone()
	return nil
}

// ForgetNode removes any client state for the given node.
func (c *Client) ForgetNode(node string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	delete(c.latencyFilterSamples, node)
}

// Stats returns a copy of stats for the client.
func (c *Client) Stats() ClientStats {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	return c.stats
}

// checkCoordinate returns an error if the coordinate isn't compatible with
// this client, or if the coordinate itself isn't valid. This assumes the mutex
// has been locked already.
func (c *Client) checkCoordinate(coord *Coordinate) error {
	if !c.coord.IsCompatibleWith(coord) {
		return fmt.Errorf("dimensions aren't compatible")
	}

	if !coord.IsValid() {
		return fmt.Errorf("coordinate is invalid")
	}

	return nil
}

// latencyFilter applies a simple moving median filter with a new sample for
// a node. This assumes that the mutex has been locked already.
func (c *Client) latencyFilter(node string, rttSeconds float64) float64 {
	samples, ok := c.latencyFilterSamples[node]
	if !ok {
		samples = make([]float64, 0, c.config.LatencyFilterSize)
	}

	// Add the new sample and trim the list, if needed.
	samples = append(samples, rttSeconds)
	if len(samples) > int(c.config.LatencyFilterSize) {
		samples = samples[1:]
	}
	c.latencyFilterSamples[node] = samples

	// Sort a copy of the samples and return the median.
	sorted := make([]float64, len(samples))
	copy(sorted, samples)
	sort.Float64s(sorted)
	return sorted[len(sorted)/2]
}

// updateVivialdi updates the Vivaldi portion of the client's coordinate. This
// assumes that the mutex has been locked already.
func (c *Client) updateVivaldi(other *Coordinate, rttSeconds float64) {
	const zeroThreshold = 1.0e-6

	dist := c.coord.DistanceTo(other).Seconds()
	if rttSeconds < zeroThreshold {
		rttSeconds = zeroThreshold
	}
	wrongness := math.Abs(dist-rttSeconds) / rttSeconds

	totalError := c.coord.Error + other.Error
	if totalError < zeroThreshold {
		totalError = zeroThreshold
	}
	weight := c.coord.Error / totalError

	c.coord.Error = c.config.VivaldiCE*weight*wrongness + c.coord.Error*(1.0-c.config.VivaldiCE*weight)
	if c.coord.Error > c.config.VivaldiErrorMax {
		c.coord.Error = c.config.VivaldiErrorMax
	}

	delta := c.config.VivaldiCC * weight
	force := delta * (rttSeconds - dist)
	c.coord = c.coord.ApplyForce(c.config, force, other)
}

// updateAdjustment updates the adjustment portion of the client's coordinate, if
// the feature is enabled. This assumes that the mutex has been locked already.
func (c *Client) updateAdjustment(other *Coordinate, rttSeconds float64) {
	if c.config.AdjustmentWindowSize == 0 {
		return
	}

	// Note that the existing adjustment factors don't figure in to this
	// calculation so we use the raw distance here.
	dist := c.coord.rawDistanceTo(other)
	c.adjustmentSamples[c.adjustmentIndex] = rttSeconds - dist
	c.adjustmentIndex = (c.adjustmentIndex + 1) % c.config.AdjustmentWindowSize

	sum := 0.0
	for _, sample := range c.adjustmentSamples {
		sum += sample
	}
	c.coord.Adjustment = sum / (2.0 * float64(c.config.AdjustmentWindowSize))
}

// updateGravity applies a small amount of gravity to pull coordinates towards
// the center of the coordinate system to combat drift. This assumes that the
// mutex is locked already.
func (c *Client) updateGravity() {
	dist := c.origin.DistanceTo(c.coord).Seconds()
	force := -1.0 * math.Pow(dist/c.config.GravityRho, 2.0)
	c.coord = c.coord.ApplyForce(c.config, force, c.origin)
}

// Update takes other, a coordinate for another node, and rtt, a round trip
// time observation for a ping to that node, and updates the estimated position of
// the client's coordinate. Returns the updated coordinate.
func (c *Client) Update(node string, other *Coordinate, rtt time.Duration) (*Coordinate, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if err := c.checkCoordinate(other); err != nil {
		return nil, err
	}

	// The code down below can handle zero RTTs, which we have seen in
	// https://github.com/hashicorp/consul/issues/3789, presumably in
	// environments with coarse-grained monotonic clocks (we are still
	// trying to pin this down). In any event, this is ok from a code PoV
	// so we don't need to alert operators with spammy messages. We did
	// add a counter so this is still observable, though.
	const maxRTT = 10 * time.Second
	if rtt < 0 || rtt > maxRTT {
		return nil, fmt.Errorf("round trip time not in valid range, duration %v is not a positive value less than %v ", rtt, maxRTT)
	}
	if rtt == 0 {
		metrics.IncrCounterWithLabels([]string{"serf", "coordinate", "zero-rtt"}, 1, c.config.MetricLabels)
	}

	rttSeconds := c.latencyFilter(node, rtt.Seconds())
	c.updateVivaldi(other, rttSeconds)
	c.updateAdjustment(other, rttSeconds)
	c.updateGravity()
	if !c.coord.IsValid() {
		c.stats.Resets++
		c.coord = NewCoordinate(c.config)
	}

	return c.coord.Clone(), nil
}

// DistanceTo returns the estimated RTT from the client's coordinate to other, the
// coordinate for another node.
func (c *Client) DistanceTo(other *Coordinate) time.Duration {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.coord.DistanceTo(other)
}
