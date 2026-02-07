package notify

// TODO(gotjosh): I don't think this is right, make sure you evaluate it.
func (am *GrafanaAlertmanager) GetStatus() []byte {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	if am.ready() {
		return am.config
	}

	return nil
}
