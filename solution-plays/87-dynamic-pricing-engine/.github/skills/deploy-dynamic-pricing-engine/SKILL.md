---
name: "deploy-dynamic-pricing-engine"
description: "Deploy Dynamic Pricing Engine — demand-based price optimization, competitor monitoring, elasticity modeling, A/B testing, fairness-constrained pricing."
---

# Deploy Dynamic Pricing Engine

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Transaction history (product, price, quantity, timestamp — ≥6 months)
- Python 3.11+ with `azure-openai`, `scikit-learn`, `scipy` (optimization)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-dynamic-pricing \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Pricing explanations + market analysis | S0 |
| Azure ML | Elasticity model training + serving | Compute on-demand |
| Azure Data Explorer | Transaction time-series + demand signals | Dev(No SLA) |
| Event Hubs | Real-time sales event streaming | Standard |
| Cosmos DB | Price recommendations, A/B test results, audit log | Serverless |
| Azure Functions | Price calculation engine (event-driven) | Consumption |
| Container Apps | Pricing API + dashboard | Consumption |
| Azure Key Vault | API keys + competitor API credentials | Standard |

## Step 2: Train Elasticity Model

```python
from sklearn.ensemble import GradientBoostingRegressor

# Price elasticity of demand
# elasticity = % change in quantity / % change in price
# elasticity < -1: elastic (price sensitive)
# elasticity > -1: inelastic (brand loyal)

ELASTICITY_FEATURES = [
    "product_category", "brand_strength",      # Product attributes
    "day_of_week", "month", "is_holiday",      # Temporal
    "competitor_price_ratio",                    # Competitive
    "inventory_days_of_supply",                  # Supply pressure
    "search_interest_index",                     # Demand signal
    "promotion_active",                          # Marketing context
    "price_history_30d_avg"                       # Price memory
]

# Train model on historical price-quantity relationships
model = GradientBoostingRegressor(n_estimators=200, max_depth=6)
model.fit(X_train[ELASTICITY_FEATURES], y_train["quantity_change_pct"])

# Note: ML model predicts quantity sensitivity, not the price directly
# Price optimization uses elasticity as input to constrained optimization
```

## Step 3: Deploy Price Optimization Engine

```python
from scipy.optimize import minimize_scalar

def optimize_price(
    current_price: float,
    elasticity: float,
    cost: float,
    competitor_prices: list[float],
    inventory_days: float,
    objective: str = "revenue"
) -> float:
    """Constrained price optimization."""
    
    # Constraints
    min_margin = 0.15  # Never below 15% margin
    max_daily_change = 0.10  # Max ±10% per day
    min_price = cost / (1 - min_margin)
    max_price = current_price * (1 + max_daily_change)
    min_price_change = current_price * (1 - max_daily_change)
    
    # Competitor context
    competitor_ceiling = max(competitor_prices) * 1.05  # Don't exceed competitors by >5%
    competitor_floor = min(competitor_prices) * 0.90    # Don't undercut by >10%
    
    # Inventory pressure
    if inventory_days < 7:  # Low stock — price up
        min_price = max(min_price, current_price)
    elif inventory_days > 90:  # Overstock — allow deeper discounts
        max_daily_change = 0.15
    
    # Optimization objective
    def revenue_fn(price):
        demand = predict_demand(price, elasticity, current_price)
        return -(price * demand)  # Negative because we minimize
    
    def margin_fn(price):
        demand = predict_demand(price, elasticity, current_price)
        return -((price - cost) * demand)
    
    fn = revenue_fn if objective == "revenue" else margin_fn
    
    result = minimize_scalar(fn,
        bounds=(max(min_price, min_price_change, competitor_floor),
                min(max_price, competitor_ceiling)),
        method="bounded"
    )
    return round(result.x, 2)
```

## Step 4: Deploy Competitor Price Monitor

