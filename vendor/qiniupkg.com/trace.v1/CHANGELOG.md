ChangeLog
====

## [0.1.5] - 2016-10-31
### Added
- Recorder 支持 NameOnce() 方法
- 优化 trace 日志格式，添加 TinyEvent 支持
- http client event 支持记录 req.body.send 和 resp.body.recv 两个 TinyEvent 事件
- 增加 NewServeMux 方法，支持将注册的 http Pattern 作为 span name

### Changed
- Recorder 中的 Annotations 数量上限从 128 调整到 512
- Recorder 中单个 Annotation 的长度上限从 128byte 调整到 512byte

### Fixed
- 修复 Tracer 中潜在的死锁问题

## [0.1.4] - 2016-10-13
### Changed
- 取消 ss/sr/cs/cr 字段支持，改为 span 的 Mode 字段: "a"/"c"/"s"
- 简化用户使用 API
- 更高的单元测试覆盖率

### Fixed
- 修复 trace.Recorder 在并发访问下的竞争问题
- 删除 HTTPHandler.Flush 方法
- 替换新的采样模块，采样更加准确和稳定

## [0.1.3] - 2016-10-05
### Added
- 默认使用 rollog.v1 作为日志记录组件，有效防止日志堆积
- 默认使用全局统一路径作为日志记录目录，无需业务方在使用时配置

## [0.1.2] - 2016-09-27
### Added
- 添加更加完整的单元测试
- recorder.Event() 支持 tag 中包含 "omitempty"

### Changed
- 调整默认起始采样率为 1/4096
- 时间戳统一从 ns 调整为 us
- 简化 trace 的使用姿势

### Fixed
- 修复 DummyRecorder 中 SpanID 为 nil 的 bug

## [0.1.1] - 2016-09-19
### Added
- 增加较为完整的 README.md

### Changed
- 修改底层 trace log 格式，弃用原 Appdash 的格式

### Fixed
- 修复 HTTP Request 中 Path 记录错误的问题

## [0.1.0] - 2016-09-18
### Added
- 第一个可用的 trace 版本
