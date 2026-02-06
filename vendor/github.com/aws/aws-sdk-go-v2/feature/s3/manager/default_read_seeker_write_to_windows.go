package manager

func defaultUploadBufferProvider() ReadSeekerWriteToProvider {
	return NewBufferedReadSeekerWriteToPool(1024 * 1024)
}
