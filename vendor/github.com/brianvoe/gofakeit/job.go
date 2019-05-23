package gofakeit

// JobInfo is a struct of job information
type JobInfo struct {
	Company    string
	Title      string
	Descriptor string
	Level      string
}

// Job will generate a struct with random job information
func Job() *JobInfo {
	return &JobInfo{
		Company:    Company(),
		Title:      JobTitle(),
		Descriptor: JobDescriptor(),
		Level:      JobLevel(),
	}
}

// JobTitle will generate a random job title string
func JobTitle() string {
	return getRandValue([]string{"job", "title"})
}

// JobDescriptor will generate a random job descriptor string
func JobDescriptor() string {
	return getRandValue([]string{"job", "descriptor"})
}

// JobLevel will generate a random job level string
func JobLevel() string {
	return getRandValue([]string{"job", "level"})
}
