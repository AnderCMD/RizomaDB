<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Language and settings

## The settings screen
**RizomaDB: Open Settings** (the gear in the connections view) shows every setting as a card with a reset button per card, a search box and **Reset all**. Changes are saved to your user settings as you make them. The full list with defaults is in the [Settings reference](../reference/settings.md); the interesting groups are:

| Group | What you can change |
|---|---|
| Language | The language of the extension (see below) |
| Results | Where results open (lower half, whole area, beside) |
| Environments | Extra environments and their protection |
| Queries | Rows per page, maximum rows, timeout |
| Query editor | Run lenses and statement highlight |
| Editing | Save each edit immediately |
| Connections tree | Group connections by engine type |
| Security | Confirmations, production read-only |
| History, Audit, MCP, AI | Retention and what is recorded, the opt-in read-only MCP server, the opt-in AI assistant |

## Language
RizomaDB speaks **English and Spanish**. By default it follows VS Code's display language. To change only the extension, set `rizomadb.language` to `en` or `es`; screens you already have open keep the old language until you reopen them.

Command names, setting names and view titles are provided to VS Code through its own mechanism, so they always follow **VS Code's** language. The settings screen has a button that opens VS Code's language picker. Messages from a database server (for example a syntax error) are shown as the server wrote them; the messages RizomaDB writes itself are translated. Wording corrections to the Spanish text are welcome.

## The guide
**RizomaDB: Open the Guide** opens a step-by-step tour with buttons that do each step for you. It also appears once, the first time the extension runs. There is a matching *Get started* walkthrough in VS Code's Welcome page.
