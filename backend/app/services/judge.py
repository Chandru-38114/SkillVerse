"""
LeetCode-style judge for Practice problems and Skill Arena coding questions.

A FUNCTION problem has a typed signature, e.g.
    {"function": "twoSum",
     "params": [{"name": "nums", "type": "int[]"}, {"name": "target", "type": "int"}],
     "returns": "int[]"}
and tests [{"args": [[2, 7, 11, 15], 9], "expected": [0, 1], "sample": true}, ...].

For each language we write a small "driver" program around the learner's code that
calls their function once per test and prints the results as data. We then compare
them with the expected answers HERE, on the server: expected answers never go to
the code runner or the browser, so printing fake output can't pass a test.

A SQL problem has table definitions, a dataset per test and the expected result
table; the learner's query runs against each dataset in the SQL sandbox.

Types: int, long, double, bool, string, int[], long[], double[], bool[], string[],
int[][], string[][], ListNode (a linked list, written as [1,2,3]) and TreeNode
(a binary tree in level order, written as [3,9,20,null,null,15,7]).
"returns": "void" + "output_param": "<name>" checks a parameter changed in place.
"""
import ast
import json
import math
import re
import secrets

from .code_exec import call_runner
from .code_runner import run_python
from .sql_runner import run_sql

SCALAR = {"int", "long", "double", "bool", "string"}
ARRAYS = {"int[]", "long[]", "double[]", "bool[]", "string[]", "int[][]", "string[][]"}
NODES = {"ListNode", "TreeNode"}
TYPES = SCALAR | ARRAYS | NODES
RETURN_TYPES = TYPES | {"void"}
LANGUAGES = ("python", "java", "javascript")
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,40}$")
RESERVED = {
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
    "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if",
    "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private",
    "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
    "throw", "throws", "transient", "try", "void", "volatile", "while", "var", "let", "function", "in", "of",
    "delete", "typeof", "yield", "await", "with", "export", "None", "True", "False", "def", "lambda", "pass",
    "not", "and", "or", "is", "from", "as", "global", "nonlocal", "del", "raise", "except", "elif", "async",
    "Solution", "Main", "ListNode", "TreeNode", "print", "len", "list", "dict", "set", "str", "max", "min",
}
MAX_TESTS = 30
MAX_ELEMENTS = 5000
FLOAT_TOL = 1e-5


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
class SpecError(ValueError):
    pass


def _check_value(v, t: str, path: str):
    def fail(msg):
        raise SpecError(f"{path}: {msg}")
    if t == "int" or t == "long":
        if isinstance(v, bool) or not isinstance(v, int):
            fail(f"expected an integer, got {v!r}")
        if t == "int" and not (-2**31 <= v < 2**31):
            fail("int out of range")
    elif t == "double":
        if isinstance(v, bool) or not isinstance(v, (int, float)) or (isinstance(v, float) and not math.isfinite(v)):
            fail(f"expected a number, got {v!r}")
    elif t == "bool":
        if not isinstance(v, bool):
            fail(f"expected true/false, got {v!r}")
    elif t == "string":
        if not isinstance(v, str) or len(v) > 10000:
            fail("expected a string")
    elif t in ("int[]", "long[]", "double[]", "bool[]", "string[]"):
        if not isinstance(v, list) or len(v) > MAX_ELEMENTS:
            fail("expected a list")
        for i, x in enumerate(v):
            _check_value(x, t[:-2], f"{path}[{i}]")
    elif t in ("int[][]", "string[][]"):
        if not isinstance(v, list) or len(v) > 500:
            fail("expected a list of lists")
        for i, x in enumerate(v):
            _check_value(x, t[:-2], f"{path}[{i}]")
    elif t == "ListNode":
        if not isinstance(v, list) or len(v) > MAX_ELEMENTS or any(isinstance(x, bool) or not isinstance(x, int) for x in v):
            fail("a ListNode is written as a list of integers")
    elif t == "TreeNode":
        if not isinstance(v, list) or len(v) > MAX_ELEMENTS or any(x is not None and (isinstance(x, bool) or not isinstance(x, int)) for x in v):
            fail("a TreeNode is written as a level-order list of integers and nulls")
        if v and v[0] is None:
            fail("a tree can't start with null")


