# 2.2.2 (September 10, 2024)

* Add empty acquire time to stats (Maxim Ivanov)
* Stop importing nanotime from runtime via linkname (maypok86)

# 2.2.1 (July 15, 2023)

* Fix: CreateResource cannot overflow pool. This changes documented behavior of CreateResource. Previously,
  CreateResource could create a resource even if the pool was full. This could cause the pool to overflow. While this
  was documented, it was documenting incorrect behavior. CreateResource now returns an error if the pool is full.

# 2.2.0 (February 11, 2023)

* Use Go 1.19 atomics and drop go.uber.org/atomic dependency

# 2.1.2 (November 12, 2022)

* Restore support to Go 1.18 via go.uber.org/atomic

# 2.1.1 (November 11, 2022)

* Fix create resource concurrently with Stat call race

# 2.1.0 (October 28, 2022)

* Concurrency control is now implemented with a semaphore. This simplifies some internal logic, resolves a few error conditions (including a deadlock), and improves performance. (Jan Dubsky)
* Go 1.19 is now required for the improved atomic support.

# 2.0.1 (October 28, 2022)

* Fix race condition when Close is called concurrently with multiple constructors

# 2.0.0 (September 17, 2022)

* Use generics instead of interface{} (Столяров Владимир Алексеевич)
* Add Reset
* Do not cancel resource construction when Acquire is canceled
* NewPool takes Config

# 1.3.0 (August 27, 2022)

* Acquire creates resources in background to allow creation to continue after Acquire is canceled (James Hartig)

# 1.2.1 (December 2, 2021)

* TryAcquire now does not block when background constructing resource

# 1.2.0 (November 20, 2021)

* Add TryAcquire (A. Jensen)
* Fix: remove memory leak / unintentionally pinned memory when shrinking slices (Alexander Staubo)
* Fix: Do not leave pool locked after panic from nil context

# 1.1.4 (September 11, 2021)

* Fix: Deadlock in CreateResource if pool was closed during resource acquisition (Dmitriy Matrenichev)

# 1.1.3 (December 3, 2020)

* Fix: Failed resource creation could cause concurrent Acquire to hang. (Evgeny Vanslov)

# 1.1.2 (September 26, 2020)

* Fix: Resource.Destroy no longer removes itself from the pool before its destructor has completed.
* Fix: Prevent crash when pool is closed while resource is being created.

# 1.1.1 (April 2, 2020)

* Pool.Close can be safely called multiple times
* AcquireAllIDle immediately returns nil if pool is closed
* CreateResource checks if pool is closed before taking any action
* Fix potential race condition when CreateResource and Close are called concurrently. CreateResource now checks if pool is closed before adding newly created resource to pool.

# 1.1.0 (February 5, 2020)

* Use runtime.nanotime for faster tracking of acquire time and last usage time.
* Track resource idle time to enable client health check logic. (Patrick Ellul)
* Add CreateResource to construct a new resource without acquiring it. (Patrick Ellul)
* Fix deadlock race when acquire is cancelled. (Michael Tharp)
