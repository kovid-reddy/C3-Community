# Configuration Architecture

## Centralized Configuration Policy

1. **No Direct `process.env` Access**:
   Modules MUST NOT scatter calls to `process.env.VARIABLE` across package source files. All configuration must be ingested and accessed strictly via the `ConfigService` interface in `@c3/foundation`.

2. **Configuration Tiers**:
   - **Application Configuration**: Default static values packaged with the application.
   - **Development Configuration**: Overrides loaded from local development config / `.env`.
   - **Runtime Configuration**: Dynamic runtime settings changed via user UI or desktop settings.
   - **Secrets**: Credentials managed in secure OS keystores (e.g. keytar / keychain), never plain text config files.

3. **Environment Security**:
   - `.env.example` contains ONLY non-sensitive placeholder variables.
   - Real API keys, tokens, or private credentials MUST NEVER be committed to source control.
