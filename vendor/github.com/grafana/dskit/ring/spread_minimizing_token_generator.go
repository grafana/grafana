package ring

import (
	"container/heap"
	"fmt"
	"math"
	"regexp"
	"slices"
	"sort"
	"strconv"
)

const (
	totalTokensCount         = math.MaxUint32 + 1
	optimalTokensPerInstance = 512
	maxZonesCount            = 8
)

var (
	instanceIDRegex          = regexp.MustCompile(`^(.*-)(\d+)$`)
	errorBadInstanceIDFormat = func(instanceID string) error {
		return fmt.Errorf("unable to extract instance id from %q", instanceID)
	}

	errorMissingPreviousInstance = func(requiredInstanceID string) error {
		return fmt.Errorf("the instance %q has not been registered to the ring or has no tokens yet", requiredInstanceID)
	}
	errorZoneCountOutOfBound = func(zonesCount int) error {
		return fmt.Errorf("number of zones %d is not correct: it must be greater than 0 and less or equal than %d", zonesCount, maxZonesCount)
	}
	errorZoneNotValid = func(zone string) error {
		return fmt.Errorf("zone %s is not valid", zone)
	}
	errorMultipleOfZonesCount = func(optimalTokenOwnership uint32, token ringToken) error {
		return fmt.Errorf("calculation of a new token between %d and %d with optimal token ownership %d was impossible: optimal token ownership must be a positive multiple of maximal allowed number of zones %d", token.prevToken, token.token, optimalTokenOwnership, maxZonesCount)
	}
	errorLowerAndUpperBoundModulo = func(optimalTokenOwnership uint32, token ringToken) error {
		return fmt.Errorf("calculation of a new token between %d and %d with optimal token ownership %d was impossible: lower and upper bounds must be congruent modulo maximal allowed number of zones %d", token.prevToken, token.token, optimalTokenOwnership, maxZonesCount)
	}
	errorDistanceBetweenTokensNotBigEnough = func(optimalTokenOwnership int, ownership int64, token ringToken) error {
		return fmt.Errorf("calculation of a new token between %d and %d with optimal token ownership %d was impossible: distance between lower and upper bound %d is not big enough", token.prevToken, token.token, optimalTokenOwnership, ownership)
	}
)

type SpreadMinimizingTokenGenerator struct {
	instanceID     int
	instancePrefix string
	zoneID         int
	canJoinEnabled bool
}

func NewSpreadMinimizingTokenGenerator(instance, zone string, spreadMinimizingZones []string, canJoinEnabled bool) (*SpreadMinimizingTokenGenerator, error) {
	if len(spreadMinimizingZones) <= 0 || len(spreadMinimizingZones) > maxZonesCount {
		return nil, errorZoneCountOutOfBound(len(spreadMinimizingZones))
	}
	sortedZones := make([]string, len(spreadMinimizingZones))
	copy(sortedZones, spreadMinimizingZones)
	if !slices.IsSorted(sortedZones) {
		sort.Strings(sortedZones)
	}
	zoneID, err := findZoneID(zone, sortedZones)
	if err != nil {
		return nil, err
	}

	prefix, instanceID, err := parseInstanceID(instance)
	if err != nil {
		return nil, err
	}

	return NewSpreadMinimizingTokenGeneratorForInstanceAndZoneID(prefix, instanceID, zoneID, canJoinEnabled), nil
}

func NewSpreadMinimizingTokenGeneratorForInstanceAndZoneID(instancePrefix string, instanceID, zoneID int, canJoinEnabled bool) *SpreadMinimizingTokenGenerator {
	return &SpreadMinimizingTokenGenerator{
		instanceID:     instanceID,
		instancePrefix: instancePrefix,
		zoneID:         zoneID,
		canJoinEnabled: canJoinEnabled,
	}
}

func parseInstanceID(instanceID string) (string, int, error) {
	parts := instanceIDRegex.FindStringSubmatch(instanceID)
	if len(parts) != 3 {
		return "", 0, errorBadInstanceIDFormat(instanceID)
	}
	val, err := strconv.Atoi(parts[2])
	return parts[1], val, err
}

