# TODO

## Generators

- times, durations, locations
- complex numbers
- big numbers
- ip addresses & masks
- subset-of-slice
- runes with rune/range blacklist
- recursive (base + extend)

## Shrinking

- make it OK to pivot to a different error when shrinking
  - right now, we require for traceback to remain the same to continue shrinking, which is probably limiting
- floats: maybe shrink towards lower *biased* exponent?
- just like we have lower+delete pass to deal with situations like generation/sampling, we need to have a pass for choice
  - idea: lower (the "choice" block) + fill some region with random data
  - to try to reproduce with a simpler choice
  - this should work both OneOf and floats (where exponent is kind of a OneOf key)
  - questions:
    - how to deal with misalignment?
    - how to determine the group to randomize?
      - e.g. right now for floats it is not an explicit group but rather a bunch of nearby blocks
- use fewer bits for genFloat01 to make shrinking a bit faster
- shrink duplicates together
  - generalize to arbitrary "offsets" for pairs
- better caching
  - detect when we are generating already generated values and abort early
- not all value groups are standalone!
  - standalone might be too coarse, maybe should be replaced with a bunch of other traits
- we are doing too much prop evaluations
- partial sort does not swap e.g. int and int32
- when shrinking, if we try to lower the wanted bits of some uint64, we have a high chance to draw very low value
  - because high bits will be masked out
  - this can prevent shrinking, when we first lower block A (which e.g. selects the generator), then
    we draw next block B (which the lowered generator wants fewer bits of). Instead of getting a bit value for B
    and doing proper search, we end up getting a small one, and abandoning the generator shrink
- for order-based passes, try alternating orders?
  - what order is a better default?
- "prefix search" shrinking
  - when shrinking, why do we leave the tail the same?
    - we have "misalignment" problems and all that
  - generate random data instead!
    - generate random tails all the time
- minimize bitstream mis-alignment during shrinking (try to make the shape as constant as possible)
  - better, make minimization not care about mis-alignment
  - sticky bitstream?
- differentiate groups with structure vs groups without one for smarter shrinking
- non-greedy shrink
  - allow to increase the data size *between shrink passes*, if the net result is good
  - e.g. allow sort to do arbitrary? swaps
- rejection sampling during shrinking leads to data misalignment, is this a problem?
  - can we detect overruns early and re-roll only the last part of the bitstream?
- maybe overwrite bitstream instead of prune?
  - to never have an un-pruned version
  - to guarantee? that we can draw values successfully while shrinking (working with bufBitStream)

## Misc

- ability to run tests without shrinking (e.g. for running non-deterministic tests)
- bitStream -> blockStream?
- do not play with filter games for the state machine, just find all valid actions
- when generating numbers in range, try to bias based on the min number,
  just like we bias repeat based on the min number?
  - because min number defines the "magnitude" of the whole thing, kind of?
  - so when we are generating numbers in [1000000; +inf) we do not stick with 1000000 too hard
- more powerful assume/filter (look at what hypothesis is doing)
- incorporate special case checking (bounds esp.)

## Wild ideas

- global path-based generation (kind of like simplex method), which makes most of the generators hit corner cases simultaneously
- recurrence-based generation, because it is hard to stumble upon interesting stuff purely by random
  - start generating already generated stuff, overriding random for some number of draws
    - zip the sequence with itself
  - random jumps of rng, back/forward
  - recurrence-based generation may actually be better than usual fuzzing!
    - because we operate on 64 bits at once, which in most cases correspond to "full value",
      we have e.g. a much better chance to reproduce a multi-byte sequence (exact or slightly altered) somewhere else
      - this is kind-of related to go-fuzz versifier in some way
      - we also can (and should) reuse whole chunks which can correspond to strings/lists/etc.
  - random markov chain which switches states like
    - generate new data
    - reuse existing data starting from
    - reuse existing data altering it like X
  - should transition probabilities be universal or depend on generators?
    - should they also determine where to jump to, so that we jump to "compatible" stuff only?
      - can tag words with compatibility classes
      - can just jump to previous starts of the generated blocks?
  - can explore/exploit trade-off help us decide when to generate random data, and when to reuse existing?
    - probably can do thompson sampling when we have online coverage information
- arbiter-based distributed system tester
