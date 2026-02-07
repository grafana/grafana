package e2e

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/runutil"
	"github.com/pkg/errors"
	"github.com/prometheus/common/expfmt"
)

var (
	dockerIPv4PortPattern = regexp.MustCompile(`^\d+\.\d+\.\d+\.\d+:(\d+)$`)
	errMissingMetric      = errors.New("metric not found")
)

// ConcreteService represents microservice with optional ports which will be discoverable from docker
// with <name>:<port>. For connecting from test, use `Endpoint` method.
//
// ConcreteService can be reused (started and stopped many time), but it can represent only one running container
// at the time.
type ConcreteService struct {
	name         string
	image        string
	networkPorts []int
	env          map[string]string
	user         string
	command      *Command
	cmd          *exec.Cmd
	readiness    ReadinessProbe
	privileged   bool

	// Maps container ports to dynamically binded local ports.
	networkPortsContainerToLocal map[int]int

	// Generic retry backoff.
	retryBackoff *backoff.Backoff

	// docker NetworkName used to start this container.
	// If empty it means service is stopped.
	usedNetworkName string
}

func NewConcreteService(
	name string,
	image string,
	command *Command,
	readiness ReadinessProbe,
	networkPorts ...int,
) *ConcreteService {
	return &ConcreteService{
		name:                         name,
		image:                        image,
		networkPorts:                 networkPorts,
		command:                      command,
		networkPortsContainerToLocal: map[int]int{},
		readiness:                    readiness,
		retryBackoff: backoff.New(context.Background(), backoff.Config{
			MinBackoff: 300 * time.Millisecond,
			MaxBackoff: 600 * time.Millisecond,
			MaxRetries: 100, // Sometimes the CI is slow ¯\_(ツ)_/¯
		}),
	}
}

func (s *ConcreteService) isExpectedRunning() bool {
	return s.usedNetworkName != ""
}

func (s *ConcreteService) Name() string { return s.name }

// Less often used options.

func (s *ConcreteService) SetBackoff(cfg backoff.Config) {
	s.retryBackoff = backoff.New(context.Background(), cfg)
}

func (s *ConcreteService) SetEnvVars(env map[string]string) {
	s.env = env
}

func (s *ConcreteService) SetUser(user string) {
	s.user = user
}

func (s *ConcreteService) SetPrivileged(privileged bool) {
	s.privileged = privileged
}

func (s *ConcreteService) Start(networkName, sharedDir string) (err error) {
	// In case of any error, if the container was already created, we
	// have to cleanup removing it. We ignore the error of the "docker rm"
	// because we don't know if the container was created or not.
	defer func() {
		if err != nil {
			_, _ = RunCommandAndGetOutput("docker", "rm", "--force", s.name)
		}
	}()

	s.cmd = exec.Command("docker", s.buildDockerRunArgs(networkName, sharedDir)...)
	s.cmd.Stdout = &LinePrefixLogger{prefix: s.name + ": ", logger: logger}
	s.cmd.Stderr = &LinePrefixLogger{prefix: s.name + ": ", logger: logger}
	if err = s.cmd.Start(); err != nil {
		return err
	}
	s.usedNetworkName = networkName

	// Wait until the container has been started.
	if err = s.WaitForRunning(); err != nil {
		return err
	}

	// Get the dynamic local ports mapped to the container.
	for _, containerPort := range s.networkPorts {
		var out []byte

		out, err = RunCommandAndGetOutput("docker", "port", s.containerName(), strconv.Itoa(containerPort))
		if err != nil {
			// Catch init errors.
			if werr := s.WaitForRunning(); werr != nil {
				return errors.Wrapf(werr, "failed to get mapping for port as container %s exited: %v", s.containerName(), err)
			}
			return errors.Wrapf(err, "unable to get mapping for port %d; service: %s; output: %q", containerPort, s.name, out)
		}

		localPort, err := parseDockerIPv4Port(string(out))
		if err != nil {
			return errors.Wrapf(err, "unable to get mapping for port %d (output: %s); service: %s", containerPort, string(out), s.name)
		}

		s.networkPortsContainerToLocal[containerPort] = localPort
	}

	logger.Log("Ports for container:", s.containerName(), "Mapping:", s.networkPortsContainerToLocal)
	return nil
}