// findZoneID gets a zone name and a slice of sorted zones,
// and return the index of the zone in the slice.
func findZoneID(zone string, sortedZones []string) (int, error) {
	index := slices.Index(sortedZones, zone)
	if index < 0 {
		return 0, errorZoneNotValid(zone)
	}
	return index, nil
}

// generateFirstInstanceTokens calculates a set of tokens that should be assigned to the first instance (with id 0)
// of the zone of the underlying instance.
func (t *SpreadMinimizingTokenGenerator) generateFirstInstanceTokens() Tokens {
	// In this approach all the tokens from the same zone are equal to each other modulo maxZonesCount.
	// Therefore, tokenDistance is calculated as a multiple of maxZonesCount, so that we ensure that
	// the following for loop calculates the actual tokens following the approach's requirement.
	tokenDistance := (totalTokensCount / optimalTokensPerInstance / maxZonesCount) * maxZonesCount
	tokens := make(Tokens, 0, optimalTokensPerInstance)
	for i := 0; i < optimalTokensPerInstance; i++ {
		token := uint32(i*tokenDistance) + uint32(t.zoneID)
		tokens = append(tokens, token)
	}
	return tokens
}

// calculateNewToken determines where in the range represented by the given ringToken should a new token be placed
// in order to satisfy the constraint represented by the optimalTokenOwnership. This method assumes that:
// - ringToken.token % maxZonesCount == ringToken.prevToken % zonesCount
// - optimalTokenOwnership % maxZonesCount == 0,
// where zonesCount is the number of zones in the ring. The caller of this function must ensure that these assumptions hold.
func (t *SpreadMinimizingTokenGenerator) calculateNewToken(token ringToken, optimalTokenOwnership uint32) (uint32, error) {
	if optimalTokenOwnership < maxZonesCount || optimalTokenOwnership%maxZonesCount != 0 {
		return 0, errorMultipleOfZonesCount(optimalTokenOwnership, token)
	}
	if token.prevToken%maxZonesCount != token.token%maxZonesCount {
		return 0, errorLowerAndUpperBoundModulo(optimalTokenOwnership, token)
	}
	ownership := tokenDistance(token.prevToken, token.token)
	if ownership <= int64(optimalTokenOwnership) {
		return 0, errorDistanceBetweenTokensNotBigEnough(int(optimalTokenOwnership), ownership, token)
	}
	// In the present approach tokens of successive zones are immediate successors of the tokens in
	// the previous zone. This means that once a token of the "leading" zone, i.e., the zone with
	// id 0 is determined, we must have enough space to accommodate the corresponding tokens in the
	// remaining (maxZonesCount-1) zones. Hence, the highest token of the leading zone must be a
	// multiple of maxZonesCount, that guarantees that there are remaining (maxZonesCount-1) available
	// tokens in the token space.
	maxTokenValue := uint32(((totalTokensCount / maxZonesCount) - 1) * maxZonesCount)
	offset := maxTokenValue - token.prevToken
	if offset < optimalTokenOwnership {
		newToken := optimalTokenOwnership - offset
		return newToken, nil
	}
	return token.prevToken + optimalTokenOwnership, nil
}

// optimalTokenOwnership calculates the optimal ownership of the remaining currTokensCount tokens of an instance
// having the given current instances ownership currInstanceOwnership and the given optimal instance ownership
// optimalInstanceOwnership. The resulting token ownership must be a multiple of the number of zones.
func (t *SpreadMinimizingTokenGenerator) optimalTokenOwnership(optimalInstanceOwnership, currInstanceOwnership float64, remainingTokensCount uint32) uint32 {
	optimalTokenOwnership := uint32(optimalInstanceOwnership-currInstanceOwnership) / remainingTokensCount
	return (optimalTokenOwnership / maxZonesCount) * maxZonesCount
}

