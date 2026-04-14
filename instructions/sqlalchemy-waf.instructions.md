---
description: "SQLAlchemy standards — async sessions, relationship mapping, migration with Alembic, connection pooling."
applyTo: "**/*.py"
waf:
  - "reliability"
  - "performance-efficiency"
---

# SQLAlchemy — FAI Standards

## Declarative Base & Mapped Columns (2.0 Style)

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, MappedAsDataclass
from sqlalchemy import String, ForeignKey, func
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_active: Mapped[bool] = mapped_column(default=True)

    orders: Mapped[list["Order"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    total: Mapped[float]

    user: Mapped["User"] = relationship(back_populates="orders")
```

## MappedAsDataclass

```python
class Config(MappedAsDataclass, Base):
    __tablename__ = "configs"
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    key: Mapped[str] = mapped_column(String(64), unique=True)
    value: Mapped[str] = mapped_column(String(512))
```

## Hybrid Properties

```python
from sqlalchemy.ext.hybrid import hybrid_property

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    price: Mapped[float]
    discount: Mapped[float] = mapped_column(default=0.0)

    @hybrid_property
    def final_price(self) -> float:
        return self.price * (1 - self.discount)

    @final_price.inplace.expression
    @classmethod
    def _final_price_expr(cls):
        return cls.price * (1 - cls.discount)
```

## Connection Pooling & Engine

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_engine(
    "postgresql+psycopg://user:pass@host/db",
    pool_size=10,           # steady-state connections
    max_overflow=20,        # burst above pool_size
    pool_recycle=1800,      # recycle stale connections (seconds)
    pool_pre_ping=True,     # test connection before checkout
    echo=False,             # never True in production
)

async_engine = create_async_engine(
    "postgresql+asyncpg://user:pass@host/db",
    pool_size=10, pool_recycle=1800, pool_pre_ping=True,
)
```

## Session Management

```python
from sqlalchemy.orm import Session, scoped_session, sessionmaker
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

# Sync — scoped_session for web frameworks
ScopedSession = scoped_session(sessionmaker(bind=engine))

def get_user(user_id: int) -> User | None:
    with Session(engine) as session:
        return session.get(User, user_id)

# Async session
async_session = async_sessionmaker(async_engine, expire_on_commit=False)

async def get_user_async(user_id: int) -> User | None:
    async with async_session() as session:
        return await session.get(User, user_id)
```

## Query Patterns (2.0 select() Style)

```python
from sqlalchemy import select, func, text

# Filtered query with join
stmt = (
    select(User, func.count(Order.id).label("order_count"))
    .join(Order, User.id == Order.user_id, isouter=True)
    .where(User.is_active == True)
    .group_by(User.id)
    .having(func.count(Order.id) > 0)
    .order_by(User.created_at.desc())
    .limit(50)
)

with Session(engine) as session:
    results = session.execute(stmt).all()

# Subquery
high_spenders = (
    select(Order.user_id)
    .group_by(Order.user_id)
    .having(func.sum(Order.total) > 1000)
).subquery()

stmt = select(User).where(User.id.in_(select(high_spenders.c.user_id)))

# Raw SQL when ORM is overkill
result = session.execute(text("SELECT version()")).scalar()
```

## Eager Loading

```python
from sqlalchemy.orm import joinedload, selectinload, subqueryload

# joinedload — single query via LEFT JOIN (1-to-1, small 1-to-many)
stmt = select(User).options(joinedload(User.orders)).where(User.id == 42)

# selectinload — separate IN query (large collections, avoids cartesian)
stmt = select(User).options(selectinload(User.orders))

# subqueryload — subquery for related rows
stmt = select(User).options(subqueryload(User.orders))
```

## Bulk Operations

```python
from sqlalchemy import insert, update

# Bulk insert — bypasses ORM identity map for speed
with Session(engine) as session:
    session.execute(
        insert(User),
        [{"email": f"u{i}@co.com", "name": f"User {i}"} for i in range(1000)],
    )
    session.commit()

# Bulk update
session.execute(update(User).where(User.is_active == False).values(name="[deleted]"))
```

## Events

```python
from sqlalchemy import event

@event.listens_for(Session, "before_flush")
def before_flush(session, flush_context, instances):
    for obj in session.dirty:
        if isinstance(obj, User) and "email" in session.inspect(obj).attrs.email.history.added:
            obj.email = obj.email.lower()

@event.listens_for(Session, "after_commit")
def after_commit(session):
    # Trigger async tasks, invalidate cache
    pass
```

## Alembic Migrations

```bash
alembic init migrations                  # scaffold
alembic revision --autogenerate -m "add users"  # detect model changes
alembic upgrade head                     # apply all
alembic downgrade -1                     # rollback one
alembic upgrade head --sql > migration.sql  # offline mode — generate SQL without DB
```

Set `target_metadata = Base.metadata` in `env.py`. Review every autogenerated migration — it cannot detect column renames or data migrations.

## Testing with In-Memory SQLite

```python
import pytest
from sqlalchemy import create_engine, StaticPool

@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
    Base.metadata.drop_all(engine)
```

## Anti-Patterns

- ❌ `session.query(Model)` — legacy 1.x style; use `select(Model)` everywhere
- ❌ Lazy loading inside loops (N+1) — use `selectinload` / `joinedload`
- ❌ `autocommit=True` or `expire_on_commit=True` in async — causes implicit IO
- ❌ Sharing a `Session` across threads — sessions are NOT thread-safe
- ❌ Missing `pool_pre_ping` — stale connections crash after DB restart
- ❌ `echo=True` in production — dumps full SQL to stdout
- ❌ Skipping Alembic review — autogenerate misses renames and data migrations
- ❌ `text()` with f-strings — SQL injection; always use bound parameters

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Reliability** | `pool_pre_ping=True`, connection recycling, retry on `OperationalError`, Alembic for schema versioning |
| **Performance** | Eager loading to kill N+1, bulk inserts via `insert().values()`, `pool_size` tuned to workload |
| **Security** | Bound parameters only (never f-string SQL), `ondelete="CASCADE"` for referential integrity, least-privilege DB roles |
| **Cost** | Right-size `pool_size` / `max_overflow`, avoid `SELECT *` — project only needed columns |
| **Ops Excellence** | Alembic in CI/CD, `echo=False` with structured logging, migration dry-run via `--sql` |
