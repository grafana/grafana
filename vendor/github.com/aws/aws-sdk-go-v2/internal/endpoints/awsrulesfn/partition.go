package awsrulesfn

import "regexp"

// Partition provides the metadata describing an AWS partition.
type Partition struct {
	ID            string                     `json:"id"`
	Regions       map[string]RegionOverrides `json:"regions"`
	RegionRegex   string                     `json:"regionRegex"`
	DefaultConfig PartitionConfig            `json:"outputs"`
}

// PartitionConfig provides the endpoint metadata for an AWS region or partition.
type PartitionConfig struct {
	Name                 string `json:"name"`
	DnsSuffix            string `json:"dnsSuffix"`
	DualStackDnsSuffix   string `json:"dualStackDnsSuffix"`
	SupportsFIPS         bool   `json:"supportsFIPS"`
	SupportsDualStack    bool   `json:"supportsDualStack"`
	ImplicitGlobalRegion string `json:"implicitGlobalRegion"`
}

type RegionOverrides struct {
	Name               *string `json:"name"`
	DnsSuffix          *string `json:"dnsSuffix"`
	DualStackDnsSuffix *string `json:"dualStackDnsSuffix"`
	SupportsFIPS       *bool   `json:"supportsFIPS"`
	SupportsDualStack  *bool   `json:"supportsDualStack"`
}

const defaultPartition = "aws"

func getPartition(partitions []Partition, region string) *PartitionConfig {
	for _, partition := range partitions {
		if v, ok := partition.Regions[region]; ok {
			p := mergeOverrides(partition.DefaultConfig, v)
			return &p
		}
	}

	for _, partition := range partitions {
		regionRegex := regexp.MustCompile(partition.RegionRegex)
		if regionRegex.MatchString(region) {
			v := partition.DefaultConfig
			return &v
		}
	}

	for _, partition := range partitions {
		if partition.ID == defaultPartition {
			v := partition.DefaultConfig
			return &v
		}
	}

	return nil
}

func mergeOverrides(into PartitionConfig, from RegionOverrides) PartitionConfig {
	if from.Name != nil {
		into.Name = *from.Name
	}
	if from.DnsSuffix != nil {
		into.DnsSuffix = *from.DnsSuffix
	}
	if from.DualStackDnsSuffix != nil {
		into.DualStackDnsSuffix = *from.DualStackDnsSuffix
	}
	if from.SupportsFIPS != nil {
		into.SupportsFIPS = *from.SupportsFIPS
	}
	if from.SupportsDualStack != nil {
		into.SupportsDualStack = *from.SupportsDualStack
	}
	return into
}