def validate_signature(sig: dict) -> dict:
    if not isinstance(sig, dict):
        raise SpecError("signature missing")
    fn = sig.get("function", "")
    if not IDENT.match(fn) or fn in RESERVED:
        raise SpecError(f"bad function name {fn!r}")
    params = sig.get("params") or []
    if not isinstance(params, list) or not (1 <= len(params) <= 6):
        raise SpecError("1 to 6 parameters")
    names = set()
    for p in params:
        if not isinstance(p, dict) or not IDENT.match(p.get("name", "")) or p["name"] in RESERVED or p["name"] in names:
            raise SpecError(f"bad parameter {p!r}")
        if p.get("type") not in TYPES:
            raise SpecError(f"unsupported type {p.get('type')!r}")
        names.add(p["name"])
    ret = sig.get("returns")
    if ret not in RETURN_TYPES:
        raise SpecError(f"unsupported return type {ret!r}")
    out = {"function": fn, "params": [{"name": p["name"], "type": p["type"]} for p in params], "returns": ret}
    if ret == "void":
        op = sig.get("output_param")
        ptypes = {p["name"]: p["type"] for p in params}
        if op not in ptypes or ptypes[op] not in ARRAYS:
            raise SpecError("a void function needs output_param = an array parameter it changes")
        out["output_param"] = op
    return out


def validate_tests(sig: dict, tests: list, need_expected: bool) -> list:
    if not isinstance(tests, list) or not (1 <= len(tests) <= MAX_TESTS):
        raise SpecError(f"1 to {MAX_TESTS} tests")
    out_type = _result_type(sig)
    clean = []
    for i, tc in enumerate(tests):
        args = tc.get("args") if isinstance(tc, dict) else None
        if not isinstance(args, list) or len(args) != len(sig["params"]):
            raise SpecError(f"test {i + 1}: needs {len(sig['params'])} arguments")
        for p, a in zip(sig["params"], args):
            _check_value(a, p["type"], f"test {i + 1} {p['name']}")
        item = {"args": args, "sample": bool(tc.get("sample"))}
        if need_expected:
            if "expected" not in tc:
                raise SpecError(f"test {i + 1}: no expected answer")
            _check_value(tc["expected"], out_type, f"test {i + 1} expected")
            item["expected"] = tc["expected"]
        clean.append(item)
    if not any(t["sample"] for t in clean):
        for t in clean[:2]:
            t["sample"] = True
    return clean


def _norm(v, t: str):
    """An empty list/tree may come back as None/null: treat it as []."""
    if v is None and t in NODES:
        return []
    return v


def _result_type(sig: dict) -> str:
    if sig["returns"] == "void":
        return {p["name"]: p["type"] for p in sig["params"]}[sig["output_param"]]
    return sig["returns"]


# ---------------------------------------------------------------------------
# Python driver (runs in our own sandbox)
# ---------------------------------------------------------------------------
PY_HEADER = '''
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
'''


