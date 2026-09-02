# 2. PostgreSQL as the only event store

**Status:** accepted

## Context

Event analytics at scale usually means a columnar store such as ClickHouse.
The specification asks for an `EventStore` abstraction with both.

## Decision

Implement PostgreSQL only. Do not ship a ClickHouse adapter until it is
exercised by real load.

## Consequences

One dependency, one set of migrations, and every query provable against the
same database the tests use. A second storage implementation that nobody runs
would be untested code shaping the design of code that is.

The schema already carries daily rollup tables, which is the correct first
optimisation. If those stop being enough, the query layer is the seam where a
columnar adapter goes in.
