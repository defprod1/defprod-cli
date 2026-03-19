# DefProd CLI

Command-line interface for [DefProd](https://defprod.one) product definitions.

## Installation

```bash
npm install -g @defprod/cli
```

Then run:

```bash
defprod
```

### Building from Source

```bash
git clone https://github.com/defprod1/defprod-cli.git
cd defprod-cli
npm install
npm run build
node dist/main.js
```

## Configuration

The CLI stores configuration in `~/.config/defprod/cli.json`. Run `defprod` for the first time to launch the init wizard, or create the file manually:

```json
{
    "aiProvider": "gemini",
    "aiProviderApiKey": "your-ai-api-key",
    "aiModel": "gemini-2.0-flash",
    "defprodApiKey": "your-defprod-api-key",
    "defprodApiUrl": "https://api.defprod.one/api/v1",
    "currentProduct": "your-product-id",
    "strictMode": false
}
```

| Field              | Description                                                                  | Default                          |
|--------------------|------------------------------------------------------------------------------|----------------------------------|
| `aiProvider`       | LLM provider: `openai`, `anthropic`, `gemini`, or `perplexity`               | `gemini`                         |
| `aiProviderApiKey` | API key for your chosen AI provider                                          | —                                |
| `aiModel`          | Model name (e.g. `gpt-4o`, `claude-3-5-sonnet-20241022`, `gemini-2.0-flash`) | Provider-specific                |
| `defprodApiKey`    | Your DefProd API key                                                         | —                                |
| `defprodApiUrl`    | DefProd API base URL                                                         | `https://api.defprod.one/api/v1` |
| `currentProduct`   | Default product ID to use                                                    | —                                |
| `strictMode`       | Disable fuzzy matching                                                       | `false`                          |

All fields are optional. You can also use environment variables:

- `DEFPROD_CLI_CONFIG` - Override config file path
- `DEFPROD_AI_PROVIDER` - AI provider
- `DEFPROD_AI_API_KEY` - AI provider API key
- `DEFPROD_AI_MODEL` - AI model name
- `DEFPROD_API_KEY` - DefProd API key
- `DEFPROD_API_URL` - DefProd API URL
- `DEFPROD_CURRENT_PRODUCT` - Current product ID
- `DEFPROD_STRICT_MODE` - Enable strict mode (true/false)

Environment variables override config file values.

## Usage

### Interactive REPL Mode

Start the CLI without arguments to enter REPL mode:

```bash
$ defprod
DefProd CLI Agent
>
```

### One-shot Mode

Execute commands directly:

```bash
$ defprod /list stories
$ defprod "Create a user story for login with 2FA"
```

## Commands

### Product Management

- `/product list` - List all available products
- `/product set <id|name>` - Set current product
- `/product current` - Show currently selected product
- `/product unset` - Clear current product

### Listing Entities

- `/list stories` - List user stories
- `/list areas` - List areas
- `/list architecture` - List architecture
- `/list components` - List components
- `/list users` - List users

Options:
- `--filter <query>` - Filter results by keyword
- `--json` - Output in JSON format

### Viewing Entities

- `/view product` - View current product
- `/view story <id|name|query>` - View a user story
- `/view area <id|name|query>` - View an area
- `/view architecture` - View architecture

Options:
- `--json` - Output in JSON format
- `--strict` - Use strict matching (no fuzzy search)

### Searching

- `/search "<query>"` - Search across all entities

Options:
- `--json` - Output in JSON format
- `--strict` - Use strict keyword matching

### Configuration

- `/config show` - Display current configuration
- `/config set <key> <value>` - Set a configuration value
- `/config unset <key>` - Remove a configuration value
- `/config reset` - Reset to default configuration

### Natural Language Commands

Commands without a `/` prefix are interpreted as natural language and processed by the LLM:

```bash
> Create a user story for passwordless login using Passkeys
> Update the acceptance criteria for USR-124
> Export the current product for API integration
```

## Examples

### Set product context

```bash
> /product list
1. DefProd
2. Democrify
> /product set defprod
Current product: DefProd (PRODUCT-1234)
```

### List entities

```bash
> /list stories
USR-42  User Login
USR-43  Password Reset
USR-44  Admin Login
> /list stories --filter login
USR-42  User Login
USR-44  Admin Login
```

### View entities

```bash
> /view story "user login"
Found 1 match:
USR-42  User Login
Title: User Login
Description: Allows a user to log in with email/password...
```

### Natural language creation

```bash
> Add a new user story for passwordless login using Passkeys
LLM Output:
Created User Story USR-45
Title: Passwordless Login
Description: ...
```

## License

MIT