def _py_driver(sig: dict, code: str, tests: list, marker: str) -> str:
    t = secrets.token_hex(5)
    fn = sig["function"]
    lines = [PY_HEADER, f"_p{t} = print", f"_r{t} = repr", f"_ty{t} = type",
             f"_L{t} = ListNode", f"_T{t} = TreeNode",
             f"def _mkl{t}(xs):",
             "    head = None",
             "    for x in reversed(xs):",
             f"        head = _L{t}(x, head)",
             "    return head",
             f"def _mkt{t}(xs):",
             "    if not xs:",
             "        return None",
             f"    root = _T{t}(xs[0])",
             "    q = [root]",
             "    i = 1",
             "    while q and i < len(xs):",
             "        node = q.pop(0)",
             "        if i < len(xs) and xs[i] is not None:",
             f"            node.left = _T{t}(xs[i])",
             "            q.append(node.left)",
             "        i += 1",
             "        if i < len(xs) and xs[i] is not None:",
             f"            node.right = _T{t}(xs[i])",
             "            q.append(node.right)",
             "        i += 1",
             "    return root",
             f"def _ser{t}(v, depth=0):",
             "    if depth > 30:",
             "        raise ValueError('result nested too deeply')",
             f"    k = _ty{t}(v)",
             "    if v is None or k in (int, float, str, bool):",
             "        return v",
             f"    if k is _L{t}:",
             "        out = []",
             "        while v is not None and len(out) <= 10000:",
             "            out.append(v.val)",
             "            v = v.next",
             "        return out",
             f"    if k is _T{t}:",
             "        out = []",
             "        q = [v]",
             "        while q and len(out) <= 20000:",
             "            n = q.pop(0)",
             "            if n is None:",
             "                out.append(None)",
             "            else:",
             "                out.append(n.val)",
             "                q.append(n.left)",
             "                q.append(n.right)",
             "        while out and out[-1] is None:",
             "            out.pop()",
             "        return out",
             "    if k in (list, tuple):",
             f"        return [_ser{t}(x, depth + 1) for x in v]",
             "    raise ValueError('the function returned an unsupported type: ' + k.__name__)",
             "", code, ""]
    lines += [f"_res{t} = []", "try:", f"    _obj{t} = Solution()", f"    _fn{t} = _obj{t}.{fn}",
              "except Exception:", f"    _fn{t} = {fn}"]
    for i, tc in enumerate(tests):
        argv = []
        for p, a in zip(sig["params"], tc["args"]):
            lit = repr(a)
            if p["type"] == "ListNode":
                lit = f"_mkl{t}({lit})"
            elif p["type"] == "TreeNode":
                lit = f"_mkt{t}({lit})"
            argv.append(lit)
        lines.append("try:")
        lines.append(f"    _a{t} = [{', '.join(argv)}]")
        if sig["returns"] == "void":
            idx = [p["name"] for p in sig["params"]].index(sig["output_param"])
            lines.append(f"    _fn{t}(*_a{t})")
            lines.append(f"    _res{t}.append(('ok', _ser{t}(_a{t}[{idx}])))")
        else:
            lines.append(f"    _res{t}.append(('ok', _ser{t}(_fn{t}(*_a{t}))))")
        lines.append("except BaseException as _e:")
        lines.append(f"    _res{t}.append(('err', _ty{t}(_e).__name__ + ': ' + str(_e)[:300]))")
    lines.append(f"_p{t}({marker!r} + _r{t}(_res{t}))")
    return "\n".join(lines)


def _parse_py(output: str, marker: str):
    idx = output.rfind(marker)
    if idx == -1:
        return None
    try:
        raw = ast.literal_eval(output[idx + len(marker):].splitlines()[0])
    except (ValueError, SyntaxError, IndexError):
        return None
    return [{"ok": v} if kind == "ok" else {"err": v} for kind, v in raw]


# ---------------------------------------------------------------------------
# Java driver (runs on the code runner)
# ---------------------------------------------------------------------------
JAVA_TYPES = {"int": "int", "long": "long", "double": "double", "bool": "boolean", "string": "String",
              "int[]": "int[]", "long[]": "long[]", "double[]": "double[]", "bool[]": "boolean[]",
              "string[]": "String[]", "int[][]": "int[][]", "string[][]": "String[][]",
              "ListNode": "ListNode", "TreeNode": "TreeNode", "void": "void"}

