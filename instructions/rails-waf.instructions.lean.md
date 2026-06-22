---
description: "Ruby on Rails standards — MVC conventions, Active Record, migrations, and RuboCop enforcement."
applyTo: "**/*.rb, **/Gemfile"
waf:
  - "reliability"
  - "operational-excellence"
---

# Ruby on Rails — FAI Standards

## Convention Over Configuration
- Follow Rails defaults: file naming matches class names via Zeitwerk autoloading
- `app/models/user_profile.rb` → `UserProfile`, `app/services/payments/charge_service.rb` → `Payments::ChargeService`
- Never override `autoload_paths` unless adding non-standard directories — Zeitwerk handles `app/` subdirectories automatically
- Use `config/initializers/` for boot-time setup, `config/credentials.yml.enc` for secrets — never ENV vars for structured secrets

## ActiveRecord Patterns
```ruby
class Order < ApplicationRecord
  # Scopes — composable, chainable, always return relations
  scope :recent, -> { where("created_at > ?", 3.days.ago) }
  scope :high_value, ->(threshold = 100) { where("total_cents >= ?", threshold * 100) }
  scope :fulfillable, -> { recent.where(status: :confirmed).where.not(shipped_at: nil) }

  # Validations — at model level, not controller
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :total_cents, numericality: { greater_than: 0 }
  validate :shipping_address_matches_region, if: :requires_shipping?

  # Callbacks — keep thin, avoid side effects that break transactions
  before_validation :normalize_email, on: :create
  after_commit :enqueue_confirmation_email, on: :create
  # NEVER use after_save for external calls — runs inside transaction, blocks DB connection

  # Associations with counter caches and dependent strategies
  belongs_to :customer, counter_cache: true
  has_many :line_items, dependent: :destroy
  has_one :invoice, dependent: :nullify
end
```

### N+1 Prevention
```ruby
# BAD — fires N+1 queries
Order.all.each { |o| puts o.customer.name }

# GOOD — eager load with includes (LEFT OUTER JOIN or separate query)
Order.includes(:customer, :line_items).where(status: :pending)

# GOOD — preload for guaranteed separate queries (better for large datasets)
Order.preload(:line_items).where(status: :shipped).find_each(batch_size: 500)

# Use Bullet gem in development to detect N+1 automatically
# Gemfile: gem "bullet", group: :development
```

## Strong Parameters
```ruby
class OrdersController < ApplicationController
  def create
    @order = current_user.orders.build(order_params)
    if @order.save
      redirect_to @order, notice: "Order placed"
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  # Whitelist explicitly — never permit all with params.permit!
  def order_params
    params.require(:order).permit(:shipping_address, :notes,
      line_items_attributes: [:product_id, :quantity, :_destroy])
  end
end
```

## Service Objects (POROs)
```ruby
# app/services/orders/charge_service.rb
class Orders::ChargeService
  def initialize(order, payment_method:)
    @order = order
    @payment_method = payment_method
  end

  def call
    return Result.failure("Already charged") if @order.charged?

    charge = PaymentGateway.charge(@payment_method, amount: @order.total_cents)
    @order.update!(payment_id: charge.id, status: :paid)
    Result.success(@order)
  rescue PaymentGateway::DeclinedError => e
    Result.failure(e.message)
  end
end

# Usage: result = Orders::ChargeService.new(order, payment_method: token).call
```

## Concerns for Shared Behavior
```ruby
# app/models/concerns/sluggable.rb
module Sluggable
  extend ActiveSupport::Concern

  included do
    before_validation :generate_slug, on: :create
    validates :slug, presence: true, uniqueness: true
  end

  def to_param = slug

  private

  def generate_slug
    self.slug = name&.parameterize
  end
end
```

## Turbo & Hotwire
```erb
<%# Turbo Frame — scoped partial updates without full page reload %>
<%= turbo_frame_tag dom_id(@order) do %>
  <%= render partial: "order_details", locals: { order: @order } %>
<% end %>

<%# Turbo Stream — server-push DOM mutations %>
<%# app/views/orders/create.turbo_stream.erb %>
<%= turbo_stream.prepend "orders", partial: "order", locals: { order: @order } %>
<%= turbo_stream.update "order_count", html: current_user.orders.count %>
```

## Stimulus Controllers
```javascript
// app/javascript/controllers/search_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results"]
  static values = { url: String, debounce: { type: Number, default: 300 } }

  search() {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      fetch(`${this.urlValue}?q=${this.inputTarget.value}`,
        { headers: { Accept: "text/vnd.turbo-stream.html" } })
        .then(r => r.text())
        .then(html => Turbo.renderStreamMessage(html))
    }, this.debounceValue)
  }
}
```

