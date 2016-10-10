package defaults

import (
	"fmt"
	"os"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/stretchr/testify/assert"
)

func TestECSCredProvider(t *testing.T) {
	defer os.Clearenv()
	os.Setenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "/abc/123")

	provider := RemoteCredProvider(aws.Config{}, request.Handlers{})

	assert.NotNil(t, provider)

	ecsProvider, ok := provider.(*endpointcreds.Provider)
	assert.NotNil(t, ecsProvider)
	assert.True(t, ok)

	assert.Equal(t, fmt.Sprintf("http://169.254.170.2/abc/123"),
		ecsProvider.Client.Endpoint)
}

func TestDefaultEC2RoleProvider(t *testing.T) {
	provider := RemoteCredProvider(aws.Config{}, request.Handlers{})

	assert.NotNil(t, provider)

	ec2Provider, ok := provider.(*ec2rolecreds.EC2RoleProvider)
	assert.NotNil(t, ec2Provider)
	assert.True(t, ok)
}
