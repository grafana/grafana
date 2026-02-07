package notify

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/go-openapi/strfmt"
	"golang.org/x/sync/errgroup"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/featurecontrol"
	"github.com/prometheus/alertmanager/flushlog"
	"github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/matchers/compat"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/cluster"
	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/notify/nfstatus"
	"github.com/grafana/alerting/notify/stages"
	"github.com/grafana/alerting/receivers"

	"github.com/grafana/alerting/models"
	"github.com/grafana/alerting/templates"
)

const (
	// defaultResolveTimeout is the default timeout used for resolving an alert
	// if the end time is not specified.
	defaultResolveTimeout = 5 * time.Minute
	// memoryAlertsGCInterval is the interval at which we'll remove resolved alerts from memory.
	memoryAlertsGCInterval = 30 * time.Minute
	// snapshotPlaceholder is not a real snapshot file and will not be used, a non-empty string is required to run the maintenance function on shutdown.
	// See https://github.com/prometheus/alertmanager/blob/3ee2cd0f1271e277295c02b6160507b4d193dde2/silence/silence.go#L435-L438
	snapshotPlaceholder = "snapshot"
)

func init() {
	// This initializes the compat package in fallback mode. It parses first using the UTF-8 parser
	// and then fallsback to the classic parser on error. UTF-8 is permitted in label names.
	// This should be removed when the compat package is removed from Alertmanager.
	compat.InitFromFlags(log.NewNopLogger(), featurecontrol.NoopFlags{})
}

type ClusterPeer interface {
	AddState(string, cluster.State, prometheus.Registerer) cluster.ClusterChannel
	Position() int
	WaitReady(context.Context) error
}

type TemplatesProvider interface {
	GetTemplate(kind templates.Kind) (*templates.Template, error)
}

type GrafanaAlertmanager struct {
	opts   GrafanaAlertmanagerOpts
	logger log.Logger

	marker types.Marker
	alerts *mem.Alerts
	route  *dispatch.Route

	// wg is for dispatcher, inhibitor, silences and notifications
	// Across configuration changes dispatcher and inhibitor are completely replaced, however, silences, notification log and alerts remain the same.
	// stopc is used to let silences and notifications know we are done.
	wg    sync.WaitGroup
	stopc chan struct{}

	notificationLog *nflog.Log
	dispatcher      *dispatch.Dispatcher
	inhibitor       *inhibit.Inhibitor
	silencer        *silence.Silencer
	silences        *silence.Silences
	flushLog        *flushlog.FlushLog

	// timeIntervals is the set of all time_intervals and mute_time_intervals from
	// the configuration.
	timeIntervals map[string][]timeinterval.TimeInterval

	stageMetrics      *notify.Metrics
	dispatcherMetrics *dispatch.DispatcherMetrics

	reloadConfigMtx sync.RWMutex
	configHash      [16]byte
	config          []byte
	receivers       []*nfstatus.Receiver

	// templates contains the current templates
	templates *templates.Factory // TODO use cached once we make sure templates are immutable
}

// State represents any of the two 'states' of the alertmanager. Notification log or Silences.
// MarshalBinary returns the binary representation of this internal state based on the protobuf.
type State interface {
	MarshalBinary() ([]byte, error)
}

// MaintenanceOptions represent the configuration options available for executing maintenance of Silences and the Notification log that the Alertmanager uses.
type MaintenanceOptions interface {
	// InitialState returns the initial snapshot of the artefacts under maintenance. This will be loaded when the Alertmanager starts.
	InitialState() string
	// Retention represents for how long should we keep the artefacts under maintenance.
	Retention() time.Duration
	// MaintenanceFrequency represents how often should we execute the maintenance.
	MaintenanceFrequency() time.Duration
	// MaintenanceFunc returns the function to execute as part of the maintenance process. This will usually take a snaphot of the artefacts under maintenance.
	// It returns the size of the state in bytes or an error if the maintenance fails.
	MaintenanceFunc(state State) (int64, error)
}

var NewIntegration = nfstatus.NewIntegration

type (
	InhibitRule      = config.InhibitRule
	MuteTimeInterval = config.MuteTimeInterval
	TimeInterval     = config.TimeInterval
	Route            = config.Route
	Integration      = nfstatus.Integration
	DispatcherLimits = dispatch.Limits
	Notifier         = notify.Notifier
)

