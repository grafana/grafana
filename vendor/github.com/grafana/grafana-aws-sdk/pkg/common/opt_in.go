package common

func IsOptInRegion(region string) bool {
	// Opt-in regions listed at https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
	regions := map[string]bool{
		"af-south-1":     true,
		"ap-east-1":      true,
		"ap-east-2":      true,
		"ap-south-2":     true,
		"ap-southeast-3": true,
		"ap-southeast-4": true,
		"ap-southeast-5": true,
		"ap-southeast-6": true,
		"ap-southeast-7": true,
		"ca-west-1":      true,
		"eu-central-2":   true,
		"eu-south-1":     true,
		"eu-south-2":     true,
		"il-central-1":   true,
		"me-central-1":   true,
		"me-south-1":     true,
		"mx-central-1":   true,
	}
	return regions[region]
}
