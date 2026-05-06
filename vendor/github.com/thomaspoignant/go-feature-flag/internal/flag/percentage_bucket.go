package flag

// percentageBucket is an internal representation of the limits of the
// bucket for a variation.
type percentageBucket struct {
	start float64
	end   float64
}
