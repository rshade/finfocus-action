# Data Model: Cost Optimization Recommendations

**Date**: 2026-01-12

## Entities

### Cost Recommendation

**Purpose**: Represents an individual optimization suggestion from finfocus.

**Fields**:

- `resource_id`: string (required) - URN of the Pulumi resource
- `action_type`: enum (required) - Type of recommendation (RIGHTSIZING, MIGRATE, etc.)
- `description`: string (required) - Human-readable suggestion
- `estimated_savings`: number (required) - Monthly savings amount
- `currency`: string (required) - Currency code (e.g., "USD")

**Validation Rules**:

- `resource_id` must be valid URN format
- `estimated_savings` must be >= 0
- `currency` must be valid ISO 4217 code
- `description` length <= 500 characters

**Relationships**: None (standalone entity)

### Recommendations Summary

**Purpose**: Aggregates summary data for all recommendations.

**Fields**:

- `total_count`: number (required) - Total number of recommendations
- `total_savings`: number (required) - Sum of all estimated savings
- `currency`: string (required) - Currency code

**Validation Rules**:

- `total_count` >= 0
- `total_savings` >= 0
- `currency` matches individual recommendations

**Relationships**: Contains multiple Cost Recommendation entities
