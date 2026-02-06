package telebot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// Raw lets you call any method of Bot API manually.
// It also handles API errors, so you only need to unwrap
// result field from json data.
func (b *Bot) Raw(method string, payload interface{}) ([]byte, error) {
	url := b.URL + "/bot" + b.Token + "/" + method

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(payload); err != nil {
		return nil, err
	}

	// Cancel the request immediately without waiting for the timeout
	// when bot is about to stop.
	// This may become important if doing long polling with long timeout.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		b.stopMu.RLock()
		stopCh := b.stopClient
		b.stopMu.RUnlock()

		select {
		case <-stopCh:
			cancel()
		case <-ctx.Done():
		}
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return nil, wrapError(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, wrapError(err)
	}
	resp.Close = true
	defer resp.Body.Close()

	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, wrapError(err)
	}

	if b.verbose {
		verbose(method, payload, data)
	}

	// returning data as well
	return data, extractOk(data)
}

func (b *Bot) sendFiles(method string, files map[string]File, params map[string]string) ([]byte, error) {
	rawFiles := make(map[string]interface{})
	for name, f := range files {
		switch {
		case f.InCloud():
			params[name] = f.FileID
		case f.FileURL != "":
			params[name] = f.FileURL
		case f.OnDisk():
			rawFiles[name] = f.FileLocal
		case f.FileReader != nil:
			rawFiles[name] = f.FileReader
		default:
			return nil, fmt.Errorf("telebot: file for field %s doesn't exist", name)
		}
	}

	if len(rawFiles) == 0 {
		return b.Raw(method, params)
	}

	pipeReader, pipeWriter := io.Pipe()
	writer := multipart.NewWriter(pipeWriter)

	go func() {
		defer pipeWriter.Close()

		for field, file := range rawFiles {
			if err := addFileToWriter(writer, files[field].fileName, field, file); err != nil {
				pipeWriter.CloseWithError(err)
				return
			}
		}
		for field, value := range params {
			if err := writer.WriteField(field, value); err != nil {
				pipeWriter.CloseWithError(err)
				return
			}
		}
		if err := writer.Close(); err != nil {
			pipeWriter.CloseWithError(err)
			return
		}
	}()

	url := b.URL + "/bot" + b.Token + "/" + method

	resp, err := b.client.Post(url, writer.FormDataContentType(), pipeReader)
	if err != nil {
		err = wrapError(err)
		pipeReader.CloseWithError(err)
		return nil, err
	}
	resp.Close = true
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusInternalServerError {
		return nil, ErrInternal
	}

	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, wrapError(err)
	}

	return data, extractOk(data)
}

func addFileToWriter(writer *multipart.Writer, filename, field string, file interface{}) error {
	var reader io.Reader
	if r, ok := file.(io.Reader); ok {
		reader = r
	} else if path, ok := file.(string); ok {
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		reader = f
	} else {
		return fmt.Errorf("telebot: file for field %v should be io.ReadCloser or string", field)
	}

	part, err := writer.CreateFormFile(field, filename)
	if err != nil {
		return err
	}

	_, err = io.Copy(part, reader)
	return err
}

func (f *File) process(name string, files map[string]File) string {
	switch {
	case f.InCloud():
		return f.FileID
	case f.FileURL != "":
		return f.FileURL
	case f.OnDisk() || f.FileReader != nil:
		files[name] = *f
		return "attach://" + name
	}
	return ""
}

func (b *Bot) sendText(to Recipient, text string, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
		"text":    text,
	}
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendMessage", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

func (b *Bot) sendMedia(media Media, params map[string]string, files map[string]File) (*Message, error) {
	kind := media.MediaType()
	what := "send" + strings.Title(kind)

	if kind == "videoNote" {
		kind = "video_note"
	}

	sendFiles := map[string]File{kind: *media.MediaFile()}
	for k, v := range files {
		sendFiles[k] = v
	}

	data, err := b.sendFiles(what, sendFiles, params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

func (b *Bot) getMe() (*User, error) {
	data, err := b.Raw("getMe", nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *User
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

func (b *Bot) getUpdates(offset, limit int, timeout time.Duration, allowed []string) ([]Update, error) {
	params := map[string]string{
		"offset":  strconv.Itoa(offset),
		"timeout": strconv.Itoa(int(timeout / time.Second)),
	}

	data, _ := json.Marshal(allowed)
	params["allowed_updates"] = string(data)

	if limit != 0 {
		params["limit"] = strconv.Itoa(limit)
	}

	data, err := b.Raw("getUpdates", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []Update
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

func (b *Bot) forwardCopyMany(to Recipient, msgs []Editable, key string, opts ...*SendOptions) ([]Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
	}

	embedMessages(params, msgs)

	if len(opts) > 0 {
		b.embedSendOptions(params, opts[0])
	}

	data, err := b.Raw(key, params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []Message
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		var resp struct {
			Result bool
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, wrapError(err)
		}
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// extractOk checks given result for error. If result is ok returns nil.
// In other cases it extracts API error. If error is not presented
// in errors.go, it will be prefixed with `unknown` keyword.
func extractOk(data []byte) error {
	var e struct {
		Ok          bool                   `json:"ok"`
		Code        int                    `json:"error_code"`
		Description string                 `json:"description"`
		Parameters  map[string]interface{} `json:"parameters"`
	}
	if json.NewDecoder(bytes.NewReader(data)).Decode(&e) != nil {
		return nil // FIXME
	}
	if e.Ok {
		return nil
	}

	err := Err(e.Description)
	switch err {
	case nil:
	case ErrGroupMigrated:
		migratedTo, ok := e.Parameters["migrate_to_chat_id"]
		if !ok {
			return NewError(e.Code, e.Description)
		}

		return GroupError{
			err:        err.(*Error),
			MigratedTo: int64(migratedTo.(float64)),
		}
	default:
		return err
	}

	switch e.Code {
	case http.StatusTooManyRequests:
		retryAfter, ok := e.Parameters["retry_after"]
		if !ok {
			return NewError(e.Code, e.Description)
		}

		err = FloodError{
			err:        NewError(e.Code, e.Description),
			RetryAfter: int(retryAfter.(float64)),
		}
	default:
		err = fmt.Errorf("telegram: %s (%d)", e.Description, e.Code)
	}

	return err
}

// extractMessage extracts common Message result from given data.
// Should be called after extractOk or b.Raw() to handle possible errors.
func extractMessage(data []byte) (*Message, error) {
	var resp struct {
		Result *Message
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		var resp struct {
			Result bool
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, wrapError(err)
		}
		if resp.Result {
			return nil, ErrTrueResult
		}
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

func verbose(method string, payload interface{}, data []byte) {
	body, _ := json.Marshal(payload)
	body = bytes.ReplaceAll(body, []byte(`\"`), []byte(`"`))
	body = bytes.ReplaceAll(body, []byte(`"{`), []byte(`{`))
	body = bytes.ReplaceAll(body, []byte(`}"`), []byte(`}`))

	indent := func(b []byte) string {
		var buf bytes.Buffer
		json.Indent(&buf, b, "", "  ")
		return buf.String()
	}

	log.Printf(
		"[verbose] telebot: sent request\nMethod: %v\nParams: %v\nResponse: %v",
		method, indent(body), indent(data),
	)
}