JAVA_LISTNODE = """class ListNode {
    int val; ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
"""
JAVA_TREENODE = """class TreeNode {
    int val; TreeNode left; TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
"""
JAVA_HELPERS = r"""
final class SvH {
    static ListNode list(int[] a) { ListNode h = null; for (int i = a.length - 1; i >= 0; i--) h = new ListNode(a[i], h); return h; }
    static TreeNode tree(Integer[] a) {
        if (a.length == 0) return null;
        TreeNode root = new TreeNode(a[0]); java.util.ArrayDeque<TreeNode> q = new java.util.ArrayDeque<>(); q.add(root); int i = 1;
        while (!q.isEmpty() && i < a.length) {
            TreeNode n = q.poll();
            if (i < a.length && a[i] != null) { n.left = new TreeNode(a[i]); q.add(n.left); } i++;
            if (i < a.length && a[i] != null) { n.right = new TreeNode(a[i]); q.add(n.right); } i++;
        }
        return root;
    }
    static String str(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }
    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String) return str((String) o);
        if (o instanceof Character) return str(String.valueOf(o));
        if (o instanceof Boolean) return o.toString();
        if (o instanceof Double || o instanceof Float) { double d = ((Number) o).doubleValue(); return (Double.isNaN(d) || Double.isInfinite(d)) ? "null" : Double.toString(d); }
        if (o instanceof Number) return o.toString();
        StringBuilder b = new StringBuilder("[");
        if (o instanceof int[]) { int[] a = (int[]) o; for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } }
        else if (o instanceof long[]) { long[] a = (long[]) o; for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } }
        else if (o instanceof double[]) { double[] a = (double[]) o; for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(json(a[i])); } }
        else if (o instanceof boolean[]) { boolean[] a = (boolean[]) o; for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } }
        else if (o instanceof char[]) { return str(new String((char[]) o)); }
        else if (o instanceof Object[]) { Object[] a = (Object[]) o; for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(json(a[i])); } }
        else if (o instanceof java.util.Collection) { int i = 0; for (Object x : (java.util.Collection<?>) o) { if (i++ > 0) b.append(','); b.append(json(x)); } }
        else if (o instanceof ListNode) { ListNode n = (ListNode) o; int c = 0; while (n != null && c <= 10000) { if (c++ > 0) b.append(','); b.append(n.val); n = n.next; } }
        else if (o instanceof TreeNode) {
            java.util.List<String> out = new java.util.ArrayList<>(); java.util.ArrayDeque<Object> q = new java.util.ArrayDeque<>(); q.add(o);
            java.util.LinkedList<TreeNode> lq = new java.util.LinkedList<>(); lq.add((TreeNode) o);
            while (!lq.isEmpty() && out.size() <= 20000) { TreeNode n = lq.poll(); if (n == null) out.add("null"); else { out.add(String.valueOf(n.val)); lq.add(n.left); lq.add(n.right); } }
            while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
            return "[" + String.join(",", out) + "]";
        }
        else throw new IllegalArgumentException("the method returned an unsupported type: " + o.getClass().getSimpleName());
        return b.append(']').toString();
    }
    static String err(Throwable t) {
        String m = t.getClass().getName() + (t.getMessage() == null ? "" : ": " + t.getMessage());
        if (m.length() > 300) m = m.substring(0, 300);
        return "{\"err\":" + str(m) + "}";
    }
}
"""


def _java_lit(v, t: str) -> str:
    if t == "int":
        return str(v)
    if t == "long":
        return f"{v}L"
    if t == "double":
        return repr(float(v))
    if t == "bool":
        return "true" if v else "false"
    if t == "string":
        return json.dumps(v, ensure_ascii=True)  # a JSON string is a valid Java literal for ASCII escapes
    if t in ("int[]", "long[]", "double[]", "bool[]", "string[]"):
        inner = t[:-2]
        return f"new {JAVA_TYPES[t]}{{{', '.join(_java_lit(x, inner) for x in v)}}}"
    if t in ("int[][]", "string[][]"):
        inner = t[:-2]
        return f"new {JAVA_TYPES[t]}{{{', '.join('{' + ', '.join(_java_lit(y, inner[:-2]) for y in x) + '}' for x in v)}}}"
    if t == "ListNode":
        return f"SvH.list(new int[]{{{', '.join(str(x) for x in v)}}})"
    if t == "TreeNode":
        return f"SvH.tree(new Integer[]{{{', '.join('null' if x is None else str(x) for x in v)}}})"
    raise SpecError(t)


JAVA_AUTO_IMPORTS = "import java.util.*; import java.util.function.*; import java.util.stream.*; "


def _java_files(sig: dict, code: str, tests: list, marker: str) -> dict:
    fn = sig["function"]
    methods, calls = [], []
    for i, tc in enumerate(tests):
        decls = [f"        {JAVA_TYPES[p['type']]} a{j} = {_java_lit(a, p['type'])};"
                 for j, (p, a) in enumerate(zip(sig["params"], tc["args"]))]
        argnames = ", ".join(f"a{j}" for j in range(len(tc["args"])))
        if sig["returns"] == "void":
            idx = [p["name"] for p in sig["params"]].index(sig["output_param"])
            body = f"        new Solution().{fn}({argnames});\n        return \"{{\\\"ok\\\":\" + SvH.json(a{idx}) + \"}}\";"
        else:
            body = f"        Object r = new Solution().{fn}({argnames});\n        return \"{{\\\"ok\\\":\" + SvH.json(r) + \"}}\";"
        methods.append(f"    static String t{i}() {{\n" + "\n".join(decls) + "\n" + body + "\n    }")
        calls.append(f"        try {{ out.append(t{i}()); }} catch (Throwable e) {{ out.append(SvH.err(e)); }}")
    main = ("public class Main {\n" + "\n".join(methods) +
            "\n    public static void main(String[] args) {\n        StringBuilder out = new StringBuilder(\"[\");\n" +
            "\n        out.append(',');\n".join(calls) +
            f"\n        out.append(']');\n        System.out.flush();\n        System.out.println({json.dumps(marker)} + out);\n    }}\n}}\n")
    # Like LeetCode: java.util (List, Map, HashMap, ...) is always imported. Added on
    # line 1 itself so compiler error line numbers still match the learner's code
    # (Java allows the same import twice, so a learner's own imports are fine).
    if not re.search(r"^\s*package\s", code, re.M):
        code = JAVA_AUTO_IMPORTS + code
    files = {"Main.java": main + JAVA_HELPERS, "Solution.java": code}
    if not re.search(r"\bclass\s+ListNode\b", code):
        files["ListNode.java"] = JAVA_LISTNODE
    if not re.search(r"\bclass\s+TreeNode\b", code):
        files["TreeNode.java"] = JAVA_TREENODE
    return files