func (s *ConcreteService) Stop() error {
	if !s.isExpectedRunning() {
		return nil
	}

	logger.Log("Stopping", s.name)

	if out, err := RunCommandAndGetOutput("docker", "stop", "--time=30", s.containerName()); err != nil {
		logger.Log(string(out))
		return err
	}
	s.usedNetworkName = ""

	return s.cmd.Wait()
}

func (s *ConcreteService) Kill() error {
	if !s.isExpectedRunning() {
		return nil
	}

	logger.Log("Killing", s.name)

	if out, err := RunCommandAndGetOutput("docker", "kill", s.containerName()); err != nil {
		logger.Log(string(out))
		return err
	}

	// Wait until the container actually stopped. However, this could fail if
	// the container already exited, so we just ignore the error.
	_, _ = RunCommandAndGetOutput("docker", "wait", s.containerName())

	s.usedNetworkName = ""

	logger.Log("Killed", s.name)
	return nil
}

// Endpoint returns external (from host perspective) service endpoint (host:port) for given internal port.
// External means that it will be accessible only from host, but not from docker containers.
//
// If your service is not running, this method returns incorrect `stopped` endpoint.
func (s *ConcreteService) Endpoint(port int) string {
	if !s.isExpectedRunning() {
		return "stopped"
	}

	// Map the container port to the local port.
	localPort, ok := s.networkPortsContainerToLocal[port]
	if !ok {
		return ""
	}

	// Use an IPv4 address instead of "localhost" hostname because our port mapping assumes IPv4
	// (a port published by a Docker container could be different between IPv4 and IPv6).
	return fmt.Sprintf("127.0.0.1:%d", localPort)
}

// NetworkEndpoint returns internal service endpoint (host:port) for given internal port.
// Internal means that it will be accessible only from docker containers within the network that this
// service is running in. If you configure your local resolver with docker DNS namespace you can access it from host
// as well. Use `Endpoint` for host access.
//
// If your service is not running, use `NetworkEndpointFor` instead.
func (s *ConcreteService) NetworkEndpoint(port int) string {
	if s.usedNetworkName == "" {
		return "stopped"
	}
	return s.NetworkEndpointFor(s.usedNetworkName, port)
}

// NetworkEndpointFor returns internal service endpoint (host:port) for given internal port and network.
// Internal means that it will be accessible only from docker containers within the given network. If you configure
// your local resolver with docker DNS namespace you can access it from host as well.
//
// This method return correct endpoint for the service in any state.
func (s *ConcreteService) NetworkEndpointFor(networkName string, port int) string {
	return fmt.Sprintf("%s:%d", NetworkContainerHost(networkName, s.name), port)
}

func (s *ConcreteService) SetReadinessProbe(probe ReadinessProbe) {
	s.readiness = probe
}

func (s *ConcreteService) Ready() error {
	if !s.isExpectedRunning() {
		return fmt.Errorf("service %s is stopped", s.Name())
	}

	// Ensure the service has a readiness probe configure.
	if s.readiness == nil {
		return nil
	}

	return s.readiness.Ready(s)
}

func (s *ConcreteService) containerName() string {
	return NetworkContainerHost(s.usedNetworkName, s.name)
}

func (s *ConcreteService) WaitForRunning() (err error) {
	if !s.isExpectedRunning() {
		return fmt.Errorf("service %s is stopped", s.Name())
	}

	for s.retryBackoff.Reset(); s.retryBackoff.Ongoing(); {
		// Enforce a timeout on the command execution because we've seen some flaky tests
		// stuck here.

		var out []byte
		out, err = RunCommandWithTimeoutAndGetOutput(5*time.Second, "docker", "inspect", "--format={{json .State.Running}}", s.containerName())
		if err != nil {
			s.retryBackoff.Wait()
			continue
		}

		if out == nil {
			err = fmt.Errorf("nil output")
			s.retryBackoff.Wait()
			continue
		}

		str := strings.TrimSpace(string(out))
		if str != "true" {
			err = fmt.Errorf("unexpected output: %q", str)
			s.retryBackoff.Wait()
			continue
		}

		return nil
	}

	return fmt.Errorf("docker container %s failed to start: %v", s.name, err)
}

func (s *ConcreteService) WaitReady() (err error) {
	if !s.isExpectedRunning() {
		return fmt.Errorf("service %s is stopped", s.Name())
	}

	for s.retryBackoff.Reset(); s.retryBackoff.Ongoing(); {
		err = s.Ready()
		if err == nil {
			return nil
		}

		s.retryBackoff.Wait()
	}

	return fmt.Errorf("the service %s is not ready; err: %v", s.name, err)
}

