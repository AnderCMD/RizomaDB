<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Using RizomaDB with the keyboard

RizomaDB is designed to be used without a mouse. If you find something that needs one, that is a bug: please report it.

## Moving around
- **Tab / Shift+Tab** move between controls in every screen (New connection, Settings, History, the guide, the results grid, the table designer, the ER diagram and the plan viewer). Each screen is a single group of tab stops; in a 40-press Tab test on the History screen the focus never got stuck.
- A visible ring always shows where you are. Buttons that only have an icon have a name read by screen readers and a tooltip that also appears when the button gets keyboard focus.
- In lists that behave like a tree (the execution plan, the explorer) Tab enters the list once and the **arrow keys** move inside it.

## In the editor
| Keys | What it does |
|---|---|
| Ctrl/⌘ + Enter | Run the statement at the cursor |
| Ctrl/⌘ + Shift + Enter | Run the selection |

## In the results grid
The keys for moving between cells, selecting rows, editing, undoing and copying are listed in [The results grid](results-grid.md). The keyboard button in the grid toolbar shows them inside the application.

## How this was checked
- An automated audit (`test/a11y/keyboard.js`) runs on every screen in the light and dark themes: every control that can take focus has a name and a visible focus ring, there is no positive `tabindex`, and nothing that looks clickable is outside the tab order. It found one real problem (the search boxes had only a 1 px border change on focus), now fixed. axe-core reports no violations on the same screens.
- The project owner walked through the screens with a screen reader on macOS, Windows and Linux and found no problems.
- Not done: an independent accessibility audit. If something is hard to reach by keyboard, please open an issue.