# ---------------------------------------------------------------------------
# JavaScript driver (runs on the code runner)
# ---------------------------------------------------------------------------
JS_HEADER = """function ListNode(val, next) { this.val = (val === undefined ? 0 : val); this.next = (next === undefined ? null : next); }
function TreeNode(val, left, right) { this.val = (val === undefined ? 0 : val); this.left = (left === undefined ? null : left); this.right = (right === undefined ? null : right); }
"""


def _js_source(sig: dict, code: str, tests: list, marker: str) -> str:
    t = secrets.token_hex(5)
    fn = sig["function"]
    header = "" if re.search(r"\b(function|class)\s+(ListNode|TreeNode)\b", code) else JS_HEADER
    helpers = f"""
const __mkl{t} = (a) => {{ let h = null; for (let i = a.length - 1; i >= 0; i--) h = new ListNode(a[i], h); return h; }};
const __mkt{t} = (a) => {{ if (!a.length) return null; const r = new TreeNode(a[0]); const q = [r]; let i = 1;
  while (q.length && i < a.length) {{ const n = q.shift();
    if (i < a.length && a[i] !== null) {{ n.left = new TreeNode(a[i]); q.push(n.left); }} i++;
    if (i < a.length && a[i] !== null) {{ n.right = new TreeNode(a[i]); q.push(n.right); }} i++; }}
  return r; }};
const __ser{t} = (v, d = 0) => {{
  if (d > 30) throw new Error('result nested too deeply');
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return Array.from(v, (x) => __ser{t}(x, d + 1));
  if (v instanceof ListNode) {{ const o = []; let n = v; while (n && o.length <= 10000) {{ o.push(n.val); n = n.next; }} return o; }}
  if (v instanceof TreeNode) {{ const o = []; const q = [v]; while (q.length && o.length <= 20000) {{ const n = q.shift();
      if (!n) o.push(null); else {{ o.push(n.val); q.push(n.left); q.push(n.right); }} }}
    while (o.length && o[o.length - 1] === null) o.pop(); return o; }}
  throw new Error('the function returned an unsupported type');
}};
"""
    calls = []
    for tc in tests:
        argv = []
        for p, a in zip(sig["params"], tc["args"]):
            lit = json.dumps(a)
            if p["type"] == "ListNode":
                lit = f"__mkl{t}({lit})"
            elif p["type"] == "TreeNode":
                lit = f"__mkt{t}({lit})"
            argv.append(lit)
        if sig["returns"] == "void":
            idx = [p["name"] for p in sig["params"]].index(sig["output_param"])
            calls.append(f"try {{ const a = [{', '.join(argv)}]; __call{t}(a); __out{t}.push({{ok: __ser{t}(a[{idx}])}}); }} "
                         f"catch (e) {{ __out{t}.push({{err: String((e && e.name) || 'Error') + ': ' + String((e && e.message) || e).slice(0, 300)}}); }}")
        else:
            calls.append(f"try {{ const a = [{', '.join(argv)}]; __out{t}.push({{ok: __ser{t}(__call{t}(a))}}); }} "
                         f"catch (e) {{ __out{t}.push({{err: String((e && e.name) || 'Error') + ': ' + String((e && e.message) || e).slice(0, 300)}}); }}")
    footer = f"""
const __out{t} = [];
const __call{t} = (a) => (typeof {fn} === 'function') ? {fn}(...a) : new Solution().{fn}(...a);
{chr(10).join(calls)}
process.stdout.write('\\n' + {json.dumps(marker)} + JSON.stringify(__out{t}) + '\\n');
"""
    return header + helpers + "\n" + code + "\n" + footer