// GenerateTokens returns at most requestedTokensCount unique tokens, none of which clashes with the given
// allTakenTokens, representing the set of all tokens currently present in the ring. Returned tokens are sorted.
// The optimal number of tokens (optimalTokenPerInstance), i.e., 512, reserved for the underlying instance are
// generated by generateAllTokens. GenerateTokens selects the first requestedTokensCount tokens from the reserved
// tokens set, that are not already present in the takenTokens.
// The number of returned tokens might be lower than the requested number of tokens in the following cases:
//   - if tokensCount is higher than 512 (optimalTokensPerInstance), or
//   - if among the 512 (optimalTokenPerInstance) reserved tokens there is less than tokenCount
//     tokens not already present in takenTokens.
func (t *SpreadMinimizingTokenGenerator) GenerateTokens(requestedTokensCount int, allTakenTokens []uint32) Tokens {
	used := make(map[uint32]bool, len(allTakenTokens))
	for _, v := range allTakenTokens {
		used[v] = true
	}

	allTokens, err := t.generateAllTokens()
	if err != nil {
		// we were unable to generate required tokens, so we panic.
		panic(err)
	}
	uniqueTokens := make(Tokens, 0, requestedTokensCount)

	// allTokens is a sorted slice of tokens for instance t.cfg.InstanceID in zone t.cfg.zone
	// We filter out tokens from allTakenTokens, if any, and return at most requestedTokensCount tokens.
	for i := 0; i < len(allTokens) && len(uniqueTokens) < requestedTokensCount; i++ {
		token := allTokens[i]
		if used[token] {
			continue
		}
		uniqueTokens = append(uniqueTokens, token)
	}
	return uniqueTokens
}

// generateAllTokens generates the optimal number of tokens (optimalTokenPerInstance), i.e., 512,
// for the underlying instance (with id t.instanceID). Generated tokens are sorted, and they are
// distributed in such a way that registered ownership of the instance t.instanceID, when it is
// placed in the ring that already contains instances with all the ids lower that t.instanceID
// is optimal.
// Calls to this method will always return the same set of tokens.
func (t *SpreadMinimizingTokenGenerator) generateAllTokens() (Tokens, error) {
	tokensByInstanceID, err := t.generateTokensByInstanceID()
	if err != nil {
		return nil, err
	}
	allTokens := tokensByInstanceID[t.instanceID]
	slices.Sort(allTokens)
	return allTokens, nil
}

