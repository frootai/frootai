---
description: "Scala coding standards — immutability, val over var, pattern matching, and functional programming patterns."
applyTo: "**/*.scala"
waf:
  - "reliability"
  - "performance-efficiency"
---

# Scala — FAI Standards

## Scala 3 Syntax

Prefer Scala 3 style. Use `given`/`using` over implicit defs, `enum` over sealed trait hierarchies, extension methods over implicit classes.

```scala
// given/using replaces implicit val/def
trait JsonCodec[A]:
  def encode(a: A): String
  def decode(s: String): Either[String, A]

given JsonCodec[UserId] with
  def encode(id: UserId): String = id.value.toString
  def decode(s: String): Either[String, UserId] =
    s.toLongOption.map(UserId(_)).toRight(s"Invalid UserId: $s")

def serialize[A](a: A)(using codec: JsonCodec[A]): String = codec.encode(a)

// Opaque types — zero-cost wrappers
opaque type UserId = Long
object UserId:
  def apply(v: Long): UserId = v
  extension (id: UserId) def value: Long = id

type ApiError = NotFound | RateLimited | Unauthorized  // Union types

extension (s: String)  // Extension methods
  def toSlug: String = s.toLowerCase.replaceAll("[^a-z0-9]+", "-").stripSuffix("-")

enum Priority:  // Enum with methods
  case Low, Medium, High, Critical
  def weight: Int = this match
    case Low => 1; case Medium => 5; case High => 10; case Critical => 100
```

## Domain Modeling & Pattern Matching

Case classes for all domain objects. ADTs over stringly-typed fields. Validate at construction boundaries. Exhaustive matches — no `_` catch-all on sealed types unless intentional.

```scala
final case class Ticket(id: TicketId, title: String, priority: Priority, tags: Set[String])

object Ticket:
  def create(title: String, priority: Priority): Either[String, Ticket] =
    if title.isBlank then Left("Title must not be blank")
    else Right(Ticket(TicketId(java.util.UUID.randomUUID), title.trim, priority, Set.empty))

def handleResult(result: Either[ApiError, Ticket]): String = result match
  case Right(t) if t.priority == Priority.Critical => s"URGENT: ${t.title}"
  case Right(t)                                    => t.title
  case Left(_: NotFound)                           => "Resource not found"
  case Left(_: RateLimited)                        => "Too many requests"
  case Left(_: Unauthorized)                       => "Access denied"
```

## Error Handling — Option / Either / Try

Never use `null`. Never throw exceptions for control flow. `Option` for absence, `Either` for expected failures, `Try` only at JVM boundaries — convert immediately.

```scala
def parseConfig(raw: String): Either[ConfigError, AppConfig] =
  for
    json   <- io.circe.parser.parse(raw).left.map(e => ConfigError.ParseFailed(e.message))
    config <- json.as[AppConfig].left.map(e => ConfigError.Missing(e.message))
  yield config

val port: Either[String, Int] = Try(sys.env("PORT").toInt).toEither.left.map(_.getMessage)
```

## Effect Systems — Cats Effect / ZIO

Cats Effect `IO` as default. `Resource` for lifecycle management. ZIO acceptable when already adopted.

```scala
import cats.effect.{IO, Resource}
import org.http4s.ember.server.EmberServerBuilder

val server: Resource[IO, Server] =
  EmberServerBuilder.default[IO]
    .withHost(host"0.0.0.0").withPort(port"8080")
    .withHttpApp(routes.orNotFound).build

object Main extends cats.effect.IOApp.Simple:
  def run: IO[Unit] = server.useForever  // Resource drains connections on shutdown
```

## Actors — Pekko

Use Apache Pekko (Apache-licensed Akka fork) for new projects. Typed actors only.

```scala
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.actor.typed.{ActorRef, Behavior}

object TicketProcessor:
  sealed trait Command
  case class Process(ticket: Ticket, replyTo: ActorRef[Result]) extends Command
  def apply(): Behavior[Command] = Behaviors.receive { (ctx, msg) => msg match
    case Process(ticket, replyTo) => replyTo ! Result.Success(ticket.id); Behaviors.same
  }
```

## Collections, JSON & Type Classes

Immutable by default. `Vector` for indexed, `List` for prepend, `LazyList` for streaming. Avoid `mutable._` unless profiling demands it. circe with `derives` for JSON. Type classes via `given`.

```scala
val active = tickets.filter(_.priority.weight >= 5).sortBy(_.title)
val batched = LazyList.from(items).grouped(100).map(processBatch)
final case class ApiResponse(status: String, data: List[Ticket]) derives Codec.AsObject

trait Show[A]:
  extension (a: A) def show: String
given Show[Ticket] with
  extension (t: Ticket) def show: String = s"[${t.priority}] ${t.title}"
```

## Build, Testing & Tooling

- **sbt**: Lock `scalaVersion := "3.5.2"`, enable `-Wunused:all -Werror` in CI, sbt-native-packager for Docker
- **Testing**: ScalaTest for BDD, MUnit for lightweight, ScalaCheck for property-based, `munit-cats-effect` for IO tests, 80%+ coverage via sbt-scoverage
- **Metals**: LSP with scalafmt format-on-save + scalafix linting, `.scalafmt.conf` in repo root

## Anti-Patterns

- ❌ `var` — use `val` and immutable structures
- ❌ `null` — use `Option`; throwing exceptions for control flow — use `Either`/`IO.raiseError`
- ❌ Scala 2 `implicit` in new Scala 3 code — use `given`/`using`; implicit conversions — use extensions
- ❌ Blocking inside `IO`/`Future` without `IO.blocking`; `Any`/`AnyRef` as param/return types
- ❌ Non-exhaustive matches on sealed types

## WAF Alignment

| Pillar | Scala Practice |
|---|---|
| **Reliability** | `Resource` lifecycle, typed errors via `Either`/`IO`, `cats-retry` circuit breakers, exhaustive matching, actor supervision |
| **Security** | Opaque types prevent ID misuse, smart constructors validate at boundary, no `null`/exception leaks, secrets via env/vault |
| **Performance** | `LazyList` streaming, non-blocking IO fibers, Pekko actors, `Vector` indexed access, `-Wunused` dead code elimination |
| **Cost** | Lightweight fibers over OS threads, grouped batch streams, `Resource` connection pooling, right-sized dispatchers |
| **Ops Excellence** | scalafmt + scalafix in CI, log4cats structured logging, sbt-native-packager containers, Metals LSP |
| **Responsible AI** | Typed domain models prevent misclassification, validated inputs at boundary, auditable ADT decision pipelines |