def _parse_json_results(output: str, marker: str):
    idx = output.rfind(marker)
    if idx == -1:
        return None
    try:
        data = json.loads(output[idx + len(marker):].splitlines()[0])
    except (ValueError, IndexError):
        return None
    return data if isinstance(data, list) else None


# ---------------------------------------------------------------------------
# Running + comparing
# ---------------------------------------------------------------------------
def _same(got, expected, t: str, any_order: bool) -> bool:
    if t == "double":
        return isinstance(got, (int, float)) and not isinstance(got, bool) and \
            abs(got - expected) <= max(FLOAT_TOL, FLOAT_TOL * abs(expected))
    if t in ("int", "long"):
        return isinstance(got, (int, float)) and not isinstance(got, bool) and got == expected
    if t == "bool":
        return isinstance(got, bool) and got == expected
    if t == "string":
        return isinstance(got, str) and got == expected
    if t in ("ListNode", "TreeNode"):
        return got == expected
    # arrays
    if not isinstance(got, list) or len(got) != len(expected):
        return False
    inner = t[:-2]
    if any_order:
        key = lambda x: json.dumps(x, sort_keys=True)  # noqa: E731
        got_s, exp_s = sorted(got, key=key), sorted(expected, key=key)
        if inner.endswith("[]"):  # also ignore order inside each row
            got_s = sorted((sorted(r, key=key) if isinstance(r, list) else r for r in got), key=key)
            exp_s = sorted((sorted(r, key=key) for r in expected), key=key)
        return all(_same(g, e, inner, False) for g, e in zip(got_s, exp_s))
    return all(_same(g, e, inner, False) for g, e in zip(got, expected))


def run_tests(sig: dict, language: str, code: str, tests: list) -> dict:
    """Run the learner's function on the given tests (args only).
    Returns {"status": ..., "results": [{"ok": value} | {"err": msg}] | None, "error": str|None, "output": str}."""
    marker = "SVJUDGE" + secrets.token_hex(8)
    if language == "python":
        r = run_python(_py_driver(sig, code, tests, marker), timeout=10.0)
        out = r.get("output") or ""
        results = _parse_py(out, marker)
        if results is None:
            err = (r.get("error") or "").strip()
            low = err.lower()
            status = "timeout" if ("time limit" in low or "cpu limit" in low) else "runtime_error"
            if status == "timeout":
                err = "Time limit exceeded: your code ran too long (infinite loop or too slow)."
            return {"status": status, "results": None, "error": err or "The code did not run.", "output": out[:4000]}
        return {"status": "ok", "results": results, "error": None, "output": out[:out.rfind(marker)][:4000]}
    if language == "java":
        r = call_runner("java", _java_files(sig, code, tests, marker), "Main", "", 8.0)
    elif language == "javascript":
        r = call_runner("javascript", {"main.js": _js_source(sig, code, tests, marker)}, "main.js", "", 8.0)
    else:
        return {"status": "unavailable", "results": None, "error": f"{language} is not supported for this problem.", "output": ""}
    status = r.get("status")
    out = r.get("stdout") or ""
    if status == "compile_error":
        return {"status": "compile_error", "results": None, "error": _clean_compile(r.get("compile_output", "")), "output": ""}
    if status in ("unavailable", "busy"):
        return {"status": status, "results": None, "error": r.get("message"), "output": ""}
    results = _parse_json_results(out, marker)
    if results is None:
        return {"status": "timeout" if status == "timeout" else "runtime_error", "results": None,
                "error": (r.get("stderr") or "").strip()[-1500:] or "The program stopped before finishing.",
                "output": out[:4000]}
    return {"status": "ok", "results": results, "error": None, "output": out[:out.rfind(marker)][:4000]}


def _clean_compile(text: str) -> str:
    """Only show errors in the learner's own file."""
    lines = [ln for ln in (text or "").splitlines() if ln.startswith("Solution.java")]
    return "\n".join(lines) or (text or "Compilation failed.")[:3000]


def describe_args(sig: dict, args: list) -> str:
    return ", ".join(f"{p['name']} = {json.dumps(a)}" for p, a in zip(sig["params"], args))