// generateTokensByInstanceID generates the optimal number of tokens (optimalTokenPerInstance),
// i.e., 512, for all instances whose id is less or equal to the id of the underlying instance
// (with id t.instanceID). Generated tokens are not sorted, but they are distributed in such a
// way that registered ownership of all the instances is optimal.
// Calls to this method will always return the same set of tokens.
func (t *SpreadMinimizingTokenGenerator) generateTokensByInstanceID() (map[int]Tokens, error) {
	firstInstanceTokens := t.generateFirstInstanceTokens()
	tokensByInstanceID := make(map[int]Tokens, t.instanceID+1)
	tokensByInstanceID[0] = firstInstanceTokens

	if t.instanceID == 0 {
		return tokensByInstanceID, nil
	}

	// tokensQueues is a slice of priority queues. Slice indexes correspond
	// to the ids of instances, while priority queues represent the tokens
	// of the corresponding instance, ordered from highest to lowest ownership.
	tokensQueues := make([]ownershipPriorityQueue[ringToken], t.instanceID)

	// Create and initialize priority queue of tokens for the first instance
	tokensQueue := newPriorityQueue[ringToken](optimalTokensPerInstance)
	prev := len(firstInstanceTokens) - 1
	firstInstanceOwnership := 0.0
	for tk, token := range firstInstanceTokens {
		tokenOwnership := float64(tokenDistance(firstInstanceTokens[prev], token))
		firstInstanceOwnership += tokenOwnership
		heap.Push(&tokensQueue, newRingTokenOwnershipInfo(token, firstInstanceTokens[prev]))
		prev = tk
	}
	tokensQueues[0] = tokensQueue

	// instanceQueue is a priority queue of instances such that instances with higher ownership have a higher priority
	instanceQueue := newPriorityQueue[ringInstance](t.instanceID)
	heap.Push(&instanceQueue, newRingInstanceOwnershipInfo(0, firstInstanceOwnership))

	// ignoredInstances is a slice of the current instances whose tokens
	// don't have enough space to accommodate new tokens.
	ignoredInstances := make([]ownershipInfo[ringInstance], 0, t.instanceID)

	for i := 1; i <= t.instanceID; i++ {
		optimalInstanceOwnership := float64(totalTokensCount) / float64(i+1)
		currInstanceOwnership := 0.0
		addedTokens := 0
		ignoredInstances = ignoredInstances[:0]
		tokens := make(Tokens, 0, optimalTokensPerInstance)
		// currInstanceTokenQueue is the priority queue of tokens of newInstance
		currInstanceTokenQueue := newPriorityQueue[ringToken](optimalTokensPerInstance)
		for addedTokens < optimalTokensPerInstance {
			optimalTokenOwnership := t.optimalTokenOwnership(optimalInstanceOwnership, currInstanceOwnership, uint32(optimalTokensPerInstance-addedTokens))
			highestOwnershipInstance := instanceQueue.Peek()
			if highestOwnershipInstance == nil || highestOwnershipInstance.ownership <= float64(optimalTokenOwnership) {
				// if this happens, it means that we cannot accommodate other tokens
				return nil, fmt.Errorf("it was impossible to add %dth token for instance with id %d in zone id %d because the instance with the highest ownership cannot satisfy the requested ownership %d", addedTokens+1, i, t.zoneID, optimalTokenOwnership)
			}
			tokensQueue := tokensQueues[highestOwnershipInstance.item.instanceID]
			highestOwnershipToken := tokensQueue.Peek()
			if highestOwnershipToken.ownership <= float64(optimalTokenOwnership) {
				// The token with the highest ownership of the instance with the highest ownership could not
				// accommodate a new token, hence we ignore this instance and pass to the next instance.
				ignoredInstances = append(ignoredInstances, heap.Pop(&instanceQueue).(ownershipInfo[ringInstance]))
				continue
			}
			token := highestOwnershipToken.item
			newToken, err := t.calculateNewToken(token, optimalTokenOwnership)
			if err != nil {
				// if this happens, it means that we cannot accommodate additional tokens
				return nil, fmt.Errorf("it was impossible to calculate the %dth token for instance with id %d in zone id %d", addedTokens+1, i, t.zoneID)
			}
			tokens = append(tokens, newToken)
			// add the new token to currInstanceTokenQueue
			heap.Push(&currInstanceTokenQueue, newRingTokenOwnershipInfo(newToken, token.prevToken))

			oldTokenOwnership := highestOwnershipToken.ownership
			newTokenOwnership := float64(tokenDistance(newToken, token.token))
			currInstanceOwnership += oldTokenOwnership - newTokenOwnership

			// The token with the highest ownership of the instance with the highest ownership has changed,
			// so we propagate these changes in the corresponding tokens queue.
			highestOwnershipToken.item.prevToken = newToken
			highestOwnershipToken.ownership = newTokenOwnership
			heap.Fix(&tokensQueue, 0)

			// The ownership of the instance with the highest ownership has changed,
			// so we propagate these changes in the instances queue.
			highestOwnershipInstance.ownership = highestOwnershipInstance.ownership - oldTokenOwnership + newTokenOwnership
			heap.Fix(&instanceQueue, 0)

			addedTokens++
		}
		tokensByInstanceID[i] = tokens
		// if this is the last iteration we return, so we avoid to call additional heap.Pushs
		if i == t.instanceID {
			return tokensByInstanceID, nil
		}

		// If there were some ignored instances, we put them back on the queue.
		for _, ignoredInstance := range ignoredInstances {
			heap.Push(&instanceQueue, ignoredInstance)
		}

		tokensQueues[i] = currInstanceTokenQueue

		// add the current instance with the calculated ownership currInstanceOwnership to instanceQueue
		heap.Push(&instanceQueue, newRingInstanceOwnershipInfo(i, currInstanceOwnership))
	}

	return tokensByInstanceID, nil
}

func (t *SpreadMinimizingTokenGenerator) CanJoin(instances map[string]InstanceDesc) error {
	if !t.canJoinEnabled {
		return nil
	}

	if t.instanceID == 0 {
		return nil
	}
	prevInstance := fmt.Sprintf("%s%d", t.instancePrefix, t.instanceID-1)
	instanceDesc, ok := instances[prevInstance]
	if ok && len(instanceDesc.Tokens) != 0 {
		return nil
	}
	return errorMissingPreviousInstance(prevInstance)
}

func (t *SpreadMinimizingTokenGenerator) CanJoinEnabled() bool {
	return t.canJoinEnabled
}
