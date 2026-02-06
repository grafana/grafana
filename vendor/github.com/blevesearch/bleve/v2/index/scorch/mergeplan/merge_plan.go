//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package mergeplan provides a segment merge planning approach that's
// inspired by Lucene's TieredMergePolicy.java and descriptions like
// http://blog.mikemccandless.com/2011/02/visualizing-lucenes-segment-merges.html
package mergeplan

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
)

// A Segment represents the information that the planner needs to
// calculate segment merging.
type Segment interface {
	// Unique id of the segment -- used for sorting.
	Id() uint64

	// Full segment size (the size before any logical deletions).
	FullSize() int64

	// Size of the live data of the segment; i.e., FullSize() minus
	// any logical deletions.
	LiveSize() int64

	HasVector() bool

	// Size of the persisted segment file.
	FileSize() int64
}

// Plan() will functionally compute a merge plan.  A segment will be
// assigned to at most a single MergeTask in the output MergePlan.  A
// segment not assigned to any MergeTask means the segment should
// remain unmerged.
func Plan(segments []Segment, o *MergePlanOptions) (*MergePlan, error) {
	return plan(segments, o)
}

// A MergePlan is the result of the Plan() API.
//
// The planner doesn’t know how or whether these tasks are executed --
// that’s up to a separate merge execution system, which might execute
// these tasks concurrently or not, and which might execute all the
// tasks or not.
type MergePlan struct {
	Tasks []*MergeTask
}

// A MergeTask represents several segments that should be merged
// together into a single segment.
type MergeTask struct {
	Segments []Segment
}

// The MergePlanOptions is designed to be reusable between planning calls.
type MergePlanOptions struct {
	// Max # segments per logarithmic tier, or max width of any
	// logarithmic “step”.  Smaller values mean more merging but fewer
	// segments.  Should be >= SegmentsPerMergeTask, else you'll have
	// too much merging.
	MaxSegmentsPerTier int

	// Max size of any segment produced after merging.  Actual
	// merging, however, may produce segment sizes different than the
	// planner’s predicted sizes.
	MaxSegmentSize int64

	// Max size (in bytes) of the persisted segment file that contains the
	// vectors.  This is used to prevent merging of segments that
	// contain vectors that are too large.
	MaxSegmentFileSize int64

	// The growth factor for each tier in a staircase of idealized
	// segments computed by CalcBudget().
	TierGrowth float64

	// The number of segments in any resulting MergeTask.  e.g.,
	// len(result.Tasks[ * ].Segments) == SegmentsPerMergeTask.
	SegmentsPerMergeTask int

	// Small segments are rounded up to this size, i.e., treated as
	// equal (floor) size for consideration.  This is to prevent lots
	// of tiny segments from resulting in a long tail in the index.
	FloorSegmentSize int64

	// Small segments' file size are rounded up to this size to prevent lot
	// of tiny segments causing a long tail in the index.
	FloorSegmentFileSize int64

	// Controls how aggressively merges that reclaim more deletions
	// are favored.  Higher values will more aggressively target
	// merges that reclaim deletions, but be careful not to go so high
	// that way too much merging takes place; a value of 3.0 is
	// probably nearly too high.  A value of 0.0 means deletions don't
	// impact merge selection.
	ReclaimDeletesWeight float64

	// Optional, defaults to mergeplan.CalcBudget().
	CalcBudget func(totalSize int64, firstTierSize int64,
		o *MergePlanOptions) (budgetNumSegments int)

	// Optional, defaults to mergeplan.ScoreSegments().
	ScoreSegments func(segments []Segment, o *MergePlanOptions) float64

	// Optional.
	Logger func(string)
}

// Returns the higher of the input or FloorSegmentSize.
func (o *MergePlanOptions) RaiseToFloorSegmentSize(s int64) int64 {
	if s > o.FloorSegmentSize {
		return s
	}
	return o.FloorSegmentSize
}

func (o *MergePlanOptions) RaiseToFloorSegmentFileSize(s int64) int64 {
	if s > o.FloorSegmentFileSize {
		return s
	}
	return o.FloorSegmentFileSize
}

// MaxSegmentSizeLimit represents the maximum size of a segment,
// this limit comes with hit-1 optimisation/max encoding limit uint31.
const MaxSegmentSizeLimit = 1<<31 - 1

// ErrMaxSegmentSizeTooLarge is returned when the size of the segment
// exceeds the MaxSegmentSizeLimit
var ErrMaxSegmentSizeTooLarge = errors.New("MaxSegmentSize exceeds the size limit")

// DefaultMergePlanOptions suggests the default options.
var DefaultMergePlanOptions = MergePlanOptions{
	MaxSegmentsPerTier:   10,
	MaxSegmentSize:       5000000,
	MaxSegmentFileSize:   4000000000, // 4GB
	TierGrowth:           10.0,
	SegmentsPerMergeTask: 10,
	FloorSegmentSize:     2000,
	ReclaimDeletesWeight: 2.0,
}

