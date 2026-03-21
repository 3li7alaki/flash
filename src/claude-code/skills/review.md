# /flash review [deck]

Review flashcards conversationally. Shows cards one at a time, accepts natural language answers, grades them, and tracks progress.

## When to activate

User says `/flash review`, "review my flashcards", "study time", "let's review", or similar.

## Instructions

1. **Start the session.** Run the CLI to find due cards:

   ```bash
   flash review --dry-run 2>/dev/null || flash stats
   ```

   If the user specifies a deck name, pass it: `flash stats <deck>`. Look at the "Due" column to understand what needs reviewing.

2. **Load the deck.** Pick the deck with the most due cards (or the one the user specified). Read the `.fc` file directly to get card content:

   ```bash
   cat ~/flashcards/<deck-name>.fc
   ```

3. **Present cards one at a time.** For each due card:
   - Show the question clearly. For cloze cards, replace `{{hidden}}` with `[...]`.
   - If the card has a hint, mention it's available if they want it.
   - Wait for the user's answer.

4. **Grade the answer.** Compare the user's answer to the correct answer using these criteria:
   - **Correct:** Captures the essential meaning, even if worded differently. Equivalent meanings count (e.g., "the value moves" matches "ownership transfers").
   - **Partial:** Shows understanding but is incomplete or misses important details.
   - **Incorrect:** Wrong, off-topic, or empty.

5. **Provide feedback.** After grading:
   - Reveal the correct answer.
   - Give brief, encouraging feedback. If wrong, explain what was missed.
   - Suggest a rating: again (forgot completely), hard (struggled), good (recalled with effort), easy (instant recall).

6. **Record the rating.** Use the CLI to submit the rating:

   ```bash
   flash review <deck> --card-id <id> --rating <again|hard|good|easy>
   ```

   If the CLI doesn't support single-card rating flags, note this and batch the ratings. The user's self-assessment takes priority over your suggested rating.

7. **Continue until done.** After all due cards are reviewed (or the user wants to stop), show a session summary:
   - Total cards reviewed
   - Breakdown: how many again / hard / good / easy
   - Encouragement based on performance

8. **Handle interruptions.** If the user wants to stop mid-session, summarize progress so far and let them know they can resume later.

## Conversational style

- Keep it focused and efficient. Don't over-explain between cards.
- Use clear formatting: question in a block, answer revealed after response.
- Match the energy of a study partner, not a quiz show host.
