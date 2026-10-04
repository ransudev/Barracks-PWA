# Restock toolbar alignment

Aligned search, status, and reset controls along the same bottom edge at 42px height. Shortened the placeholder to avoid clipping; search matching is unchanged.

Browser verification at localhost:3001 measured all three controls at top323.453px and bottom365.453px. At390px mobile width, all three controls stacked at301px width without horizontal page overflow. Production build/TypeScript passed and the layout detector returned no findings. No automated tests or restock mutations ran.

Captures: [desktop](restock-toolbar-aligned-desktop.png), [mobile](restock-toolbar-aligned-mobile.png).