type DynamicLimits struct {
	Dispatcher DispatcherLimits
	Templates  templates.Limits
}

//nolint:revive
type NotifyReceiver = nfstatus.Receiver

type NotificationsConfiguration struct {
	RoutingTree       *Route
	InhibitRules      []InhibitRule
	MuteTimeIntervals []MuteTimeInterval
	TimeIntervals     []TimeInterval
	Templates         []templates.TemplateDefinition
	Receivers         []*APIReceiver

	Limits DynamicLimits

	Raw  []byte
	Hash [16]byte
}

type Limits struct {
	MaxSilences         int
	MaxSilenceSizeBytes int
}

type GrafanaAlertmanagerOpts struct {
	ExternalURL        string
	AlertStoreCallback mem.AlertStoreCallback
	PeerTimeout        time.Duration

	Silences MaintenanceOptions
	Nflog    MaintenanceOptions
	FlushLog MaintenanceOptions

	Limits Limits

	EmailSender   receivers.EmailSender
	ImageProvider images.Provider
	Decrypter     GetDecryptedValueFn

	Version   string
	TenantKey string
	TenantID  int64

	Peer    ClusterPeer
	Logger  log.Logger
	Metrics *GrafanaAlertmanagerMetrics

	NotificationHistorian nfstatus.NotificationHistorian

	DispatchTimer DispatchTimer
}

func (c *GrafanaAlertmanagerOpts) Validate() error {
	if c.Silences == nil {
		return errors.New("silence maintenance options must be present")
	}

	if c.Nflog == nil {
		return errors.New("notification log maintenance options must be present")
	}

	// only validate flush log options if using sync'ed dispatcher timer
	if c.DispatchTimer == DispatchTimerSync && c.FlushLog == nil {
		return errors.New("flush log maintenance options must be present")
	}

	if c.EmailSender == nil {
		return errors.New("email sender must be present")
	}

	if c.ImageProvider == nil {
		return errors.New("image provider must be present")
	}

	if c.Decrypter == nil {
		return errors.New("decrypter must be present")
	}

	if c.TenantKey == "" {
		return errors.New("tenant key must be present")
	}

	if c.Peer == nil {
		return errors.New("peer must be present")
	}

	if c.Logger == nil {
		return errors.New("logger must be present")
	}

	if c.Metrics == nil {
		return errors.New("metrics must be present")
	}

	return nil
}