```python
COMPETITOR_SOURCES = {
    "api_feeds": {
        "description": "Direct API from price comparison services",
        "refresh_interval_min": 60,
        "providers": ["priceapi", "keepa", "custom_scraper"]
    },
    "marketplace_apis": {
        "description": "Official marketplace APIs (where available)",
        "supported": ["amazon_sp_api", "ebay_finding_api"]
    }
}

async def monitor_competitors(product_id: str) -> list[CompetitorPrice]:
    """Get current competitor prices for a product."""
    prices = []
    for source in COMPETITOR_SOURCES:
        source_prices = await fetch_competitor_prices(source, product_id)
        prices.extend(source_prices)
    
    # Deduplicate and validate
    validated = [p for p in prices if p.confidence > 0.8 and p.age_hours < 24]
    
    return CompetitorAnalysis(
        prices=validated,
        market_position=classify_position(product.price, validated),  # "premium", "competitive", "budget"
        competitor_range=(min(p.price for p in validated), max(p.price for p in validated))
    )
```

## Step 5: Deploy A/B Testing Framework

```python
class PriceABTest:
    """A/B test price points to measure actual conversion + revenue impact."""
    
    def __init__(self, product_id: str, variant_prices: list[float], traffic_split: list[float]):
        self.test_id = generate_test_id()
        self.product_id = product_id
        self.variants = [{"price": p, "traffic": t} for p, t in zip(variant_prices, traffic_split)]
        self.metrics = ["conversion_rate", "revenue_per_visitor", "margin_per_unit", "cart_abandonment"]
    
    async def assign_variant(self, session_id: str) -> float:
        """Assign user to price variant (deterministic by session hash)."""
        variant_idx = hash(session_id + self.test_id) % len(self.variants)
        return self.variants[variant_idx]["price"]
    
    async def evaluate(self, min_samples: int = 1000) -> ABTestResult:
        """Evaluate test results with statistical significance."""
        results = await get_test_metrics(self.test_id)
        if results.total_samples < min_samples:
            return ABTestResult(status="insufficient_data", required=min_samples)
        
        # Chi-square test for conversion, t-test for revenue
        winner = statistical_test(results, confidence=0.95)
        return ABTestResult(status="conclusive", winner=winner, lift=winner.lift_pct)
```

## Step 6: Deploy Fairness & Compliance Engine

```python
PRICING_FAIRNESS_RULES = {
    "no_demographic_discrimination": {
        "description": "Same price for same product regardless of user demographics",
        "enforcement": "Price determined by product + market only, never by user profile",
        "audit": "Monthly statistical test: price distribution by demographic group"
    },
    "surge_pricing_cap": {
        "max_multiplier": 2.0,
        "notice_required": True,
        "notice_text": "Prices are currently elevated due to high demand.",
        "cooldown_hours": 4
    },
    "price_memory": {
        "description": "Customers see the same price within a session",
        "session_duration_min": 30,
        "no_cookie_based_pricing": True
    },
    "regulatory": {
        "no_price_gouging": {"max_increase_pct": 50, "trigger": "emergency_declaration"},
        "display_unit_price": True,
        "tax_inclusive_display": "jurisdiction_dependent"
    }
}
```

## Step 7: Smoke Test

```bash
# Get price recommendation
curl -s https://api-pricing.azurewebsites.net/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"product_id": "SKU-001", "objective": "revenue"}' | jq '.recommended_price, .factors'

# Check competitor prices
curl -s https://api-pricing.azurewebsites.net/api/competitors \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"product_id": "SKU-001"}' | jq '.market_position, .competitor_range'

# Start A/B test
curl -s https://api-pricing.azurewebsites.net/api/ab-test/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"product_id": "SKU-001", "variant_prices": [29.99, 34.99], "traffic_split": [0.5, 0.5]}' | jq '.test_id'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Elasticity model predicts wrong direction | Insufficient price variation in training data | Ensure training data has varied prices (run A/B tests) |
| Price oscillating daily | Max change too high + feedback loop | Reduce max_daily_change to 5%, add dampening |
| Competitor data stale | API refresh too slow | Reduce refresh interval, add multiple sources |
| A/B test inconclusive | Not enough traffic | Increase sample size or run longer |
| Margin below target | Competitor floor too aggressive | Hard floor at cost + 15% margin, override competitor |