// SingleSegmentMergePlanOptions helps in creating a
// single segment index.
var SingleSegmentMergePlanOptions = MergePlanOptions{
	MaxSegmentsPerTier:   1,
	MaxSegmentSize:       1 << 30,
	MaxSegmentFileSize:   1 << 40,
	TierGrowth:           1.0,
	SegmentsPerMergeTask: 10,
	FloorSegmentSize:     1 << 30,
	ReclaimDeletesWeight: 2.0,
	FloorSegmentFileSize: 1 << 40,
}

// -------------------------------------------

func plan(segmentsIn []Segment, o *MergePlanOptions) (*MergePlan, error) {
	if len(segmentsIn) <= 1 {
		return nil, nil
	}

	if o == nil {
		o = &DefaultMergePlanOptions
	}

	segments := append([]Segment(nil), segmentsIn...) // Copy.

	sort.Sort(byLiveSizeDescending(segments))

	var minLiveSize int64 = math.MaxInt64

	var eligibles []Segment
	var eligiblesLiveSize int64
	var eligiblesFileSize int64
	var minFileSize int64 = math.MaxInt64

	for _, segment := range segments {
		if minLiveSize > segment.LiveSize() {
			minLiveSize = segment.LiveSize()
		}

		if minFileSize > segment.FileSize() {
			minFileSize = segment.FileSize()
		}

		isEligible := segment.LiveSize() < o.MaxSegmentSize/2
		// An eligible segment (based on #documents) may be too large
		// and thus need a stricter check based on the file size.
		// This is particularly important for segments that contain
		// vectors.
		if isEligible && segment.HasVector() && o.MaxSegmentFileSize > 0 {
			isEligible = segment.FileSize() < o.MaxSegmentFileSize/2
		}

		// Only small-enough segments are eligible.
		if isEligible {
			eligibles = append(eligibles, segment)
			eligiblesLiveSize += segment.LiveSize()
			eligiblesFileSize += segment.FileSize()
		}
	}

	calcBudget := o.CalcBudget
	if calcBudget == nil {
		calcBudget = CalcBudget
	}

	var budgetNumSegments int
	if o.FloorSegmentFileSize > 0 {
		minFileSize = o.RaiseToFloorSegmentFileSize(minFileSize)
		budgetNumSegments = calcBudget(eligiblesFileSize, minFileSize, o)

	} else {
		minLiveSize = o.RaiseToFloorSegmentSize(minLiveSize)
		budgetNumSegments = calcBudget(eligiblesLiveSize, minLiveSize, o)
	}

	scoreSegments := o.ScoreSegments
	if scoreSegments == nil {
		scoreSegments = ScoreSegments
	}

	rv := &MergePlan{}

	var empties []Segment
	for _, eligible := range eligibles {
		if eligible.LiveSize() <= 0 {
			empties = append(empties, eligible)
		}
	}
	if len(empties) > 0 {
		rv.Tasks = append(rv.Tasks, &MergeTask{Segments: empties})
		eligibles = removeSegments(eligibles, empties)
	}

	// While we’re over budget, keep looping, which might produce
	// another MergeTask.
	for len(eligibles) > 0 && (len(eligibles)+len(rv.Tasks)) > budgetNumSegments {
		// Track a current best roster as we examine and score
		// potential rosters of merges.
		var bestRoster []Segment
		var bestRosterScore float64 // Lower score is better.

		for startIdx := 0; startIdx < len(eligibles); startIdx++ {
			var roster []Segment
			var rosterLiveSize int64
			var rosterFileSize int64 // useful for segments with vectors

			for idx := startIdx; idx < len(eligibles) && len(roster) < o.SegmentsPerMergeTask; idx++ {
				eligible := eligibles[idx]

				if rosterLiveSize+eligible.LiveSize() >= o.MaxSegmentSize {
					continue
				}

				if eligible.HasVector() {
					efs := eligible.FileSize()
					if rosterFileSize+efs >= o.MaxSegmentFileSize {
						continue
					}
					rosterFileSize += efs
				}

				roster = append(roster, eligible)
				rosterLiveSize += eligible.LiveSize()
			}

			if len(roster) > 0 {
				rosterScore := scoreSegments(roster, o)

				if len(bestRoster) == 0 || rosterScore < bestRosterScore {
					bestRoster = roster
					bestRosterScore = rosterScore
				}
			}
		}

		if len(bestRoster) == 0 {
			return rv, nil
		}
		// create tasks with valid merges - i.e. there should be at least 2 non-empty segments
		if len(bestRoster) > 1 {
			rv.Tasks = append(rv.Tasks, &MergeTask{Segments: bestRoster})
		}

		eligibles = removeSegments(eligibles, bestRoster)
	}

	return rv, nil
}