// NewGrafanaAlertmanager creates a new Grafana-specific Alertmanager.
func NewGrafanaAlertmanager(opts GrafanaAlertmanagerOpts) (*GrafanaAlertmanager, error) {
	if err := opts.Validate(); err != nil {
		return nil, err
	}

	am := &GrafanaAlertmanager{
		opts:              opts,
		stopc:             make(chan struct{}),
		logger:            log.With(opts.Logger, "component", "alertmanager", opts.TenantKey, opts.TenantID),
		marker:            types.NewMarker(opts.Metrics.Registerer),
		stageMetrics:      notify.NewMetrics(opts.Metrics.Registerer, featurecontrol.NoopFlags{}),
		dispatcherMetrics: dispatch.NewDispatcherMetrics(false, opts.Metrics.Registerer),
	}

	var err error

	// Initialize silences
	am.silences, err = silence.New(silence.Options{
		Metrics:        opts.Metrics.Registerer,
		SnapshotReader: strings.NewReader(opts.Silences.InitialState()),
		Retention:      opts.Silences.Retention(),
		Limits: silence.Limits{
			MaxSilences:         func() int { return opts.Limits.MaxSilences },
			MaxSilenceSizeBytes: func() int { return opts.Limits.MaxSilenceSizeBytes },
		},
	})
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the silencing component of alerting: %w", err)
	}

	// Initialize the notification log
	am.notificationLog, err = nflog.New(nflog.Options{
		SnapshotReader: strings.NewReader(opts.Nflog.InitialState()),
		Retention:      opts.Nflog.Retention(),
		Logger:         opts.Logger,
		Metrics:        opts.Metrics.Registerer,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the notification log component of alerting: %w", err)
	}
	c := opts.Peer.AddState(fmt.Sprintf("notificationlog:%d", opts.TenantID), am.notificationLog, opts.Metrics.Registerer)
	am.notificationLog.SetBroadcast(c.Broadcast)

	c = opts.Peer.AddState(fmt.Sprintf("silences:%d", opts.TenantID), am.silences, opts.Metrics.Registerer)
	am.silences.SetBroadcast(c.Broadcast)

	am.wg.Add(1)
	go func() {
		am.notificationLog.Maintenance(opts.Nflog.MaintenanceFrequency(), snapshotPlaceholder, am.stopc, func() (int64, error) {
			if _, err := am.notificationLog.GC(); err != nil {
				level.Error(am.logger).Log("msg", "notification log garbage collection", "err", err)
			}

			return opts.Nflog.MaintenanceFunc(am.notificationLog)
		})
		am.wg.Done()
	}()

	am.wg.Add(1)
	go func() {
		am.silences.Maintenance(opts.Silences.MaintenanceFrequency(), snapshotPlaceholder, am.stopc, func() (int64, error) {
			// Delete silences older than the retention period.
			if _, err := am.silences.GC(); err != nil {
				level.Error(am.logger).Log("msg", "silence garbage collection", "err", err)
				// Don't return here - we need to snapshot our state first.
			}

			// Snapshot our silences to the Grafana KV store
			return opts.Silences.MaintenanceFunc(am.silences)
		})
		am.wg.Done()
	}()

	// Initialize the flush log only if using sync'ed timer
	if am.opts.DispatchTimer == DispatchTimerSync {
		am.flushLog, err = flushlog.New(flushlog.Options{
			SnapshotReader: strings.NewReader(opts.FlushLog.InitialState()),
			Retention:      opts.FlushLog.Retention(),
			Logger:         opts.Logger,
			Metrics:        opts.Metrics.Registerer,
		})
		if err != nil {
			return nil, fmt.Errorf("unable to initialize the flush log component of alerting: %w", err)
		}
		c = opts.Peer.AddState(fmt.Sprintf("flushlog:%d", opts.TenantID), am.flushLog, opts.Metrics.Registerer)
		am.flushLog.SetBroadcast(c.Broadcast)

		am.wg.Add(1)
		go func() {
			am.flushLog.Maintenance(opts.FlushLog.MaintenanceFrequency(), snapshotPlaceholder, am.stopc, func() (int64, error) {
				if _, err := am.flushLog.GC(); err != nil {
					level.Error(am.logger).Log("msg", "flush log garbage collection", "err", err)
				}

				return opts.FlushLog.MaintenanceFunc(am.flushLog)
			})
			am.wg.Done()
		}()

	}

	// Initialize in-memory alerts
	am.alerts, err = mem.NewAlerts(context.Background(), am.marker, memoryAlertsGCInterval, opts.AlertStoreCallback, am.logger, opts.Metrics.Registerer)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the alert provider component of alerting: %w", err)
	}

	cfg, err := templates.NewConfig(fmt.Sprintf("%d", am.TenantID()), am.ExternalURL(), am.opts.Version, templates.DefaultLimits)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the template provider component of alerting: %w", err)
	}
	am.templates, err = templates.NewFactory(nil, cfg, am.logger)
	if err != nil {
		return nil, err
	}

	return am, nil
}

func (am *GrafanaAlertmanager) MergeSilences(sil []byte) error {
	return am.silences.Merge(sil)
}

func (am *GrafanaAlertmanager) MergeNflog(nflog []byte) error {
	return am.notificationLog.Merge(nflog)
}

func (am *GrafanaAlertmanager) MergeFlushLog(flushLog []byte) error {
	// flushLog will only be initialized if using sync'ed dispatcher timer
	if am.flushLog != nil {
		return am.flushLog.Merge(flushLog)
	}
	return nil
}

func (am *GrafanaAlertmanager) TenantID() int64 {
	return am.opts.TenantID
}

func (am *GrafanaAlertmanager) Ready() bool {
	// We consider AM as ready only when the config has been
	// applied at least once successfully. Until then, some objects
	// can still be nil.
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	return am.ready()
}

