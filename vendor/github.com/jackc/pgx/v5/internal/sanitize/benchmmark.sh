#!/usr/bin/env bash

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" == "HEAD" ]; then
    current_branch=$(git rev-parse HEAD)
fi

restore_branch() {
    echo "Restoring original branch/commit: $current_branch"
    git checkout "$current_branch"
}
trap restore_branch EXIT

# Check if there are uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "There are uncommitted changes. Please commit or stash them before running this script."
    exit 1
fi

# Ensure that at least one commit argument is passed
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <commit1> <commit2> ... <commitN>"
    exit 1
fi

commits=("$@")
benchmarks_dir=benchmarks

if ! mkdir -p "${benchmarks_dir}"; then
    echo "Unable to create dir for benchmarks data"
    exit 1
fi

# Benchmark results
bench_files=()

# Run benchmark for each listed commit
for i in "${!commits[@]}"; do
    commit="${commits[i]}"
    git checkout "$commit" || {
        echo "Failed to checkout $commit"
        exit 1
    }

    # Sanitized commmit message
    commit_message=$(git log -1 --pretty=format:"%s" | tr -c '[:alnum:]-_' '_')

    # Benchmark data will go there
    bench_file="${benchmarks_dir}/${i}_${commit_message}.bench"

    if ! go test -bench=. -count=10 >"$bench_file"; then
        echo "Benchmarking failed for commit $commit"
        exit 1
    fi

    bench_files+=("$bench_file")
done

# go install golang.org/x/perf/cmd/benchstat[@latest]
benchstat "${bench_files[@]}"
