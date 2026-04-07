## ADDED Requirements

### Requirement: OIDC authentication toggle
The web package SHALL support OIDC authentication that is enabled or disabled via environment variables. When `SUMMIT_AUTH_ENABLED` is not set or is `false`, no authentication SHALL be enforced.

#### Scenario: Auth disabled (default)
- **WHEN** `SUMMIT_AUTH_ENABLED` is unset or `false`
- **THEN** all API routes and pages are accessible without authentication

#### Scenario: Auth enabled with valid token
- **WHEN** `SUMMIT_AUTH_ENABLED` is `true` and a request includes a valid OIDC token
- **THEN** the request proceeds to the route handler with user identity available

#### Scenario: Auth enabled with missing or invalid token
- **WHEN** `SUMMIT_AUTH_ENABLED` is `true` and a request has no token or an invalid token
- **THEN** the server responds with 401 Unauthorized for API routes or redirects to login for page routes

### Requirement: OIDC configuration via environment
The web package SHALL read OIDC configuration from environment variables: `SUMMIT_OIDC_ISSUER`, `SUMMIT_OIDC_CLIENT_ID`, and `SUMMIT_OIDC_CLIENT_SECRET`.

#### Scenario: Valid OIDC configuration
- **WHEN** `SUMMIT_AUTH_ENABLED` is `true` and all OIDC env vars are set
- **THEN** the auth middleware initializes with the configured OIDC provider

#### Scenario: Missing OIDC configuration
- **WHEN** `SUMMIT_AUTH_ENABLED` is `true` but required OIDC env vars are missing
- **THEN** the server fails to start with a clear error message listing the missing variables