func (s *ConcreteService) buildDockerRunArgs(networkName, sharedDir string) []string {
	args := []string{"run", "--rm", "--net=" + networkName, "--name=" + networkName + "-" + s.name, "--hostname=" + s.name}

	// If running a dind container, this needs to be privileged.
	if s.privileged {
		args = append(args, "--privileged")
	}

	// For Drone CI users, expire the container after 6 hours using drone-gc
	args = append(args, "--label", fmt.Sprintf("io.drone.expires=%d", time.Now().Add(6*time.Hour).Unix()))

	// Mount the shared/ directory into the container
	args = append(args, "-v", fmt.Sprintf("%s:%s:z", sharedDir, ContainerSharedDir))

	// Environment variables
	for name, value := range s.env {
		args = append(args, "-e", name+"="+value)
	}

	if s.user != "" {
		args = append(args, "--user", s.user)
	}

	// Published ports
	for _, port := range s.networkPorts {
		args = append(args, "-p", strconv.Itoa(port))
	}

	// Disable entrypoint if required
	if s.command != nil && s.command.entrypointDisabled {
		args = append(args, "--entrypoint", "")
	}

	args = append(args, s.image)

	if s.command != nil {
		args = append(args, s.command.cmd)
		args = append(args, s.command.args...)
	}

	return args
}

// Exec runs the provided against a the docker container specified by this
// service. It returns the stdout, stderr, and error response from attempting
// to run the command.
func (s *ConcreteService) Exec(command *Command) (string, string, error) {
	args := []string{"exec", s.containerName()}
	args = append(args, command.cmd)
	args = append(args, command.args...)

	cmd := exec.Command("docker", args...)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()

	return stdout.String(), stderr.String(), err
}

// NetworkContainerHost return the hostname of the container within the network. This is
// the address a container should use to connect to other containers.
func NetworkContainerHost(networkName, containerName string) string {
	return fmt.Sprintf("%s-%s", networkName, containerName)
}

// NetworkContainerHostPort return the host:port address of a container within the network.
func NetworkContainerHostPort(networkName, containerName string, port int) string {
	return fmt.Sprintf("%s-%s:%d", networkName, containerName, port)
}

type Command struct {
	cmd                string
	args               []string
	entrypointDisabled bool
}

func NewCommand(cmd string, args ...string) *Command {
	return &Command{
		cmd:  cmd,
		args: args,
	}
}

func NewCommandWithoutEntrypoint(cmd string, args ...string) *Command {
	return &Command{
		cmd:                cmd,
		args:               args,
		entrypointDisabled: true,
	}
}

type ReadinessProbe interface {
	Ready(service *ConcreteService) (err error)
}

// HTTPReadinessProbe checks readiness by making HTTP(S) call and checking for expected response status code.
type HTTPReadinessProbe struct {
	schema                   string
	port                     int
	path                     string
	expectedStatusRangeStart int
	expectedStatusRangeEnd   int
	expectedContent          []string

	// The TLS config to use when issuing the HTTPS request.
	clientTLSConfig *tls.Config
}

func NewHTTPReadinessProbe(port int, path string, expectedStatusRangeStart, expectedStatusRangeEnd int, expectedContent ...string) *HTTPReadinessProbe {
	return &HTTPReadinessProbe{
		schema:                   "http",
		port:                     port,
		path:                     path,
		expectedStatusRangeStart: expectedStatusRangeStart,
		expectedStatusRangeEnd:   expectedStatusRangeEnd,
		expectedContent:          expectedContent,
	}
}

func NewHTTPSReadinessProbe(port int, path, serverName, clientKeyFile, clientCertFile, rootCertFile string, expectedStatusRangeStart, expectedStatusRangeEnd int, expectedContent ...string) (*HTTPReadinessProbe, error) {
	// Load client certificate and private key.
	cert, err := tls.LoadX509KeyPair(clientCertFile, clientKeyFile)
	if err != nil {
		return nil, errors.Wrapf(err, "error creating x509 keypair from client cert file %s and client key file %s", clientCertFile, clientKeyFile)
	}

	caCert, err := ioutil.ReadFile(rootCertFile)
	if err != nil {
		return nil, errors.Wrapf(err, "error opening root CA cert file %s", rootCertFile)
	}

	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)

	return &HTTPReadinessProbe{
		schema:                   "https",
		port:                     port,
		path:                     path,
		expectedStatusRangeStart: expectedStatusRangeStart,
		expectedStatusRangeEnd:   expectedStatusRangeEnd,
		expectedContent:          expectedContent,
		clientTLSConfig: &tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      caCertPool,
			ServerName:   serverName,
		},
	}, nil
}

