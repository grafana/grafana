package v1

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const subjectSizeLimit = 100

// Notifier is responsible for sending
// alert notifications to Amazon SNS.
type Notifier struct {
	*receivers.Base
	tmpl     *templates.Template
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		tmpl:     template,
		settings: cfg,
	}
}

// Notify sends the alert notification to sns.
func (s *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := s.GetLogger(ctx)
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, s.tmpl, as, l, &tmplErr)

	level.Info(l).Log("msg", "Sending notification")

	publishInput, err := s.createPublishInput(ctx, tmpl)
	if err != nil {
		return false, err
	}

	snsClient, err := s.createSNSClient(tmpl)
	if err != nil {
		return true, err
	}

	// check template error after we use them
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template message", "err", tmplErr.Error())
	}

	publishOutput, err := snsClient.Publish(publishInput)
	if err != nil {
		level.Error(l).Log("msg", "Failed to publish to Amazon SNS. ", "err", err)
		return true, err
	}

	level.Debug(l).Log("msg", "Message successfully published", "messageId", publishOutput.MessageId, "sequenceNumber", publishOutput.SequenceNumber)
	return true, nil
}

func (s *Notifier) SendResolved() bool {
	return !s.GetDisableResolveMessage()
}

func (s *Notifier) createMessageAttributes(tmpl func(string) string) map[string]*sns.MessageAttributeValue {
	// Convert the given attributes map into the AWS Message Attributes Format.
	attributes := make(map[string]*sns.MessageAttributeValue, len(s.settings.Attributes))
	for k, v := range s.settings.Attributes {
		attributes[tmpl(k)] = &sns.MessageAttributeValue{DataType: aws.String("String"), StringValue: aws.String(tmpl(v))}
	}
	return attributes
}

func (s *Notifier) createSNSClient(tmpl func(string) string) (*sns.SNS, error) {
	var creds *credentials.Credentials
	// If there are provided sigV4 credentials we want to use those to create a session.
	if s.settings.Sigv4.AccessKey != "" && s.settings.Sigv4.SecretKey != "" {
		creds = credentials.NewStaticCredentials(s.settings.Sigv4.AccessKey, s.settings.Sigv4.SecretKey, "")
	}
	sess, err := session.NewSessionWithOptions(session.Options{
		Config: aws.Config{
			Region:   aws.String(s.settings.Sigv4.Region),
			Endpoint: aws.String(tmpl(s.settings.APIUrl)),
		},
		Profile: s.settings.Sigv4.Profile,
	})
	if err != nil {
		return nil, err
	}

	if s.settings.Sigv4.RoleARN != "" {
		var stsSess *session.Session
		if s.settings.APIUrl == "" {
			stsSess = sess
		} else {
			// If we have set the API URL we need to create a new session to get the STS Credentials.
			stsSess, err = session.NewSessionWithOptions(session.Options{
				Config: aws.Config{
					Region:      aws.String(s.settings.Sigv4.Region),
					Credentials: creds,
				},
				Profile: s.settings.Sigv4.Profile,
			})
			if err != nil {
				return nil, err
			}
		}
		creds = stscreds.NewCredentials(stsSess, s.settings.Sigv4.RoleARN)
	}
	// Use our generated session with credentials to create the SNS Client.
	client := sns.New(sess, aws.NewConfig().WithCredentials(creds).WithEndpoint(*aws.String(s.settings.APIUrl)))
	// We will always need a region to be set by either the local config or the environment.
	if aws.StringValue(sess.Config.Region) == "" {
		return nil, fmt.Errorf("region not configured in sns.sigv4.region or in default credentials chain")
	}
	return client, nil
}

func (s *Notifier) createPublishInput(ctx context.Context, tmpl func(string) string) (*sns.PublishInput, error) {
	publishInput := &sns.PublishInput{}
	messageAttributes := s.createMessageAttributes(tmpl)
	// Max message size for a message in an SNS publish request is 256KB, except for SMS messages where the limit is 1600 characters/runes.
	messageSizeLimit := 256 * 1024
	if s.settings.TopicARN != "" {
		topicARN := tmpl(s.settings.TopicARN)
		publishInput.SetTopicArn(topicARN)
		// If we are using a topic ARN, it could be a FIFO topic specified by the topic's suffix ".fifo".
		if strings.HasSuffix(topicARN, ".fifo") {
			// Deduplication key and Message Group ID are only added if it's a FIFO SNS Topic.
			key, err := notify.ExtractGroupKey(ctx)
			if err != nil {
				return nil, err
			}
			publishInput.SetMessageDeduplicationId(key.Hash())
			publishInput.SetMessageGroupId(key.Hash())
		}
	}

	if s.settings.PhoneNumber != "" {
		publishInput.SetPhoneNumber(tmpl(s.settings.PhoneNumber))
		// If we have an SMS message, we need to truncate to 1600 characters/runes.
		messageSizeLimit = 1600
	}
	if s.settings.TargetARN != "" {
		publishInput.SetTargetArn(tmpl(s.settings.TargetARN))
	}

	messageToSend, isTrunc, err := validateAndTruncateString(tmpl(s.settings.Message), messageSizeLimit)
	if err != nil {
		return nil, fmt.Errorf("message validation failed: %v", err)
	}
	if isTrunc {
		// If we truncated the message we need to add a message attribute showing that it was truncated.
		messageAttributes["truncated"] = &sns.MessageAttributeValue{DataType: aws.String("String"), StringValue: aws.String("true")}
	}

	subject, subjIsTrunc, err := validateAndTruncateString(tmpl(s.settings.Subject), subjectSizeLimit)
	if err != nil {
		return nil, fmt.Errorf("subject validation failed: %v", err)
	}
	if subjIsTrunc {
		// If we truncated the subject we need to add a message attribute showing that it was truncated.
		messageAttributes["subject_truncated"] = &sns.MessageAttributeValue{DataType: aws.String("String"), StringValue: aws.String("true")}
	}
	if subject != "" {
		publishInput.SetSubject(subject)
	}

	publishInput.SetMessage(messageToSend)
	publishInput.SetMessageAttributes(messageAttributes)

	return publishInput, nil
}

func validateAndTruncateString(message string, maxMessageSizeInBytes int) (string, bool, error) {
	if !utf8.ValidString(message) {
		return "", false, fmt.Errorf("non utf8 encoded string")
	}
	if len(message) <= maxMessageSizeInBytes {
		return message, false, nil
	}
	// If the given string is larger than our specified size we have to truncate.
	truncated := make([]byte, maxMessageSizeInBytes)
	copy(truncated, message)
	return string(truncated), true, nil
}
