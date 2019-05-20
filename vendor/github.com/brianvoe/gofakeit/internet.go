package gofakeit

import (
	"fmt"
	"math/rand"
	"strings"
)

// DomainName will generate a random url domain name
func DomainName() string {
	return strings.ToLower(JobDescriptor()+BS()) + "." + DomainSuffix()
}

// DomainSuffix will generate a random domain suffix
func DomainSuffix() string {
	return getRandValue([]string{"internet", "domain_suffix"})
}

// URL will generate a random url string
func URL() string {
	url := "http" + RandString([]string{"s", ""}) + "://www."
	url += DomainName()

	// Slugs
	num := Number(1, 4)
	slug := make([]string, num)
	for i := 0; i < num; i++ {
		slug[i] = BS()
	}
	url += "/" + strings.ToLower(strings.Join(slug, "/"))

	return url
}

// HTTPMethod will generate a random http method
func HTTPMethod() string {
	return getRandValue([]string{"internet", "http_method"})
}

// IPv4Address will generate a random version 4 ip address
func IPv4Address() string {
	num := func() int { return 2 + rand.Intn(254) }
	return fmt.Sprintf("%d.%d.%d.%d", num(), num(), num(), num())
}

// IPv6Address will generate a random version 6 ip address
func IPv6Address() string {
	num := 65536
	return fmt.Sprintf("2001:cafe:%x:%x:%x:%x:%x:%x", rand.Intn(num), rand.Intn(num), rand.Intn(num), rand.Intn(num), rand.Intn(num), rand.Intn(num))
}

// Username will genrate a random username based upon picking a random lastname and random numbers at the end
func Username() string {
	return getRandValue([]string{"person", "last"}) + replaceWithNumbers("####")
}
