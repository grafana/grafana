package testcerts

// GenerateCerts generates a x509 certificate and key.
// It returns the certificate and key as byte slices, and any error that occurred.
//
//	cert, key, err := GenerateCerts()
//	if err != nil {
//		// handle error
//	}
func GenerateCerts(domains ...string) ([]byte, []byte, error) {
	ca := NewCA()

	// Returning CA for backwards compatibility
	if len(domains) == 0 {
		return ca.PublicKey(), ca.PrivateKey(), nil
	}

	// If domains exist return a regular cert
	kp, err := ca.NewKeyPair(domains...)
	if err != nil {
		return nil, nil, err
	}
	return kp.PublicKey(), kp.PrivateKey(), nil
}

// GenerateCertsToFile creates a x509 certificate and key and writes it to the specified file paths.
//
//	err := GenerateCertsToFile("/path/to/cert", "/path/to/key")
//	if err != nil {
//		// handle error
//	}
//
// If the specified file paths already exist, it will overwrite the existing files.
func GenerateCertsToFile(certFile, keyFile string) error {
	// Create Certs using CA for backwards compatibility
	return NewCA().ToFile(certFile, keyFile)
}

// GenerateCertsToTempFile will create a temporary x509 certificate and key in a randomly generated file using the
// directory path provided. If no directory is specified, the default directory for temporary files as returned by
// os.TempDir will be used.
//
//	cert, key, err := GenerateCertsToTempFile("/tmp/")
//	if err != nil {
//		// handle error
//	}
func GenerateCertsToTempFile(dir string) (string, string, error) {
	// Create Certs using CA for backwards compatibility
	cert, key, err := NewCA().ToTempFile(dir)
	if err != nil {
		return "", "", err
	}

	return cert.Name(), key.Name(), nil
}
