# /flash stats

Show flashcard statistics and study progress with conversational commentary.

## When to activate

User says `/flash stats`, "show my stats", "how am I doing", "study progress", or similar.

## Instructions

1. **Gather data.** Run both stat commands:

   ```bash
   flash stats
   ```

   ```bash
   flash daily
   ```

2. **Present the data conversationally.** Don't just dump the table output. Interpret it:
   - Total cards across all decks
   - How many are due today
   - Retention rate and what it means
   - Which decks are most active vs. neglected

3. **Highlight key insights:**
   - If due count is high: "You have 45 cards due — about 15 minutes of review."
   - If retention is high: "87% retention on Rust Ownership — solid."
   - If a deck has many new cards: "Docker Basics has 20 new cards you haven't started yet."
   - If all caught up: "You're all caught up! Next cards are due tomorrow."

4. **Offer suggestions based on the data:**
   - High due count: "Start with [deck] — it has the most due cards."
   - Low retention on a deck: "Your [deck] retention is at 45%. Want to see your weak areas? Try `/flash weak`."
   - Neglected deck: "You haven't reviewed [deck] in 2 weeks. Want to do a quick session?"
   - Good progress: "You've mastered 80% of [deck]. Ready for harder cards? Try `flash challenge`."

5. **If the user asks for a specific deck:** Run `flash stats <deck>` and provide focused analysis of that deck.

## Conversational style

- Lead with the most actionable insight, not raw numbers.
- Keep it brief. Numbers are supporting evidence, not the main message.
- Be honest about neglected areas without being naggy.