func (am *GrafanaAlertmanager) ready() bool {
	return am.config != nil
}

func (am *GrafanaAlertmanager) StopAndWait() {
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}

	am.alerts.Close()

	close(am.stopc)

	am.wg.Wait()
}

// GetReceiversStatus returns the status of receivers configured as part of the current configuration.
// It is safe to call concurrently.
func (am *GrafanaAlertmanager) GetReceiversStatus() []models.ReceiverStatus {
	am.reloadConfigMtx.RLock()
	receivers := am.receivers
	am.reloadConfigMtx.RUnlock()

	return GetReceivers(receivers)
}

// GetReceivers converts the internal receiver status into the API response.
func GetReceivers(receivers []*nfstatus.Receiver) []models.ReceiverStatus {
	apiReceivers := make([]models.ReceiverStatus, 0, len(receivers))
	for _, rcv := range receivers {
		// Build integrations slice for each receiver.
		integrations := make([]models.IntegrationStatus, 0, len(rcv.Integrations()))
		for _, integration := range rcv.Integrations() {
			ts, d, err := integration.GetReport()
			integrations = append(integrations, models.IntegrationStatus{
				Name:                      integration.Name(),
				SendResolved:              integration.SendResolved(),
				LastNotifyAttempt:         strfmt.DateTime(ts),
				LastNotifyAttemptDuration: d.String(),
				LastNotifyAttemptError: func() string {
					if err != nil {
						return err.Error()
					}
					return ""
				}(),
			})
		}

		apiReceivers = append(apiReceivers, models.ReceiverStatus{
			Active:       rcv.Active(),
			Integrations: integrations,
			Name:         rcv.Name(),
		})
	}

	return apiReceivers
}

// job contains all metadata required to test a receiver
type job struct {
	Config       *models.IntegrationConfig
	ReceiverName string
	Notifier     *nfstatus.Integration
}

// result contains the receiver that was tested and a non-nil error if the test failed
type result struct {
	Config       *models.IntegrationConfig
	ReceiverName string
	Error        error
}

func newTestReceiversResult(alert types.Alert, results []result, receivers []*APIReceiver, notifiedAt time.Time) (*TestReceiversResult, int) {
	var numBadRequests, numTimeouts, numUnknownErrors int

	m := make(map[string]TestReceiverResult)
	for _, receiver := range receivers {
		// Set up the result for this receiver
		m[receiver.Name] = TestReceiverResult{
			Name: receiver.Name,
			// A Grafana receiver can have multiple nested receivers
			Configs: make([]TestIntegrationConfigResult, 0, len(receiver.Integrations)),
		}
	}
	for _, next := range results {
		tmp := m[next.ReceiverName]
		status := "ok"
		if next.Error != nil {
			status = "failed"
		}

		var invalidReceiverErr IntegrationValidationError
		var receiverTimeoutErr IntegrationTimeoutError

		var errString string
		err := ProcessIntegrationError(next.Config, next.Error)
		if err != nil {
			if errors.As(err, &invalidReceiverErr) {
				numBadRequests++
			} else if errors.As(err, &receiverTimeoutErr) {
				numTimeouts++
			} else {
				numUnknownErrors++
			}

			errString = err.Error()
		}

		tmp.Configs = append(tmp.Configs, TestIntegrationConfigResult{
			Name:   next.Config.Name,
			UID:    next.Config.UID,
			Status: status,
			Error:  errString,
		})
		m[next.ReceiverName] = tmp
	}
	v := new(TestReceiversResult)
	v.Alert = alert
	v.Receivers = make([]TestReceiverResult, 0, len(receivers))
	v.NotifedAt = notifiedAt
	for _, next := range m {
		v.Receivers = append(v.Receivers, next)
	}

	// Make sure the return order is deterministic.
	sort.Slice(v.Receivers, func(i, j int) bool {
		return v.Receivers[i].Name < v.Receivers[j].Name
	})

	var returnCode int
	if numBadRequests == len(v.Receivers) {
		// if all receivers contain invalid configuration
		returnCode = http.StatusBadRequest
	} else if numTimeouts == len(v.Receivers) {
		// if all receivers contain valid configuration but timed out
		returnCode = http.StatusRequestTimeout
	} else if numBadRequests+numTimeouts+numUnknownErrors > 0 {
		returnCode = http.StatusMultiStatus
	} else {
		// all receivers were sent a notification without error
		returnCode = http.StatusOK
	}

	return v, returnCode
}

