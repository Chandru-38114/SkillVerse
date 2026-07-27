# This is the seed question bank for the skill assessment engine.
#
# For the MVP this is hand-written data so the whole flow (assess -> score ->
# weak topics -> study plan -> badge) works end-to-end with zero external
# dependencies. To upgrade this into the "AI Skill Assessment" described in
# the product plan, replace `get_questions_for_skill()` with a call to an
# LLM (OpenAI/Anthropic) that generates MCQs/coding/debugging questions for
# an arbitrary skill name -- everything downstream (scoring, badges, study
# plans) stays the same because it just consumes the `topic` tags below.

QUESTION_BANK = {
    "python": [
        {"id": "py1", "topic": "Loops", "type": "mcq",
         "question": "What does `range(2, 10, 2)` produce?",
         "options": ["2,4,6,8", "2,3,4,...,9", "2,4,6,8,10", "0,2,4,6,8"],
         "answer": "2,4,6,8"},
        {"id": "py2", "topic": "Functions", "type": "mcq",
         "question": "Which keyword defines a function in Python?",
         "options": ["func", "def", "function", "lambda"],
         "answer": "def"},
        {"id": "py3", "topic": "OOP", "type": "mcq",
         "question": "Which method is the constructor in a Python class?",
         "options": ["__new__", "__init__", "__create__", "__start__"],
         "answer": "__init__"},
        {"id": "py4", "topic": "Exception Handling", "type": "mcq",
         "question": "Which block always runs, error or not?",
         "options": ["except", "else", "finally", "raise"],
         "answer": "finally"},
        {"id": "py5", "topic": "Libraries", "type": "mcq",
         "question": "Which library is most associated with dataframes?",
         "options": ["numpy", "pandas", "requests", "flask"],
         "answer": "pandas"},
        {"id": "py6", "topic": "Debugging", "type": "output",
         "question": "What is printed?\n\nx = [1, 2, 3]\nprint(x[1:])",
         "options": ["[1, 2, 3]", "[2, 3]", "[1, 2]", "Error"],
         "answer": "[2, 3]"},
    ],
    "javascript": [
        {"id": "js1", "topic": "Functions", "type": "mcq",
         "question": "Which keyword creates a block-scoped variable?",
         "options": ["var", "let", "global", "static"],
         "answer": "let"},
        {"id": "js2", "topic": "Async", "type": "mcq",
         "question": "What does `await` do inside an async function?",
         "options": ["Pauses until the Promise resolves", "Runs code in parallel",
                      "Throws an error", "Skips the next line"],
         "answer": "Pauses until the Promise resolves"},
        {"id": "js3", "topic": "Arrays", "type": "output",
         "question": "What is printed?\n\nconsole.log([1,2,3].map(n => n * 2))",
         "options": ["[1,2,3]", "[2,4,6]", "6", "Error"],
         "answer": "[2,4,6]"},
        {"id": "js4", "topic": "Closures", "type": "mcq",
         "question": "A closure is a function that...",
         "options": ["Has no parameters", "Remembers variables from its outer scope",
                      "Runs only once", "Cannot be reused"],
         "answer": "Remembers variables from its outer scope"},
        {"id": "js5", "topic": "DOM", "type": "mcq",
         "question": "Which method selects a single element by id?",
         "options": ["document.querySelectorAll", "document.getElementById",
                      "document.getElementsByClass", "document.select"],
         "answer": "document.getElementById"},
    ],
}

DEFAULT_TOPICS = ["Fundamentals", "Core Concepts", "Applied Practice", "Debugging", "Best Practices"]


def get_questions_for_skill(skill_name: str):
    key = skill_name.strip().lower()
    if key in QUESTION_BANK:
        return QUESTION_BANK[key]

    # Fallback: generic placeholder questions so ANY skill name still works
    # in the demo. Swap this for a real LLM call when you add AI generation.
    return [
        {"id": f"{key}-{i}", "topic": DEFAULT_TOPICS[i % len(DEFAULT_TOPICS)], "type": "mcq",
         "question": f"(Placeholder) Rate your confidence question #{i+1} for {skill_name}.",
         "options": ["A", "B", "C", "D"], "answer": "A"}
        for i in range(5)
    ]