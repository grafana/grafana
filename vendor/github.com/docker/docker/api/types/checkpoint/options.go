package checkpoint

// CreateOptions holds parameters to create a checkpoint from a container.
type CreateOptions struct {
	CheckpointID  string
	CheckpointDir string
	Exit          bool
}

// ListOptions holds parameters to list checkpoints for a container.
type ListOptions struct {
	CheckpointDir string
}

// DeleteOptions holds parameters to delete a checkpoint from a container.
type DeleteOptions struct {
	CheckpointID  string
	CheckpointDir string
}