func TestReceivers(
	ctx context.Context,
	c TestReceiversConfigBodyParams,
	buildIntegrationsFunc func(*APIReceiver, TemplatesProvider) ([]*nfstatus.Integration, error),
	tmplProvider TemplatesProvider,
) (*TestReceiversResult, int, error) {
	now := time.Now() // The start time of the test
	testAlert := newTestAlert(c.Alert, now, now)

	// All invalid receiver configurations
	invalid := make([]result, 0, len(c.Receivers))
	// All receivers that need to be sent test notifications
	jobs := make([]job, 0, len(c.Receivers))

	for _, receiver := range c.Receivers {
		for _, intg := range receiver.Integrations {
			// Create an APIReceiver with a single integration so we
			// can identify invalid receiver integration configs
			singleIntReceiver := &APIReceiver{
				ConfigReceiver: config.Receiver{
					Name: receiver.Name,
				},
				ReceiverConfig: models.ReceiverConfig{
					Integrations: []*models.IntegrationConfig{intg},
				},
			}
			integrations, err := buildIntegrationsFunc(singleIntReceiver, tmplProvider)
			if err != nil || len(integrations) == 0 {
				invalid = append(invalid, result{
					Config:       intg,
					ReceiverName: intg.Name,
					Error:        err,
				})
			} else {
				jobs = append(jobs, job{
					Config:       intg,
					ReceiverName: receiver.Name,
					Notifier:     integrations[0],
				})
			}
		}
	}

	if len(invalid)+len(jobs) == 0 {
		return nil, 0, ErrNoReceivers
	}

	if len(jobs) == 0 {
		res, status := newTestReceiversResult(testAlert, invalid, c.Receivers, now)
		return res, status, nil
	}

	numWorkers := maxTestReceiversWorkers
	if numWorkers > len(jobs) {
		numWorkers = len(jobs)
	}

	resultCh := make(chan result, len(jobs))
	workCh := make(chan job, len(jobs))
	for _, job := range jobs {
		workCh <- job
	}
	close(workCh)

	g, ctx := errgroup.WithContext(ctx)
	for i := 0; i < numWorkers; i++ {
		g.Go(func() error {
			for next := range workCh {
				v := result{
					Config:       next.Config,
					ReceiverName: next.ReceiverName,
					Error:        TestNotifier(ctx, next.Notifier, testAlert, now),
				}
				resultCh <- v
			}
			return nil
		})
	}

	err := g.Wait()
	close(resultCh)

	if err != nil {
		return nil, 0, err
	}

	results := make([]result, 0, len(jobs))
	for next := range resultCh {
		results = append(results, next)
	}

	res, status := newTestReceiversResult(testAlert, append(invalid, results...), c.Receivers, now)
	return res, status, nil
}

func TestTemplate(ctx context.Context, c TestTemplatesConfigBodyParams, tmplsFactory *templates.Factory, logger log.Logger) (*TestTemplatesResults, error) {
	tc := templates.TemplateDefinition{
		Name:     c.Name,
		Template: c.Template,
		Kind:     c.Kind,
	}
	if !templates.IsKnownKind(tc.Kind) {
		tc.Kind = templates.GrafanaKind
	}

	factory, err := tmplsFactory.WithTemplate(tc)
	if err != nil {
		return &TestTemplatesResults{
			Errors: []TestTemplatesErrorResult{{
				Kind:  InvalidTemplate,
				Error: err.Error(),
			}},
		}, nil
	}

	definitions, err := templates.ParseTemplateDefinition(tc)
	if err != nil {
		return &TestTemplatesResults{
			Errors: []TestTemplatesErrorResult{{
				Kind:  InvalidTemplate,
				Error: err.Error(),
			}},
		}, nil
	}

	newTmpl, err := factory.GetTemplate(tc.Kind)
	if err != nil {
		return nil, err
	}
	txt, err := newTmpl.Text()
	if err != nil {
		return nil, err
	}

	// Prepare the context.
	alerts := OpenAPIAlertsToAlerts(c.Alerts)
	labels := model.LabelSet{DefaultGroupLabel: DefaultGroupLabelValue}
	ctx = notify.WithGroupKey(ctx, fmt.Sprintf("%s-%s-%d", DefaultReceiverName, labels.Fingerprint(), time.Now().Unix()))
	ctx = notify.WithReceiverName(ctx, DefaultReceiverName)
	ctx = notify.WithGroupLabels(ctx, labels)

	promTmplData := notify.GetTemplateData(ctx, newTmpl.Template, alerts, logger)
	data := templates.ExtendData(promTmplData, logger)
	data.AppVersion = newTmpl.AppVersion

	// Iterate over each definition in the template and evaluate it.
	var results TestTemplatesResults
	for _, def := range definitions {
		res, scope, err := testTemplateScopes(txt, def, data)
		if err != nil {
			results.Errors = append(results.Errors, TestTemplatesErrorResult{
				Name:  def,
				Kind:  ExecutionError,
				Error: err.Error(),
			})
		} else {
			results.Results = append(results.Results, TestTemplatesResult{
				Name:  def,
				Text:  res,
				Scope: scope,
			})
		}
	}

	return &results, nil
}

