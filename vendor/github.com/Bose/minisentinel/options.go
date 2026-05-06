package minisentinel

import (
	"github.com/alicebob/miniredis/v2"
)

// Option - how Options are passed as arguments
type Option func(*Options)

// Options = how options are represented
type Options struct {
	masterName string
	master     *miniredis.Miniredis
	replica    *miniredis.Miniredis
}

func getDefaultOptions() Options {
	return Options{
		masterName: "mymaster",
		master:     nil,
		replica:    nil,
	}
}

// WithMasterName - set the name of the master
func WithMasterName(name string) Option {
	return func(o *Options) {
		o.masterName = name
	}
}

// WithMaster - set the primary miniredis for the sentinel
func WithMaster(m *miniredis.Miniredis) Option {
	return func(o *Options) {
		o.master = m
	}
}

// WithReplica - set the replicas for sentinel
func WithReplica(replica *miniredis.Miniredis) Option {
	return func(o *Options) {
		o.replica = replica
	}
}

// GetOpts - iterate the inbound Options and return a struct
func GetOpts(opt ...Option) Options {
	opts := getDefaultOptions()
	for _, o := range opt {
		o(&opts)
	}
	return opts
}
