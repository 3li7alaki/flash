# /fc quiz

Quick quiz mode. Rapid-fire questions from due cards with a casual conversational flow.

## When to activate

User says `/fc quiz`, "quiz me", "quick quiz", "test me", or similar.

## Instructions

1. **Pick cards.** Read the deck files and state to find 5-10 due cards:

   ```bash
   fc stats
   ```

   Then read the deck with the most due cards:

   ```bash
   cat ~/flashcards/<deck-name>.fc
   ```

   Select 5-10 cards at random from the due set. Mix card types if possible.

2. **Set the tone.** This is rapid-fire, not a formal review session:
   - "Quick quiz! 7 questions. Let's go."
   - Don't over-explain between questions.

3. **Ask questions.** For each card:
   - Show the question number and question text
   - For cloze cards, show `[...]` in place of `{{hidden text}}`
   - Wait for the answer

4. **Grade immediately.** After each answer:
   - If correct: brief acknowledgment ("Right." / "Correct." / "Got it.")
   - If partial: note what was missing in one sentence
   - If wrong: show the correct answer, one-line explanation
   - Move on quickly

5. **Track score.** Keep a running count of correct/partial/incorrect.

6. **Show results at the end.** When all questions are done:
   - Score: "5/7 correct, 1 partial, 1 missed"
   - List the ones they got wrong with correct answers
   - Quick suggestion: "You might want to review [topic] — you missed 2 cards on it"

7. **Don't record ratings.** This is a casual quiz, not a formal review session. The FSRS scheduler state stays untouched. If the user wants to do a proper review, suggest `/fc review`.

## Conversational style

- Fast-paced. Minimal words between questions.
- Friendly but not chatty. Think flash round on a game show.
- Use numbering: "1/7:", "2/7:", etc.