def judge(spec: dict, language: str, code: str, which: str = "all") -> dict:
    """Grade learner code against a stored problem spec.

    which = "sample" (the Run button: sample tests, answers shown) or "all" (Submit).
    Returns {"verdict", "passed", "total", "results": [...], "error", "output"}.
    Expected answers are only included for SAMPLE tests."""
    if spec.get("kind") == "sql":
        return judge_sql(spec, code, which)
    sig = spec["signature"]
    tests = spec["tests"] if which == "all" else [t for t in spec["tests"] if t.get("sample")]
    if not code or not code.strip():
        return {"verdict": "No Code", "passed": 0, "total": len(tests), "results": [], "error": "Write some code first.", "output": ""}
    run = run_tests(sig, language, code, [{"args": t["args"]} for t in tests])
    if run["status"] != "ok":
        verdict = {"compile_error": "Compile Error", "timeout": "Time Limit Exceeded",
                   "unavailable": "Runner Unavailable", "busy": "Runner Busy"}.get(run["status"], "Runtime Error")
        return {"verdict": verdict, "passed": 0, "total": len(tests), "results": [], "error": run["error"], "output": run["output"]}
    rtype = _result_type(sig)
    any_order = bool(spec.get("any_order"))
    results, passed, first_err = [], 0, None
    for i, (t, got) in enumerate(zip(tests, run["results"])):
        if "ok" in got:
            got = {"ok": _norm(got["ok"], rtype)}
        ok = "ok" in got and _same(got["ok"], t["expected"], rtype, any_order)
        passed += ok
        item = {"index": i + 1, "passed": ok, "sample": bool(t.get("sample")), "input": describe_args(sig, t["args"])}
        if "err" in got:
            item["error"] = got["err"]
            first_err = first_err or got["err"]
        if t.get("sample") or which == "sample":
            item["expected"] = t["expected"]
            item["output"] = got.get("ok")
        results.append(item)
    total = len(tests)
    failing = [r for r in results if not r["passed"]]
    if not failing:
        verdict = "Accepted"
    elif all("error" in r for r in failing):
        verdict = "Runtime Error"
    else:
        verdict = "Wrong Answer"
    return {"verdict": verdict, "passed": passed, "total": total, "results": results, "error": first_err, "output": run["output"]}


def compute_expected(sig: dict, reference_python: str, tests: list) -> list:
    """Run the reference solution to get the expected answers (more reliable than
    answers an AI wrote down). Raises SpecError if the reference fails anywhere."""
    run = run_tests(sig, "python", reference_python, [{"args": t["args"]} for t in tests])
    if run["status"] != "ok":
        raise SpecError(f"reference solution failed: {run['error']}")
    out = []
    for t, got in zip(tests, run["results"]):
        if "err" in got:
            raise SpecError(f"reference solution failed on {t['args']}: {got['err']}")
        out.append({**t, "expected": _norm(got["ok"], _result_type(sig))})
    return validate_tests(sig, out, need_expected=True)


# ---------------------------------------------------------------------------
# SQL problems
# ---------------------------------------------------------------------------
def _last_table(res: dict):
    tables = [r for r in res.get("results", []) if "columns" in r]
    return tables[-1] if tables else None


def _norm_cell(v):
    if isinstance(v, float):
        return round(v, 4)
    return v


def _same_table(got: dict, expected: dict, ordered: bool) -> bool:
    if got is None or len(got["columns"]) != len(expected["columns"]):
        return False
    g = [[_norm_cell(c) for c in row] for row in got["rows"]]
    e = [[_norm_cell(c) for c in row] for row in expected["rows"]]
    if not ordered:
        key = lambda r: json.dumps(r, default=str)  # noqa: E731
        g, e = sorted(g, key=key), sorted(e, key=key)
    return g == e


