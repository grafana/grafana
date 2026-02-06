package ring

import (
	"math/rand"
	"sort"
	"sync"
	"time"
)

type TokenGenerator interface {
	// GenerateTokens generates at most requestedTokensCount unique tokens, none of which clashes with
	// the given allTakenTokens, representing the set of all tokens currently present in the ring.
	// Generated tokens are sorted.
	GenerateTokens(requestedTokensCount int, allTakenTokens []uint32) Tokens

	// CanJoin checks whether the instance owning this TokenGenerator can join the set of the given instances satisfies,
	// and fails if it is not possible.
	CanJoin(instances map[string]InstanceDesc) error

	// CanJoinEnabled returns true if the instance owning this TokenGenerator should perform the CanJoin check before
	// it tries to join the ring.
	CanJoinEnabled() bool
}

type RandomTokenGenerator struct {
	m sync.Mutex
	r *rand.Rand
}

func NewRandomTokenGenerator() *RandomTokenGenerator {
	return &RandomTokenGenerator{r: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

func NewRandomTokenGeneratorWithSeed(seed int64) *RandomTokenGenerator {
	return &RandomTokenGenerator{r: rand.New(rand.NewSource(seed))}
}

// GenerateTokens generates at most requestedTokensCount unique random tokens, none of which clashes with
// the given allTakenTokens, representing the set of all tokens currently present in the ring.
// Generated tokens are sorted.
func (t *RandomTokenGenerator) GenerateTokens(requestedTokensCount int, allTakenTokens []uint32) Tokens {
	if requestedTokensCount <= 0 {
		return []uint32{}
	}

	used := make(map[uint32]bool, len(allTakenTokens))
	for _, v := range allTakenTokens {
		used[v] = true
	}

	tokens := make([]uint32, 0, requestedTokensCount)
	for i := 0; i < requestedTokensCount; {
		t.m.Lock()
		candidate := t.r.Uint32()
		t.m.Unlock()

		if used[candidate] {
			continue
		}
		used[candidate] = true
		tokens = append(tokens, candidate)
		i++
	}

	// Ensure returned tokens are sorted.
	sort.Slice(tokens, func(i, j int) bool {
		return tokens[i] < tokens[j]
	})

	return tokens
}

func (t *RandomTokenGenerator) CanJoin(_ map[string]InstanceDesc) error {
	return nil
}

func (t *RandomTokenGenerator) CanJoinEnabled() bool {
	return false
}