func (p *HTTPReadinessProbe) Ready(service *ConcreteService) (err error) {
	endpoint := service.Endpoint(p.port)
	if endpoint == "" {
		return fmt.Errorf("cannot get service endpoint for port %d", p.port)
	} else if endpoint == "stopped" {
		return errors.New("service has stopped")
	}

	res, err := DoGetTLS(p.schema+"://"+endpoint+p.path, p.clientTLSConfig)
	if err != nil {
		return err
	}

	defer runutil.ExhaustCloseWithErrCapture(&err, res.Body, "response readiness")
	body, _ := ioutil.ReadAll(res.Body)

	if res.StatusCode < p.expectedStatusRangeStart || res.StatusCode > p.expectedStatusRangeEnd {
		return fmt.Errorf("expected code in range: [%v, %v], got status code: %v and body: %v", p.expectedStatusRangeStart, p.expectedStatusRangeEnd, res.StatusCode, string(body))
	}

	for _, expected := range p.expectedContent {
		if !strings.Contains(string(body), expected) {
			return fmt.Errorf("expected body containing %s, got: %v", expected, string(body))
		}
	}

	return nil
}

// TCPReadinessProbe checks readiness by ensure a TCP connection can be established.
type TCPReadinessProbe struct {
	port int
}

func NewTCPReadinessProbe(port int) *TCPReadinessProbe {
	return &TCPReadinessProbe{
		port: port,
	}
}

func (p *TCPReadinessProbe) Ready(service *ConcreteService) (err error) {
	endpoint := service.Endpoint(p.port)
	if endpoint == "" {
		return fmt.Errorf("cannot get service endpoint for port %d", p.port)
	} else if endpoint == "stopped" {
		return errors.New("service has stopped")
	}

	conn, err := net.DialTimeout("tcp", endpoint, time.Second)
	if err != nil {
		return err
	}

	return conn.Close()
}

// CmdReadinessProbe checks readiness by `Exec`ing a command (within container) which returns 0 to consider status being ready
type CmdReadinessProbe struct {
	cmd *Command
}

func NewCmdReadinessProbe(cmd *Command) *CmdReadinessProbe {
	return &CmdReadinessProbe{cmd: cmd}
}

func (p *CmdReadinessProbe) Ready(service *ConcreteService) error {
	_, _, err := service.Exec(p.cmd)
	return err
}

type LinePrefixLogger struct {
	prefix string
	logger log.Logger
}

func (w *LinePrefixLogger) Write(p []byte) (n int, err error) {
	for _, line := range strings.Split(string(p), "\n") {
		// Skip empty lines
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Write the prefix + line to the wrapped writer
		if err := w.logger.Log(w.prefix + line); err != nil {
			return 0, err
		}
	}

	return len(p), nil
}

// HTTPService represents opinionated microservice with at least HTTP port that as mandatory requirement,
// serves metrics.
type HTTPService struct {
	*ConcreteService

	metricsTimeout time.Duration
	httpPort       int
}

func NewHTTPService(
	name string,
	image string,
	command *Command,
	readiness ReadinessProbe,
	httpPort int,
	otherPorts ...int,
) *HTTPService {
	return &HTTPService{
		ConcreteService: NewConcreteService(name, image, command, readiness, append(otherPorts, httpPort)...),
		metricsTimeout:  time.Second,
		httpPort:        httpPort,
	}
}

func (s *HTTPService) SetMetricsTimeout(timeout time.Duration) {
	s.metricsTimeout = timeout
}

func (s *HTTPService) Metrics() (_ string, err error) {
	// Map the container port to the local port
	localPort := s.networkPortsContainerToLocal[s.httpPort]

	// Fetch metrics.
	// Use an IPv4 address instead of "localhost" hostname because our port mapping assumes IPv4
	// (a port published by a Docker container could be different between IPv4 and IPv6).
	res, err := DoGetWithTimeout(fmt.Sprintf("http://127.0.0.1:%d/metrics", localPort), s.metricsTimeout)
	if err != nil {
		return "", err
	}

	// Check the status code.
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("unexpected status code %d while fetching metrics", res.StatusCode)
	}

	defer runutil.ExhaustCloseWithErrCapture(&err, res.Body, "metrics response")
	body, err := ioutil.ReadAll(res.Body)

	return string(body), err
}

