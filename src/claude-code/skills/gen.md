# /fc gen "topic"

Generate flashcards from a topic, file, or conversation context.

## When to activate

User says `/fc gen`, "generate cards about...", "make flashcards for...", "create cards from...", or similar.

## Instructions

1. **Determine the source.** The user may provide:
   - A topic as an argument: `/fc gen "Rust lifetimes"`
   - A file path: `/fc gen --from ./notes.md`
   - Conversation context (e.g., they were just reading code or discussing a concept)

2. **Run the generator.** Use the CLI:

   ```bash
   fc gen "topic" --count 10
   ```

   Or with a file:

   ```bash
   fc gen --from <file-path> --count 10
   ```

   If the source is conversation context, extract the key content into a temporary topic description and use:

   ```bash
   fc gen "detailed topic description based on conversation"
   ```

3. **Show the generated cards.** After generation, read the output deck file and display the cards clearly:
   - Show each card's question and answer
   - Note the card type (Q/A, cloze, code-output)
   - Show tags

4. **Offer to edit.** Ask the user if they want to:
   - Remove any cards that aren't useful
   - Edit questions or answers
   - Add more cards on specific subtopics
   - Change tags

5. **Apply edits.** If the user wants changes, edit the `.fc` file directly using the standard `.fc` format:
   - Cards separated by `---`
   - `Q:` and `A:` fields at column 0
   - Multiline content indented with spaces
   - `tags:`, `type:`, `hint:` fields as needed

6. **Confirm save.** Let the user know where the deck was saved and how many cards it contains. Mention they can review it with `/fc review <deck-name>`.

## Conversational style

- If the topic is vague, ask a clarifying question before generating.
- Show a preview of 3-5 cards first, then offer to show the rest.
- Be practical about card quality: flag cards that might be too broad or too narrow.