func (am *GrafanaAlertmanager) ExternalURL() string {
	return am.opts.ExternalURL
}

// ConfigHash returns the hash of the current running configuration.
// It is not safe to call without a lock.
func (am *GrafanaAlertmanager) ConfigHash() [16]byte {
	return am.configHash
}

func (am *GrafanaAlertmanager) WithReadLock(fn func()) {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()
	fn()
}

func (am *GrafanaAlertmanager) WithLock(fn func()) {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()
	fn()
}

func (am *GrafanaAlertmanager) buildTimeIntervals(timeIntervals []config.TimeInterval, muteTimeIntervals []config.MuteTimeInterval) map[string][]timeinterval.TimeInterval {
	muteTimes := make(map[string][]timeinterval.TimeInterval, len(timeIntervals)+len(muteTimeIntervals))
	for _, ti := range timeIntervals {
		muteTimes[ti.Name] = ti.TimeIntervals
	}
	for _, ti := range muteTimeIntervals {
		muteTimes[ti.Name] = ti.TimeIntervals
	}
	return muteTimes
}

// ApplyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *GrafanaAlertmanager) ApplyConfig(cfg NotificationsConfiguration) (err error) {
	tmplCfg, err := templates.NewConfig(fmt.Sprintf("%d", am.TenantID()), am.ExternalURL(), am.opts.Version, cfg.Limits.Templates)
	if err != nil {
		return err
	}
	factory, err := templates.NewFactory(cfg.Templates, tmplCfg, am.logger)
	if err != nil {
		return err
	}
	am.templates = factory
	cached := templates.NewCachedFactory(factory)

	// build the integrations map using the receiver configuration and templates.
	integrationsMap, err := BuildReceiversIntegrations(
		am.opts.TenantID,
		cfg.Receivers,
		cached,
		am.opts.ImageProvider,
		am.opts.Decrypter,
		DecodeSecretsFromBase64,
		am.opts.EmailSender,
		nil,
		NoWrap,
		am.opts.Version,
		am.logger,
		am.opts.NotificationHistorian,
	)
	if err != nil {
		return err
	}

	// Now, let's put together our notification pipeline
	routingStage := make(notify.RoutingStage, len(integrationsMap))

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	am.inhibitor = inhibit.NewInhibitor(am.alerts, cfg.InhibitRules, am.marker, am.logger)
	am.timeIntervals = am.buildTimeIntervals(cfg.TimeIntervals, cfg.MuteTimeIntervals)
	am.silencer = silence.NewSilencer(am.silences, am.marker, am.logger)

	meshStage := notify.NewGossipSettleStage(am.opts.Peer)
	inhibitionStage := notify.NewMuteStage(am.inhibitor, am.stageMetrics)
	ti := timeinterval.NewIntervener(am.timeIntervals)
	activeTimeStage := notify.NewTimeActiveStage(ti, am.stageMetrics)
	timeMuteStage := notify.NewTimeMuteStage(ti, am.stageMetrics)
	silencingStage := notify.NewMuteStage(am.silencer, am.stageMetrics)

	am.route = dispatch.NewRoute(cfg.RoutingTree, nil)

	var dispatchTimer dispatch.TimerFactory
	if am.opts.DispatchTimer == DispatchTimerSync {
		dispatchTimer = dispatch.NewSyncTimerFactory(am.flushLog, am.opts.Peer.Position)
	}

	am.dispatcher = dispatch.NewDispatcher(am.alerts, am.route, routingStage, am.marker, am.timeoutFunc, cfg.Limits.Dispatcher, am.logger, am.dispatcherMetrics, dispatchTimer)

	// TODO: This has not been upstreamed yet. Should be aligned when https://github.com/prometheus/alertmanager/pull/3016 is merged.
	receivers := make([]*nfstatus.Receiver, 0, len(integrationsMap))
	activeReceivers := GetActiveReceiversMap(am.route)
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, nfstatus.GetIntegrations(integrationsMap[name]), am.notificationLog)
		routingStage[name] = notify.MultiStage{meshStage, silencingStage, activeTimeStage, timeMuteStage, inhibitionStage, stage}
		_, isActive := activeReceivers[name]

		receivers = append(receivers, nfstatus.NewReceiver(name, isActive, integrationsMap[name]))
	}

	am.setReceiverMetrics(receivers, len(activeReceivers))
	am.setInhibitionRulesMetrics(cfg.InhibitRules)

	am.receivers = receivers

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.dispatcher.Run()
	}()

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.inhibitor.Run()
	}()

	am.configHash = cfg.Hash
	am.config = cfg.Raw

	return nil
}

