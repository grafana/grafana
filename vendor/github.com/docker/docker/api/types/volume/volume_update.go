package volume // import "github.com/docker/docker/api/types/volume"

// UpdateOptions is configuration to update a Volume with.
type UpdateOptions struct {
	// Spec is the ClusterVolumeSpec to update the volume to.
	Spec *ClusterVolumeSpec `json:"Spec,omitempty"`
}