## Background Jobs
```ruby
# app/jobs/order_confirmation_job.rb — works with Sidekiq or GoodJob
class OrderConfirmationJob < ApplicationJob
  queue_as :default
  retry_on Net::OpenTimeout, wait: :polynomially_longer, attempts: 5
  discard_on ActiveJob::DeserializationError

  def perform(order)
    OrderMailer.confirmation(order).deliver_now
    order.update!(confirmation_sent_at: Time.current)
  end
end

# Enqueue: OrderConfirmationJob.perform_later(order)
# Schedule: OrderConfirmationJob.set(wait: 5.minutes).perform_later(order)
```

## Action Cable (WebSockets)
```ruby
# app/channels/notifications_channel.rb
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end
end

# Broadcast from anywhere: NotificationsChannel.broadcast_to(user, { type: "alert", body: msg })
```

## Testing (RSpec + FactoryBot + VCR)
```ruby
RSpec.describe Orders::ChargeService do
  let(:order) { create(:order, :with_items, total_cents: 5000) }

  it "charges and updates status" do
    VCR.use_cassette("payment_success") do
      result = described_class.new(order, payment_method: "tok_visa").call
      expect(result).to be_success
      expect(order.reload.status).to eq("paid")
    end
  end

  it "returns failure on declined card" do
    VCR.use_cassette("payment_declined") do
      result = described_class.new(order, payment_method: "tok_declined").call
      expect(result).to be_failure
      expect(result.error).to include("declined")
    end
  end
end
```

## Credentials & Secrets
```ruby
# Edit: EDITOR=vim rails credentials:edit --environment production
# Access: Rails.application.credentials.dig(:stripe, :secret_key)
# NEVER store secrets in ENV for structured config — credentials.yml.enc is encrypted at rest
# Rotate master key via Rails.application.credentials.config[:key_path]
```

## Database Migrations
```ruby
class AddIndexToOrdersEmail < ActiveRecord::Migration[7.2]
  disable_ddl_transaction! # Required for concurrent index creation

  def change
    add_index :orders, :email, algorithm: :concurrently
  end
end

# Use strong_migrations gem to catch unsafe operations:
# - Adding columns with default values on large tables (use add_column + backfill)
# - Removing columns still referenced by running code (use ignored_columns first)
# - Renaming tables/columns (deploy new name, backfill, drop old in next release)
```

## API Mode (Serializers)
```ruby
# config/routes.rb: namespace :api { namespace :v1 { resources :orders, only: [:index, :show] } }
class Api::V1::OrdersController < ApplicationController
  def index
    orders = current_user.orders.includes(:line_items).page(params[:page]).per(25)
    render json: OrderSerializer.new(orders, include: [:line_items]).serializable_hash
  end
end

# app/serializers/order_serializer.rb (jsonapi-serializer gem)
class OrderSerializer
  include JSONAPI::Serializer
  attributes :status, :total_cents, :created_at
  has_many :line_items
end
```

## Anti-Patterns
- ❌ `params.permit!` — mass-assignment vulnerability, always whitelist explicitly
- ❌ Business logic in controllers — extract to service objects or model methods
- ❌ `after_save` callbacks calling external APIs — blocks transaction, use `after_commit` + jobs
- ❌ `default_scope` — silently modifies all queries, impossible to remove; use named scopes
- ❌ Raw SQL without parameterization — `where("name = '#{name}'"`) is SQL injection; use `where(name:)`
- ❌ Fat callbacks chains — hard to debug, test, and reason about order; prefer explicit service calls
- ❌ Skipping `db:migrate:status` checks before deploy — orphaned migrations cause silent failures
- ❌ `sleep` in tests — use `have_enqueued_job` matchers or `perform_enqueued_jobs` block

## WAF Alignment

| Pillar | Rails Practice |
|---|---|
| **Reliability** | `retry_on` with backoff in ActiveJob, circuit breakers via `circuitbox` gem, health checks at `/up`, graceful Puma shutdown on SIGTERM |
| **Security** | Strong parameters, `credentials.yml.enc`, CSRF protection (enabled by default), `rack-attack` for rate limiting, `brakeman` static analysis in CI |
| **Cost Optimization** | Fragment caching (`cache @order`), Russian doll caching, counter caches to avoid COUNT queries, `find_each` for batch processing to limit memory |
| **Operational Excellence** | `lograge` for structured JSON logs, `rails_semantic_logger` for correlation IDs, database-backed job queues (GoodJob), `annotate` gem for schema docs |
| **Performance** | Turbo Streams for zero-JS updates, `includes`/`preload` for eager loading, connection pooling via `database.yml` pool size, `rack-mini-profiler` in dev |
| **Responsible AI** | Input sanitization on all user-facing AI prompts, audit logging for AI-generated content, content moderation before rendering LLM output |
