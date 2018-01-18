// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

type Rescore struct {
	rescorer                 Rescorer
	windowSize               *int
	defaultRescoreWindowSize *int
}

func NewRescore() *Rescore {
	return &Rescore{}
}

func (r *Rescore) WindowSize(windowSize int) *Rescore {
	r.windowSize = &windowSize
	return r
}

func (r *Rescore) IsEmpty() bool {
	return r.rescorer == nil
}

func (r *Rescore) Rescorer(rescorer Rescorer) *Rescore {
	r.rescorer = rescorer
	return r
}

func (r *Rescore) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if r.windowSize != nil {
		source["window_size"] = *r.windowSize
	} else if r.defaultRescoreWindowSize != nil {
		source["window_size"] = *r.defaultRescoreWindowSize
	}
	rescorerSrc, err := r.rescorer.Source()
	if err != nil {
		return nil, err
	}
	source[r.rescorer.Name()] = rescorerSrc
	return source, nil
}