func (am *GrafanaAlertmanager) setInhibitionRulesMetrics(r []InhibitRule) {
	am.opts.Metrics.configuredInhibitionRules.WithLabelValues(am.tenantString()).Set(float64(len(r)))
}

func (am *GrafanaAlertmanager) setReceiverMetrics(receivers []*nfstatus.Receiver, countActiveReceivers int) {
	am.opts.Metrics.configuredReceivers.WithLabelValues(am.tenantString(), ActiveStateLabelValue).Set(float64(countActiveReceivers))
	am.opts.Metrics.configuredReceivers.WithLabelValues(am.tenantString(), InactiveStateLabelValue).Set(float64(len(receivers) - countActiveReceivers))

	integrationsByType := make(map[string]int, len(receivers))
	for _, r := range receivers {
		for _, i := range r.Integrations() {
			integrationsByType[i.Name()]++
		}
	}

	for t, count := range integrationsByType {
		am.opts.Metrics.configuredIntegrations.WithLabelValues(am.tenantString(), t).Set(float64(count))
	}
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *GrafanaAlertmanager) PutAlerts(postableAlerts amv2.PostableAlerts) error {
	now := time.Now()
	alerts, validationErr := PostableAlertsToAlertmanagerAlerts(postableAlerts, now)

	// Register metrics.
	for _, a := range alerts {
		if a.EndsAt.After(now) {
			am.opts.Metrics.Firing().Inc()
		} else {
			am.opts.Metrics.Resolved().Inc()
		}

		level.Debug(am.logger).Log("msg",
			"Putting alert",
			"alert",
			a,
			"starts_at",
			a.StartsAt,
			"ends_at",
			a.EndsAt)
	}

	if err := am.alerts.Put(alerts...); err != nil {
		// Notification sending alert takes precedence over validation errors.
		return err
	}
	if validationErr != nil {
		am.opts.Metrics.Invalid().Add(float64(len(validationErr.Alerts)))
		// Even if validationErr is nil, the require.NoError fails on it.
		return validationErr
	}
	return nil
}

