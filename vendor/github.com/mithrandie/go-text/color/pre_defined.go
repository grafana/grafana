package color

import "sync"

var (
	errorEffector    *Effector
	getErrorEffector sync.Once

	warnEffector    *Effector
	getWarnEffector sync.Once

	infoEffector    *Effector
	getInfoEffector sync.Once

	noticeEffector    *Effector
	getNoticeEffector sync.Once
)

func Error(message string) string {
	getErrorEffector.Do(func() {
		errorEffector = NewEffector()
		errorEffector.SetFGColor(Red)
		errorEffector.SetEffect(Bold)
	})
	return errorEffector.Render(message)
}

func Warn(message string) string {
	getWarnEffector.Do(func() {
		warnEffector = NewEffector()
		warnEffector.SetFGColor(Yellow)
		warnEffector.SetEffect(Bold)
	})
	return warnEffector.Render(message)
}

func Notice(message string) string {
	getNoticeEffector.Do(func() {
		noticeEffector = NewEffector()
		noticeEffector.SetFGColor(Green)
	})
	return noticeEffector.Render(message)
}

func Info(message string) string {
	getInfoEffector.Do(func() {
		infoEffector = NewEffector()
	})
	return infoEffector.Render(message)
}
