package receivers

import (
	"bytes"
	"context"
	"crypto/tls"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net"
	"net/mail"
	"strconv"
	"strings"

	"github.com/Masterminds/sprig/v3"
	gomail "gopkg.in/mail.v2"
)

//go:embed templates/*
var defaultEmailTemplate embed.FS

type EmailSenderConfig struct {
	AuthPassword   string
	AuthUser       string
	CertFile       string
	ContentTypes   []string
	EhloIdentity   string
	ExternalURL    string
	FromName       string
	FromAddress    string
	Host           string
	KeyFile        string
	SkipVerify     bool
	StartTLSPolicy string
	StaticHeaders  map[string]string
	SentBy         string
	// UseBCC indicates whether to send emails using BCC
	// instead of the TO field when SingleEmail is false.
	// If both UseBCC and SingleEmail are true, UseBCC is ignored
	// and recipients are placed in the TO field.
	UseBCC bool
}

type defaultEmailSender struct {
	cfg    EmailSenderConfig
	tmpl   *template.Template
	dialFn func(*defaultEmailSender) (gomail.SendCloser, error)
}

// NewEmailSender takes a configuration and returns a new EmailSender.
func NewEmailSender(cfg EmailSenderConfig) (EmailSender, error) {
	tmpl, err := template.New("templates").
		Funcs(template.FuncMap{
			"Subject":                 subjectTemplateFunc,
			"__dangerouslyInjectHTML": __dangerouslyInjectHTML,
		}).Funcs(sprig.FuncMap()).
		ParseFS(defaultEmailTemplate, "templates/*")
	if err != nil {
		return nil, err
	}
	return &defaultEmailSender{
		cfg:  cfg,
		tmpl: tmpl,
		dialFn: func(s *defaultEmailSender) (gomail.SendCloser, error) {
			return s.dial()
		},
	}, nil
}

// Message representats an email message.
type Message struct {
	To               []string
	From             string
	Subject          string
	Body             map[string]string
	EmbeddedFiles    []string
	EmbeddedContents []EmbeddedContent
	ReplyTo          []string
	SingleEmail      bool
}

// SendEmail implements the EmailSender interface.
func (s *defaultEmailSender) SendEmail(_ context.Context, cmd *SendEmailSettings) error {
	message, err := s.buildEmailMessage(cmd)
	if err != nil {
		return err
	}

	_, err = s.Send(message)
	return err
}

func (s *defaultEmailSender) buildEmailMessage(cmd *SendEmailSettings) (*Message, error) {
	data := cmd.Data
	if data == nil {
		data = make(map[string]any, 10)
	}

	s.setDefaultTemplateData(data)

	body := make(map[string]string)
	for _, contentType := range s.cfg.ContentTypes {
		fileExtension, err := getFileExtensionByContentType(contentType)
		if err != nil {
			return nil, err
		}
		var buffer bytes.Buffer
		err = s.tmpl.ExecuteTemplate(&buffer, cmd.Template+fileExtension, data)
		if err != nil {
			return nil, err
		}

		body[contentType] = buffer.String()
	}

	subject := cmd.Subject
	if cmd.Subject == "" {
		subjectData := data["Subject"].(map[string]any)
		subjectText, hasSubject := subjectData["executed_template"].(string)
		if !hasSubject {
			return nil, fmt.Errorf("missing subject in template %s", cmd.Template)
		}
		subject = subjectText
	}

	addr := mail.Address{Name: s.cfg.FromName, Address: s.cfg.FromAddress}
	return &Message{
		To:               cmd.To,
		From:             addr.String(),
		Subject:          subject,
		Body:             body,
		EmbeddedFiles:    cmd.EmbeddedFiles,
		EmbeddedContents: cmd.EmbeddedContents,
		ReplyTo:          cmd.ReplyTo,
		SingleEmail:      cmd.SingleEmail,
	}, nil
}

func (s *defaultEmailSender) setDefaultTemplateData(data map[string]any) {
	data["AppUrl"] = s.cfg.ExternalURL
	data["Subject"] = map[string]any{}
	data["SentBy"] = s.cfg.SentBy
	dataCopy := map[string]any{}
	for k, v := range data {
		dataCopy[k] = v
	}
	data["TemplateData"] = dataCopy
}

func (s *defaultEmailSender) Send(messages ...*Message) (int, error) {
	sentEmailsCount := 0

	sender, err := s.dialFn(s)
	if err != nil {
		return sentEmailsCount, fmt.Errorf("failed to dial SMTP server: %w", err)
	}
	defer sender.Close()

	var errs error

	for _, msg := range messages {
		for _, m := range s.expandMsg(msg) {
			if err := gomail.Send(sender, m); err != nil {
				errs = errors.Join(errs, fmt.Errorf("failed to send notification to email addresses: %s: %w", strings.Join(msg.To, ";"), err))
			} else {
				sentEmailsCount++
			}
		}
	}

	return sentEmailsCount, errs
}

