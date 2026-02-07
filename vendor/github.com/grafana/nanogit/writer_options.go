package nanogit

// PackfileStorageMode defines how packfile objects are stored during staging.
type PackfileStorageMode int

const (
	// PackfileStorageAuto automatically chooses between memory and disk based on object count.
	// Uses memory for small operations (<=10 objects) and disk for larger operations.
	PackfileStorageAuto PackfileStorageMode = iota

	// PackfileStorageMemory always stores objects in memory for maximum performance.
	// Best for small operations but can use significant memory for bulk operations.
	PackfileStorageMemory

	// PackfileStorageDisk always stores objects in temporary files on disk.
	// Best for bulk operations to minimize memory usage.
	PackfileStorageDisk
)

// WriterOptions holds configuration options for StagedWriter.
type WriterOptions struct {
	// StorageMode determines how packfile objects are stored during staging.
	// Default is PackfileStorageAuto.
	StorageMode PackfileStorageMode
}

// WriterOption is a function type for configuring WriterOptions.
type WriterOption func(*WriterOptions) error

// WithMemoryStorage configures the writer to always use in-memory storage for packfile objects.
// This provides the best performance but can use significant memory for bulk operations.
func WithMemoryStorage() WriterOption {
	return func(opts *WriterOptions) error {
		opts.StorageMode = PackfileStorageMemory
		return nil
	}
}

// WithDiskStorage configures the writer to always use disk storage for packfile objects.
// This minimizes memory usage but may be slightly slower due to disk I/O.
func WithDiskStorage() WriterOption {
	return func(opts *WriterOptions) error {
		opts.StorageMode = PackfileStorageDisk
		return nil
	}
}

// WithAutoStorage configures the writer to automatically choose between memory and disk
// based on the number of objects. This is the default behavior.
func WithAutoStorage() WriterOption {
	return func(opts *WriterOptions) error {
		opts.StorageMode = PackfileStorageAuto
		return nil
	}
}

// defaultWriterOptions returns the default configuration for StagedWriter.
func defaultWriterOptions() *WriterOptions {
	return &WriterOptions{
		StorageMode: PackfileStorageAuto, // Default to auto mode
	}
}

// applyWriterOptions applies a list of WriterOption functions to WriterOptions.
func applyWriterOptions(options []WriterOption) (*WriterOptions, error) {
	opts := defaultWriterOptions()
	for _, option := range options {
		if option == nil {
			continue
		}
		if err := option(opts); err != nil {
			return nil, err
		}
	}
	return opts, nil
}
