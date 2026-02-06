package centrifuge

// ControlEventHandler can handle messages received from Controller.
type ControlEventHandler interface {
	// HandleControl to handle received control data.
	HandleControl(data []byte) error
}

type Controller interface {
	// RegisterControlEventHandler called once on start when controller already set to node. At
	// this moment node is ready to process controller events.
	RegisterControlEventHandler(ControlEventHandler) error
	// PublishControl allows sending control command data. If nodeID is empty string
	// then message should be delivered to all running nodes, if nodeID is set then
	// message should be delivered only to node with specified ID. If shardKey is set
	// then it can be used for ordering control (now not used).
	PublishControl(data []byte, nodeID, shardKey string) error
}
