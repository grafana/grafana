package data

// Framer is simply an object that can be converted to Grafana data frames.
// This interface allows us to interact with types that represent data source objects
// without having to convert them to data frames first.
type Framer interface {
	Frames() (Frames, error)
}