// PostableAlertsToAlertmanagerAlerts converts the PostableAlerts to a slice of *types.Alert.
// It sets `StartsAt` and `EndsAt`, ignores empty and namespace UID labels, and captures validation errors for each skipped alert.
func PostableAlertsToAlertmanagerAlerts(postableAlerts amv2.PostableAlerts, now time.Time) ([]*types.Alert, *AlertValidationError) {
	alerts := make([]*types.Alert, 0, len(postableAlerts))
	var validationErr *AlertValidationError
	for _, a := range postableAlerts {
		alert := &types.Alert{
			Alert: model.Alert{
				Labels:       model.LabelSet{},
				Annotations:  model.LabelSet{},
				StartsAt:     time.Time(a.StartsAt),
				EndsAt:       time.Time(a.EndsAt),
				GeneratorURL: a.GeneratorURL.String(),
			},
			UpdatedAt: now,
		}

		for k, v := range a.Labels {
			if len(v) == 0 || k == models.NamespaceUIDLabel { // Skip empty and namespace UID labels.
				continue
			}

			alert.Labels[model.LabelName(k)] = model.LabelValue(v)
		}

		for k, v := range a.Annotations {
			if len(v) == 0 { // Skip empty annotation.
				continue
			}
			alert.Annotations[model.LabelName(k)] = model.LabelValue(v)
		}

		// Ensure StartsAt is set.
		if alert.StartsAt.IsZero() {
			if alert.EndsAt.IsZero() {
				alert.StartsAt = now
			} else {
				alert.StartsAt = alert.EndsAt
			}
		}
		// If no end time is defined, set a timeout after which an alert
		// is marked resolved if it is not updated.
		if alert.EndsAt.IsZero() {
			alert.Timeout = true
			alert.EndsAt = now.Add(defaultResolveTimeout)
		}

		if err := alert.Validate(); err != nil {
			if validationErr == nil {
				validationErr = &AlertValidationError{}
			}
			validationErr.Alerts = append(validationErr.Alerts, a)
			validationErr.Errors = append(validationErr.Errors, err)
			continue
		}

		alerts = append(alerts, alert)
	}

	return alerts, validationErr
}

// AlertValidationError is the error capturing the validation errors
// faced on the alerts.
type AlertValidationError struct {
	Alerts amv2.PostableAlerts
	Errors []error // Errors[i] refers to Alerts[i].
}

func (e AlertValidationError) Error() string {
	errMsg := ""
	if len(e.Errors) != 0 {
		errMsg = e.Errors[0].Error()
		for _, e := range e.Errors[1:] {
			errMsg += ";" + e.Error()
		}
	}
	return errMsg
}

// createReceiverStage creates a pipeline of stages for a receiver.
func (am *GrafanaAlertmanager) createReceiverStage(name string, integrations []*notify.Integration, notificationLog notify.NotificationLog) notify.Stage {
	var fs notify.FanoutStage
	for i := range integrations {
		recv := &nflogpb.Receiver{
			GroupName:   name,
			Integration: integrations[i].Name(),
			Idx:         uint32(integrations[i].Index()),
		}
		var s notify.MultiStage
		s = append(s, stages.NewWaitStage(am.opts.Peer, am.opts.PeerTimeout))
		s = append(s, notify.NewDedupStage(integrations[i], notificationLog, recv))
		s = append(s, notify.NewRetryStage(integrations[i], name, am.stageMetrics))
		s = append(s, notify.NewSetNotifiesStage(notificationLog, recv))

		fs = append(fs, s)
	}
	return fs
}

func (am *GrafanaAlertmanager) waitFunc() time.Duration {
	return time.Duration(am.opts.Peer.Position()) * am.opts.PeerTimeout
}

func (am *GrafanaAlertmanager) timeoutFunc(d time.Duration) time.Duration {
	// time.Duration d relates to the receiver's group_interval. Even with a group interval of 1s,
	// we need to make sure (non-position-0) peers in the cluster wait before flushing the notifications.
	if d < notify.MinTimeout {
		d = notify.MinTimeout
	}
	return d + am.waitFunc()
}

func (am *GrafanaAlertmanager) tenantString() string {
	return fmt.Sprintf("%d", am.opts.TenantID)
}

func (am *GrafanaAlertmanager) buildReceiverIntegrations(receiver *APIReceiver, tmpls TemplatesProvider) ([]*Integration, error) {
	return BuildReceiverIntegrations(
		am.opts.TenantID,
		receiver,
		tmpls,
		am.opts.ImageProvider,
		am.opts.Decrypter,
		DecodeSecretsFromBase64,
		am.opts.EmailSender,
		nil,
		NoWrap,
		am.opts.Version,
		am.logger,
		am.opts.NotificationHistorian,
	)
}