func (s *HTTPService) HTTPPort() int {
	return s.httpPort
}

func (s *HTTPService) HTTPEndpoint() string {
	return s.Endpoint(s.httpPort)
}

func (s *HTTPService) NetworkHTTPEndpoint() string {
	return s.NetworkEndpoint(s.httpPort)
}

func (s *HTTPService) NetworkHTTPEndpointFor(networkName string) string {
	return s.NetworkEndpointFor(networkName, s.httpPort)
}

// WaitSumMetrics waits for at least one instance of each given metric names to be present and their sums, returning true
// when passed to given isExpected(...).
func (s *HTTPService) WaitSumMetrics(isExpected func(sums ...float64) bool, metricNames ...string) error {
	return s.WaitSumMetricsWithOptions(isExpected, metricNames)
}

func (s *HTTPService) WaitSumMetricsWithOptions(isExpected func(sums ...float64) bool, metricNames []string, opts ...MetricsOption) error {
	var (
		sums    []float64
		err     error
		options = buildMetricsOptions(opts)
	)

	for s.retryBackoff.Reset(); s.retryBackoff.Ongoing(); {
		sums, err = s.SumMetrics(metricNames, opts...)
		if options.WaitMissingMetrics && errors.Is(err, errMissingMetric) {
			continue
		}
		if err != nil {
			return err
		}

		if isExpected(sums...) {
			return nil
		}

		s.retryBackoff.Wait()
	}

	return fmt.Errorf("unable to find metrics %s with expected values. Last error: %v. Last values: %v", metricNames, err, sums)
}

// SumMetrics returns the sum of the values of each given metric names.
func (s *HTTPService) SumMetrics(metricNames []string, opts ...MetricsOption) ([]float64, error) {
	options := buildMetricsOptions(opts)
	sums := make([]float64, len(metricNames))

	metrics, err := s.Metrics()
	if err != nil {
		return nil, err
	}

	var tp expfmt.TextParser
	families, err := tp.TextToMetricFamilies(strings.NewReader(metrics))
	if err != nil {
		return nil, err
	}

	for i, m := range metricNames {
		sums[i] = 0.0

		// Get the metric family.
		mf, ok := families[m]
		if !ok {
			if options.SkipMissingMetrics {
				continue
			}

			return nil, errors.Wrapf(errMissingMetric, "metric=%s service=%s", m, s.name)
		}

		// Filter metrics.
		metrics := filterMetrics(mf.GetMetric(), options)
		if len(metrics) == 0 {
			if options.SkipMissingMetrics {
				continue
			}

			return nil, errors.Wrapf(errMissingMetric, "metric=%s service=%s", m, s.name)
		}

		sums[i] = SumValues(getValues(metrics, options))
	}

	return sums, nil
}

// WaitRemovedMetric waits until a metric disappear from the list of metrics exported by the service.
func (s *HTTPService) WaitRemovedMetric(metricName string, opts ...MetricsOption) error {
	options := buildMetricsOptions(opts)

	for s.retryBackoff.Reset(); s.retryBackoff.Ongoing(); {
		// Fetch metrics.
		metrics, err := s.Metrics()
		if err != nil {
			return err
		}

		// Parse metrics.
		var tp expfmt.TextParser
		families, err := tp.TextToMetricFamilies(strings.NewReader(metrics))
		if err != nil {
			return err
		}

		// Get the metric family.
		mf, ok := families[metricName]
		if !ok {
			return nil
		}

		// Filter metrics.
		if len(filterMetrics(mf.GetMetric(), options)) == 0 {
			return nil
		}

		s.retryBackoff.Wait()
	}

	return fmt.Errorf("the metric %s is still exported by %s", metricName, s.name)
}

// parseDockerIPv4Port parses the input string which is expected to be the output of "docker port"
// command and returns the first IPv4 port found.
func parseDockerIPv4Port(out string) (int, error) {
	// The "docker port" output may be multiple lines if both IPv4 and IPv6 are supported,
	// so we need to parse each line.
	for _, line := range strings.Split(out, "\n") {
		matches := dockerIPv4PortPattern.FindStringSubmatch(strings.TrimSpace(line))
		if len(matches) != 2 {
			continue
		}

		port, err := strconv.Atoi(matches[1])
		if err != nil {
			continue
		}

		return port, nil
	}

	// We've not been able to parse the output format.
	return 0, errors.New("unknown output format")
}