def judge_sql(spec: dict, query: str, which: str = "all") -> dict:
    tests = spec["tests"] if which == "all" else [t for t in spec["tests"] if t.get("sample")]
    if not query or not query.strip():
        return {"verdict": "No Code", "passed": 0, "total": len(tests), "results": [], "error": "Write a query first.", "output": ""}
    results, passed, first_err = [], 0, None
    for i, t in enumerate(tests):
        res = run_sql(query, setup=spec["schema"] + "\n" + t.get("data", ""))
        got = _last_table(res)
        ok = not res.get("error") and _same_table(got, t["expected"], bool(spec.get("ordered")))
        passed += ok
        item = {"index": i + 1, "passed": ok, "sample": bool(t.get("sample")), "input": f"Dataset {i + 1}"}
        if res.get("error"):
            item["error"] = res["error"]
            first_err = first_err or res["error"]
        if t.get("sample") or which == "sample":
            item["expected"] = t["expected"]
            item["output"] = got
        results.append(item)
    total = len(tests)
    verdict = "Accepted" if passed == total else ("Runtime Error" if first_err and passed == 0 else "Wrong Answer")
    return {"verdict": verdict, "passed": passed, "total": total, "results": results, "error": first_err, "output": ""}


def compute_sql_expected(schema: str, reference_sql: str, tests: list) -> list:
    out = []
    for i, t in enumerate(tests):
        res = run_sql(reference_sql, setup=schema + "\n" + t.get("data", ""))
        table = _last_table(res)
        if res.get("error") or table is None:
            raise SpecError(f"reference query failed on dataset {i + 1}: {res.get('error')}")
        out.append({"data": t.get("data", ""), "sample": bool(t.get("sample")),
                    "expected": {"columns": table["columns"], "rows": table["rows"]}})
    if not any(t["sample"] for t in out):
        out[0]["sample"] = True
    return out


# ---------------------------------------------------------------------------
# Starter code (what the editor shows before the learner types)
# ---------------------------------------------------------------------------
PY_T = {"int": "int", "long": "int", "double": "float", "bool": "bool", "string": "str",
        "int[]": "List[int]", "long[]": "List[int]", "double[]": "List[float]", "bool[]": "List[bool]",
        "string[]": "List[str]", "int[][]": "List[List[int]]", "string[][]": "List[List[str]]",
        "ListNode": "Optional[ListNode]", "TreeNode": "Optional[TreeNode]", "void": "None"}
JS_T = {"int": "number", "long": "number", "double": "number", "bool": "boolean", "string": "string",
        "int[]": "number[]", "long[]": "number[]", "double[]": "number[]", "bool[]": "boolean[]",
        "string[]": "string[]", "int[][]": "number[][]", "string[][]": "string[][]",
        "ListNode": "ListNode", "TreeNode": "TreeNode", "void": "void"}


def starter_code(spec: dict, language: str) -> str:
    if spec.get("kind") == "sql":
        return "-- Write your SQL query below\nSELECT\n"
    sig = spec["signature"]
    fn, params, ret = sig["function"], sig["params"], sig["returns"]
    uses = {p["type"] for p in params} | {ret}
    if language == "python":
        notes = []
        if "ListNode" in uses:
            notes.append("# Definition for a linked list node:\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next")
        if "TreeNode" in uses:
            notes.append("# Definition for a binary tree node:\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right")
        args = ", ".join(f"{p['name']}: {PY_T[p['type']]}" for p in params)
        body = "        # Change the list in place; nothing to return.\n        pass" if ret == "void" else "        pass"
        return ("from typing import List, Optional\n\n" + ("\n\n".join(notes) + "\n\n" if notes else "") +
                f"class Solution:\n    def {fn}(self, {args}) -> {PY_T[ret]}:\n{body}\n")
    if language == "java":
        notes = []
        if "ListNode" in uses:
            notes.append("/**\n * Definition for a linked list node:\n * class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }\n */")
        if "TreeNode" in uses:
            notes.append("/**\n * Definition for a binary tree node:\n * class TreeNode { int val; TreeNode left, right; TreeNode(int val) { this.val = val; } }\n */")
        args = ", ".join(f"{JAVA_TYPES[p['type']]} {p['name']}" for p in params)
        return ("import java.util.*;\n\n" + ("\n".join(notes) + "\n" if notes else "") +
                f"class Solution {{\n    public {JAVA_TYPES[ret]} {fn}({args}) {{\n        \n    }}\n}}\n")
    if language == "javascript":
        doc = "\n".join(f" * @param {{{JS_T[p['type']]}}} {p['name']}" for p in params)
        ret_doc = f" * @return {{{JS_T[ret]}}}" if ret != "void" else " * @return {void} Change the array in place."
        names = ", ".join(p["name"] for p in params)
        return f"/**\n{doc}\n{ret_doc}\n */\nvar {fn} = function({names}) {{\n    \n}};\n"
    return ""
