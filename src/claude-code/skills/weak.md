# /flash weak

Identify weak areas and offer targeted help.

## When to activate

User says `/flash weak`, "what am I struggling with", "show weak areas", "where do I need practice", or similar.

## Instructions

1. **Run the analyzer.** Use the CLI to find weak areas:

   ```bash
   flash weak
   ```

   This identifies cards with frequent lapses across all decks.

2. **Present findings conversationally.** For each weak area:
   - Name the topic or concept
   - Explain why it's flagged (e.g., "You've missed this 4 times across sessions")
   - Group related cards together

3. **Offer explanations.** For each weak topic, offer to explain the concept differently:
   - "Would you like me to explain [topic] from a different angle?"
   - If yes, provide a clear, alternative explanation tailored to what the cards are testing
   - Use analogies, examples, or step-by-step breakdowns as appropriate

4. **Offer targeted practice cards.** After explaining, offer to generate focused cards:
   - "Want me to create some practice cards that break this down into smaller pieces?"
   - If yes, generate cards using:

     ```bash
     flash gen "targeted practice for [specific weak concept]" --count 5
     ```

   - Show the generated cards and offer to edit before saving

5. **Suggest a study plan.** Based on the weak areas:
   - Prioritize which topics to tackle first (highest lapse count)
   - Suggest reviewing the weak deck: `flash review weak-areas`
   - Recommend spacing: "Review these daily for the next 3 days, then let the scheduler take over"

## Conversational style

- Be encouraging, not discouraging. Frame weaknesses as opportunities.
- Focus on actionable next steps, not just diagnosis.
- If there are no weak areas, celebrate the achievement and suggest moving on to new material.
