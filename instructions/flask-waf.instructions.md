---
description: "Flask standards — blueprints, app factory, SQLAlchemy, and production configuration patterns."
applyTo: "**/*.py"
waf:
  - "security"
  - "reliability"
---

# Flask — FAI Standards

> Blueprints, application factory, SQLAlchemy ORM, migration workflows, and production-grade deployment patterns.

## Core Rules

- Always use the **application factory pattern** (`create_app`) — never module-level `app = Flask(__name__)`
- Organize routes with **Blueprints** — one blueprint per domain (auth, api, admin)
- Configuration via `app.config.from_object()` + `app.config.from_envvar()` — never hardcode secrets
- Type hints on all view functions, service functions, and CLI commands
- snake_case for functions/variables, PascalCase for classes, kebab-case for file/folder names
- Structured JSON logging via `python-json-logger` — never `print()` in production
- `flask.g` for request-scoped state, `current_app` for app-scoped config access

## Application Factory

```python
def create_app(config_class="config.ProductionConfig"):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config.from_envvar("FLASK_SETTINGS", silent=True)

    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    cors.init_app(app, origins=app.config["CORS_ORIGINS"])
    login_manager.init_app(app)

    from .api import bp as api_bp
    from .auth import bp as auth_bp
    app.register_blueprint(api_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/auth")

    app.register_error_handler(404, handle_not_found)
    app.register_error_handler(422, handle_validation_error)
    app.register_error_handler(500, handle_internal_error)

    return app
```

## Configuration Management

```python
import os

class BaseConfig:
    SECRET_KEY = os.environ["SECRET_KEY"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CSRF_ENABLED = True
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

class ProductionConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
```

## Blueprints & Error Handlers

```python
from flask import Blueprint, jsonify, request

bp = Blueprint("api", __name__)

@bp.before_request
def set_correlation_id():
    from flask import g
    g.correlation_id = request.headers.get("X-Correlation-ID", uuid4().hex)

@bp.errorhandler(422)
def handle_validation_error(exc):
    return jsonify(error="Validation failed", details=str(exc)), 422

@bp.route("/items", methods=["POST"])
def create_item():
    data = request.get_json(force=False, silent=False)
    if not data or "name" not in data:
        abort(422, description="Missing required field: name")
    item = ItemService.create(data)
    return jsonify(item.to_dict()), 201
```

## Database & Migrations

- Use `Flask-SQLAlchemy` with `db.init_app(app)` — never bind globally
- Run migrations with `Flask-Migrate`: `flask db migrate -m "add users"`, `flask db upgrade`
- Always set `SQLALCHEMY_ENGINE_OPTIONS` for connection pooling: `pool_size=10, pool_recycle=300`
- Use `db.session.execute(select(Model).filter_by(...))` — avoid legacy `Model.query`

## Authentication & Security

- **Flask-Login** for session auth, **Flask-JWT-Extended** for API token auth
- CSRF protection via `Flask-WTF` `CSRFProtect` — exempt API blueprints with `csrf.exempt(api_bp)`
- `Flask-CORS` with explicit `origins` list — never `origins="*"` in production
- `Flask-Limiter` for rate limiting: `limiter = Limiter(key_func=get_remote_address)`
- Set `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE="Lax"`

## Background Tasks

```python
from celery import Celery

def make_celery(app):
    celery = Celery(app.import_name, broker=app.config["CELERY_BROKER_URL"])
    celery.conf.update(app.config)
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    celery.Task = ContextTask
    return celery
```

## Testing

```python
import pytest
from myapp import create_app, db

@pytest.fixture
def app():
    app = create_app("config.TestingConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_create_item(client):
    resp = client.post("/api/v1/items", json={"name": "Widget"})
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "Widget"
```

## Deployment

- **Production WSGI**: `gunicorn -w 4 -b 0.0.0.0:8000 "myapp:create_app()"` (Linux/container)
- **Windows WSGI**: `waitress-serve --port=8000 --call myapp:create_app`
- Never use `app.run(debug=True)` in production — debug mode exposes interactive debugger
- Health check: dedicated `/health` route returning DB + dependency status

## CLI Commands

```python
@bp.cli.command("seed-db")
@click.argument("count", default=10)
def seed_db(count):
    """Seed the database with sample records."""
    for _ in range(count):
        db.session.add(Item(name=f"item-{uuid4().hex[:8]}"))
    db.session.commit()
    click.echo(f"Seeded {count} items.")
```

## Preferred Patterns

- ✅ Application factory with `create_app()` returning configured `Flask` instance
- ✅ Blueprints for route grouping — one per domain module
- ✅ `app.config.from_object()` + `from_envvar()` layered configuration
- ✅ `db.init_app(app)` lazy initialization for all extensions
- ✅ `Flask-Migrate` for all schema changes — never raw `CREATE TABLE`
- ✅ `app.test_client()` + pytest fixtures for isolated integration tests
- ✅ `gunicorn` with `--preload` and worker count `2 * CPU + 1`

## Anti-Patterns

- ❌ Module-level `app = Flask(__name__)` — breaks testing, prevents multiple configs
- ❌ Circular imports between blueprints — use `current_app` and deferred imports
- ❌ `db.create_all()` in production — use `Flask-Migrate` exclusively
- ❌ `app.run(debug=True)` in deployed environments — exposes Werkzeug debugger (RCE risk)
- ❌ Storing secrets in `config.py` committed to git — use envvars or Key Vault
- ❌ `CORS(app, origins="*")` — allows any origin to call your API
- ❌ Accessing `request` or `g` outside request context — raises `RuntimeError`
- ❌ Long-running tasks in view functions — offload to Celery/RQ

## WAF Alignment

| Pillar | Flask Practice |
|--------|---------------|
| **Security** | Flask-WTF CSRF, Flask-Login sessions, Flask-JWT-Extended tokens, SECRET_KEY from envvar, secure cookie flags, Flask-Limiter rate limiting |
| **Reliability** | App factory enables per-test isolation, SQLAlchemy connection pool recycling, health check endpoint, Celery retry with backoff |
| **Cost Optimization** | gunicorn worker tuning (2×CPU+1), connection pooling via `SQLALCHEMY_ENGINE_OPTIONS`, Redis caching with Flask-Caching |
| **Operational Excellence** | Flask-Migrate for versioned migrations, Click CLI commands, structured JSON logging, `flask routes` for route audit |
| **Performance** | Streaming responses via `Response(generator)`, async views (Flask 2.0+), Redis-backed sessions, CDN for static assets |
| **Responsible AI** | Input validation at blueprint boundaries, PII redaction before logging, Content Safety integration for LLM outputs |