// Compute the number of segments that would be needed to cover the
// totalSize, by climbing up a logarithmically growing staircase of
// segment tiers.
func CalcBudget(totalSize int64, firstTierSize int64, o *MergePlanOptions) (
	budgetNumSegments int) {
	tierSize := firstTierSize
	if tierSize < 1 {
		tierSize = 1
	}

	maxSegmentsPerTier := o.MaxSegmentsPerTier
	if maxSegmentsPerTier < 1 {
		maxSegmentsPerTier = 1
	}

	tierGrowth := o.TierGrowth
	if tierGrowth < 1.0 {
		tierGrowth = 1.0
	}

	for totalSize > 0 {
		segmentsInTier := float64(totalSize) / float64(tierSize)
		if segmentsInTier < float64(maxSegmentsPerTier) {
			budgetNumSegments += int(math.Ceil(segmentsInTier))
			break
		}

		budgetNumSegments += maxSegmentsPerTier
		totalSize -= int64(maxSegmentsPerTier) * tierSize
		tierSize = int64(float64(tierSize) * tierGrowth)
	}

	return budgetNumSegments
}

// Of note, removeSegments() keeps the ordering of the results stable.
func removeSegments(segments []Segment, toRemove []Segment) []Segment {
	rv := make([]Segment, 0, len(segments)-len(toRemove))
OUTER:
	for _, segment := range segments {
		for _, r := range toRemove {
			if segment == r {
				continue OUTER
			}
		}
		rv = append(rv, segment)
	}
	return rv
}

// Smaller result score is better.
func ScoreSegments(segments []Segment, o *MergePlanOptions) float64 {
	var totBeforeSize int64
	var totAfterSize int64
	var totAfterSizeFloored int64

	for _, segment := range segments {
		totBeforeSize += segment.FullSize()
		totAfterSize += segment.LiveSize()
		totAfterSizeFloored += o.RaiseToFloorSegmentSize(segment.LiveSize())
	}

	if totBeforeSize <= 0 || totAfterSize <= 0 || totAfterSizeFloored <= 0 {
		return 0
	}

	// Roughly guess the "balance" of the segments -- whether the
	// segments are about the same size.
	balance :=
		float64(o.RaiseToFloorSegmentSize(segments[0].LiveSize())) /
			float64(totAfterSizeFloored)

	// Gently favor smaller merges over bigger ones.  We don't want to
	// make the exponent too large else we end up with poor merges of
	// small segments in order to avoid the large merges.
	score := balance * math.Pow(float64(totAfterSize), 0.05)

	// Strongly favor merges that reclaim deletes.
	nonDelRatio := float64(totAfterSize) / float64(totBeforeSize)

	score *= math.Pow(nonDelRatio, o.ReclaimDeletesWeight)

	return score
}

// ------------------------------------------

// ToBarChart returns an ASCII rendering of the segments and the plan.
// The barMax is the max width of the bars in the bar chart.
func ToBarChart(prefix string, barMax int, segments []Segment, plan *MergePlan) string {
	rv := make([]string, 0, len(segments))

	var maxFullSize int64
	for _, segment := range segments {
		if maxFullSize < segment.FullSize() {
			maxFullSize = segment.FullSize()
		}
	}
	if maxFullSize < 0 {
		maxFullSize = 1
	}

	for _, segment := range segments {
		barFull := int(segment.FullSize())
		barLive := int(segment.LiveSize())

		if maxFullSize > int64(barMax) {
			barFull = int(float64(barMax) * float64(barFull) / float64(maxFullSize))
			barLive = int(float64(barMax) * float64(barLive) / float64(maxFullSize))
		}

		barKind := " "
		barChar := "."

		if plan != nil {
		TASK_LOOP:
			for taski, task := range plan.Tasks {
				for _, taskSegment := range task.Segments {
					if taskSegment == segment {
						barKind = "*"
						barChar = fmt.Sprintf("%d", taski)
						break TASK_LOOP
					}
				}
			}
		}

		bar :=
			strings.Repeat(barChar, barLive)[0:barLive] +
				strings.Repeat("x", barFull-barLive)[0:barFull-barLive]

		rv = append(rv, fmt.Sprintf("%s %5d: %5d /%5d - %s %s", prefix,
			segment.Id(),
			segment.LiveSize(),
			segment.FullSize(),
			barKind, bar))
	}

	return strings.Join(rv, "\n")
}

// ValidateMergePlannerOptions validates the merge planner options
func ValidateMergePlannerOptions(options *MergePlanOptions) error {
	if options.MaxSegmentSize > MaxSegmentSizeLimit {
		return ErrMaxSegmentSizeTooLarge
	}
	return nil
}
