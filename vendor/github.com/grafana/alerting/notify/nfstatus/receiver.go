package nfstatus

// Receiver holds onto a slice of nfstatus.Integration and some metadata.
type Receiver struct {
	name         string
	integrations []*Integration
	active       bool
}

func (r *Receiver) Name() string {
	return r.name
}

func (r *Receiver) Active() bool {
	return r.active
}

func (r *Receiver) Integrations() []*Integration {
	return r.integrations
}

func NewReceiver(name string, active bool, integrations []*Integration) *Receiver {
	return &Receiver{
		name:         name,
		active:       active,
		integrations: integrations,
	}
}
