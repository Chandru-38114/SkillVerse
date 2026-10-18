"""
Hand-written fallback question bank for the Skill Arena.

Questions normally come from the AI (services/question_generator.py). When the
AI is unavailable, the four supported courses (Python, Java, DSA, Web
Development) use these questions instead (the response says "source": "bank").
Every question has a `topic` tag from SKILL_TOPICS, which drives weak-topic
analysis and study plans. Answers stay on the server.
"""

QUESTION_BANK = {
    "python": [
        {"id": "py1", "topic": "Control Flow", "type": "mcq",
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
        {"id": "py4", "topic": "Exceptions", "type": "mcq",
         "question": "Which block always runs, error or not?",
         "options": ["except", "else", "finally", "raise"],
         "answer": "finally"},
        {"id": "py5", "topic": "Data Structures", "type": "mcq",
         "question": "Which library is most associated with dataframes?",
         "options": ["numpy", "pandas", "requests", "flask"],
         "answer": "pandas"},
        {"id": "py6", "topic": "Data Structures", "type": "output",
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


# ── Fallback banks for the other supported courses ──────────────────────────
# Used only when AI generation is unavailable, so a demo never dead-ends on
# "the AI question generator is busy". Topics match SKILL_TOPICS in
# services/question_generator.py so weak-topic analysis keeps working.
QUESTION_BANK["java"] = [
    {"id": "jv1", "topic": "OOP", "type": "mcq",
     "question": "Which keyword lets a Java class inherit from another class?",
     "options": ["implements", "extends", "inherits", "super"], "answer": "extends"},
    {"id": "jv2", "topic": "OOP", "type": "mcq",
     "question": "A method with the same name but different parameter lists in one class is called:",
     "options": ["Overriding", "Overloading", "Hiding", "Shadowing"], "answer": "Overloading"},
    {"id": "jv3", "topic": "Control Flow", "type": "output",
     "question": "What is printed?\n\nint x = 0;\nfor (int i = 0; i < 4; i++) { if (i == 2) continue; x += i; }\nSystem.out.println(x);",
     "options": ["6", "4", "3", "2"], "answer": "4"},
    {"id": "jv4", "topic": "Strings", "type": "output",
     "question": "What is printed?\n\nString a = \"Skill\";\nString b = a + \"Verse\";\nSystem.out.println(b.length());",
     "options": ["5", "10", "9", "11"], "answer": "10"},
    {"id": "jv5", "topic": "Strings", "type": "mcq",
     "question": "Which is the correct way to compare the CONTENT of two Strings s1 and s2?",
     "options": ["s1 == s2", "s1.equals(s2)", "s1 = s2", "s1.compare(s2) == true"], "answer": "s1.equals(s2)"},
    {"id": "jv6", "topic": "Collections", "type": "mcq",
     "question": "Which collection stores unique elements with no duplicates?",
     "options": ["ArrayList", "LinkedList", "HashSet", "Vector"], "answer": "HashSet"},
    {"id": "jv7", "topic": "Collections", "type": "output",
     "question": "What is printed?\n\nList<Integer> l = new ArrayList<>(List.of(1, 2, 3));\nl.remove(Integer.valueOf(1));\nSystem.out.println(l);",
     "options": ["[2, 3]", "[1, 3]", "[1, 2]", "Error"], "answer": "[2, 3]"},
    {"id": "jv8", "topic": "Exceptions", "type": "mcq",
     "question": "Which block runs whether or not an exception is thrown?",
     "options": ["catch", "finally", "throw", "try"], "answer": "finally"},
    {"id": "jv9", "topic": "Generics", "type": "mcq",
     "question": "What does List<String> guarantee at compile time?",
     "options": ["The list is never empty", "Only Strings can be added", "The list is sorted", "The list is thread-safe"], "answer": "Only Strings can be added"},
    {"id": "jv10", "topic": "Memory and JVM", "type": "mcq",
     "question": "Where are objects created with `new` stored in Java?",
     "options": ["Stack", "Heap", "Register", "Method area only"], "answer": "Heap"},
]

QUESTION_BANK["data structures and algorithms"] = [
    {"id": "dsa1", "topic": "Arrays", "type": "mcq",
     "question": "What is the time complexity of reading arr[i] from an array?",
     "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "answer": "O(1)"},
    {"id": "dsa2", "topic": "Linked Lists", "type": "mcq",
     "question": "Inserting a node at the HEAD of a singly linked list takes:",
     "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"], "answer": "O(1)"},
    {"id": "dsa3", "topic": "Stacks and Queues", "type": "mcq",
     "question": "Which structure follows Last-In-First-Out (LIFO)?",
     "options": ["Queue", "Stack", "Heap", "Deque used as a queue"], "answer": "Stack"},
    {"id": "dsa4", "topic": "Stacks and Queues", "type": "output",
     "question": "What is printed?\n\nq = []\nq.append(1); q.append(2); q.append(3)\nq.pop(0)\nprint(q)",
     "options": ["[2, 3]", "[1, 2]", "[1, 3]", "[3]"], "answer": "[2, 3]"},
    {"id": "dsa5", "topic": "Trees", "type": "mcq",
     "question": "An in-order traversal of a Binary Search Tree visits keys in:",
     "options": ["Random order", "Ascending order", "Descending order", "Level order"], "answer": "Ascending order"},
    {"id": "dsa6", "topic": "Trees", "type": "mcq",
     "question": "Maximum number of nodes in a binary tree of height 3 (root at height 1)?",
     "options": ["3", "6", "7", "8"], "answer": "7"},
    {"id": "dsa7", "topic": "Graphs", "type": "mcq",
     "question": "Which traversal uses a queue and finds shortest paths in an unweighted graph?",
     "options": ["DFS", "BFS", "Dijkstra with a stack", "In-order"], "answer": "BFS"},
    {"id": "dsa8", "topic": "Sorting and Searching", "type": "mcq",
     "question": "Binary search requires the input to be:",
     "options": ["Sorted", "Unique", "A linked list", "Of even length"], "answer": "Sorted"},
    {"id": "dsa9", "topic": "Sorting and Searching", "type": "output",
     "question": "What is printed?\n\ndef f(a):\n    return sorted(a)[len(a) // 2]\nprint(f([7, 1, 5, 3, 9]))",
     "options": ["3", "5", "7", "1"], "answer": "5"},
    {"id": "dsa10", "topic": "Complexity", "type": "mcq",
     "question": "Average-case time complexity of merge sort?",
     "options": ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"], "answer": "O(n log n)"},
]

QUESTION_BANK["web development"] = [
    {"id": "web1", "topic": "HTML", "type": "mcq",
     "question": "Which HTML element is used for the largest heading?",
     "options": ["<head>", "<h6>", "<h1>", "<header>"], "answer": "<h1>"},
    {"id": "web2", "topic": "HTML", "type": "mcq",
     "question": "Which attribute gives an image text for screen readers?",
     "options": ["title", "alt", "src", "label"], "answer": "alt"},
    {"id": "web3", "topic": "CSS", "type": "mcq",
     "question": "Which CSS property makes a flex container stack items vertically?",
     "options": ["flex-direction: column", "align-items: column", "display: vertical", "flex-wrap: column"], "answer": "flex-direction: column"},
    {"id": "web4", "topic": "CSS", "type": "mcq",
     "question": "Which selector has the HIGHEST specificity?",
     "options": [".card", "div", "#main", "*"], "answer": "#main"},
    {"id": "web5", "topic": "JavaScript", "type": "output",
     "question": "What is logged?\n\nconsole.log(typeof null)",
     "options": ["\"null\"", "\"object\"", "\"undefined\"", "\"number\""], "answer": "\"object\""},
    {"id": "web6", "topic": "JavaScript", "type": "output",
     "question": "What is logged?\n\nconst a = [1, 2, 3].map(x => x * 2);\nconsole.log(a.join('-'))",
     "options": ["1-2-3", "2-4-6", "246", "[2,4,6]"], "answer": "2-4-6"},
    {"id": "web7", "topic": "DOM", "type": "mcq",
     "question": "Which method selects the FIRST element matching a CSS selector?",
     "options": ["document.querySelector", "document.querySelectorAll", "document.getElementsByTagName", "document.select"], "answer": "document.querySelector"},
    {"id": "web8", "topic": "HTTP and APIs", "type": "mcq",
     "question": "Which HTTP status code means 'Not Found'?",
     "options": ["200", "301", "404", "500"], "answer": "404"},
    {"id": "web9", "topic": "HTTP and APIs", "type": "mcq",
     "question": "Which HTTP method is normally used to CREATE a new resource?",
     "options": ["GET", "POST", "DELETE", "HEAD"], "answer": "POST"},
    {"id": "web10", "topic": "Asynchronous JavaScript", "type": "output",
     "question": "In what order are the numbers logged?\n\nconsole.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);",
     "options": ["1 2 3 4", "1 4 3 2", "1 4 2 3", "1 3 4 2"], "answer": "1 4 3 2"},
]
QUESTION_BANK["dsa"] = QUESTION_BANK["data structures and algorithms"]

DEFAULT_TOPICS = ["Fundamentals", "Core Concepts", "Applied Practice", "Debugging", "Best Practices"]


def get_questions_for_skill(skill_name: str):
    """Static fallback bank for a skill, or [] if there is none.
    (The old version invented placeholder questions whose answer was always
    "A" — anyone could earn an Expert badge for any skill with them.)"""
    return QUESTION_BANK.get(" ".join(skill_name.strip().lower().split()), [])