// expandMsg expands the message to a list of messages, one for each recipient
// if SingleEmail is false, otherwise it returns a single message.
func (s *defaultEmailSender) expandMsg(msg *Message) []*gomail.Message {
	if msg.SingleEmail || s.cfg.UseBCC {
		return []*gomail.Message{s.buildEmail(msg)}
	}

	result := make([]*gomail.Message, 0, len(msg.To))

	for _, recipient := range msg.To {
		msgCopy := *msg
		msgCopy.To = []string{recipient}
		m := s.buildEmail(&msgCopy)
		result = append(result, m)
	}

	return result
}

func (s *defaultEmailSender) dial() (gomail.SendCloser, error) {
	dialer, err := s.createDialer()
	if err != nil {
		return nil, err
	}
	return dialer.Dial()
}

func (s *defaultEmailSender) createDialer() (*gomail.Dialer, error) {
	host, port, err := net.SplitHostPort(s.cfg.Host)
	if err != nil {
		return nil, err
	}
	iPort, err := strconv.Atoi(port)
	if err != nil {
		return nil, err
	}

	tlsconfig := &tls.Config{
		InsecureSkipVerify: s.cfg.SkipVerify,
		ServerName:         host,
	}

	if s.cfg.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(s.cfg.CertFile, s.cfg.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("could not load cert or key file: %w", err)
		}
		tlsconfig.Certificates = []tls.Certificate{cert}
	}

	d := gomail.NewDialer(host, iPort, s.cfg.AuthUser, s.cfg.AuthPassword)
	d.TLSConfig = tlsconfig
	d.StartTLSPolicy = getStartTLSPolicy(s.cfg.StartTLSPolicy)
	d.LocalName = s.cfg.EhloIdentity

	return d, nil
}

func getStartTLSPolicy(policy string) gomail.StartTLSPolicy {
	switch policy {
	case "NoStartTLS":
		return -1
	case "MandatoryStartTLS":
		return 1
	default:
		return 0
	}
}

// buildEmail converts the Message DTO to a gomail message.
func (s *defaultEmailSender) buildEmail(msg *Message) *gomail.Message {
	m := gomail.NewMessage()
	// Add all static headers to the email message.
	for h, val := range s.cfg.StaticHeaders {
		m.SetHeader(h, val)
	}
	m.SetHeader("From", msg.From)
	if s.cfg.UseBCC && !msg.SingleEmail {
		m.SetHeader("Bcc", msg.To...)
	} else {
		m.SetHeader("To", msg.To...)
	}
	m.SetHeader("Subject", msg.Subject)

	// Add embedded files.
	for _, file := range msg.EmbeddedFiles {
		m.Embed(file)
	}

	for _, file := range msg.EmbeddedContents {
		m.Embed(file.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			_, err := writer.Write(file.Content)
			return err
		}))
	}

	// Add reply-to addresses to the email message.
	replyTo := make([]string, 0, len(msg.ReplyTo))
	for _, address := range msg.ReplyTo {
		replyTo = append(replyTo, m.FormatAddress(address, ""))
	}
	m.SetHeader("Reply-To", strings.Join(replyTo, ", "))

	// Loop over content types from settings in reverse order as they are ordered in according to descending
	// preference while the alternatives should be ordered according to ascending preference.
	for i := len(s.cfg.ContentTypes) - 1; i >= 0; i-- {
		if i == len(s.cfg.ContentTypes)-1 {
			m.SetBody(s.cfg.ContentTypes[i], msg.Body[s.cfg.ContentTypes[i]])
		} else {
			m.AddAlternative(s.cfg.ContentTypes[i], msg.Body[s.cfg.ContentTypes[i]])
		}
	}

	return m
}

func getFileExtensionByContentType(contentType string) (string, error) {
	switch contentType {
	case "text/html":
		return ".html", nil
	case "text/plain":
		return ".txt", nil
	default:
		return "", fmt.Errorf("unrecognized content type %q", contentType)
	}
}

// subjectTemplateFunc sets the subject template (value) on the map represented by `.Subject.` (obj) so that it can be compiled and executed later.
// In addition, it executes and returns the subject template using the data represented in `.TemplateData` (data).
// This results in the template being replaced by the subject string.
func subjectTemplateFunc(obj map[string]any, data map[string]any, value string) string {
	obj["value"] = value

	titleTmpl, err := template.New("title").Parse(value)
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	err = titleTmpl.ExecuteTemplate(&buf, "title", data)
	if err != nil {
		return ""
	}

	subj := buf.String()
	// Since we have already executed the template, save it to subject data so we don't have to do it again later on
	obj["executed_template"] = subj
	return subj
}

// __dangerouslyInjectHTML allows marking areas of am email template as HTML safe, this will _not_ sanitize the string and will allow HTML snippets to be rendered verbatim.
// Use with absolute care as this _could_ allow for XSS attacks when used in an insecure context.
//
// It's safe to ignore gosec warning G203 when calling this function in an HTML template because we assume anyone who has write access
// to the email templates folder is an administrator.
//
// nolint:gosec,revive
func __dangerouslyInjectHTML(s string) template.HTML {
	return template.HTML(s)
}
