import sys
import os
import io
import ast
import traceback
import contextlib

# Force clear environment
os.environ.clear()

def security_audit_hook(event, args):
    blocked_events = [
        'os.system', 'os.exec', 'os.spawn', 'subprocess.Popen',
        'socket.connect', 'socket.bind', 'socket.sendmsg', 'socket.sendto',
        'urllib.Request', 'sys._getframe'
    ]
    if any(event.startswith(b) for b in blocked_events):
        raise RuntimeError(f"Sandbox violation: Action {event} is restricted.")

try:
    sys.addaudithook(security_audit_hook)
except Exception:
    pass

ALLOWED_NODES = {
    ast.Module, ast.Interactive, ast.Expression, ast.FunctionType,
    ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Return,
    ast.Delete, ast.Assign, ast.TypeAlias, ast.AugAssign, ast.AnnAssign,
    ast.For, ast.AsyncFor, ast.While, ast.If, ast.With, ast.AsyncWith,
    ast.Match, ast.Raise, ast.Try, ast.TryStar, ast.Assert, ast.Import,
    ast.ImportFrom, ast.Global, ast.Nonlocal, ast.Expr, ast.Pass, ast.Break,
    ast.Continue, ast.BoolOp, ast.NamedExpr, ast.BinOp, ast.UnaryOp, ast.Lambda,
    ast.IfExp, ast.Dict, ast.Set, ast.ListComp, ast.SetComp, ast.DictComp,
    ast.GeneratorExp, ast.Await, ast.Yield, ast.YieldFrom, ast.Compare,
    ast.Call, ast.FormattedValue, ast.JoinedStr, ast.Constant,
    ast.Attribute, ast.Subscript, ast.Starred, ast.Name, ast.List, ast.Tuple,
    ast.Slice, ast.Load, ast.Store, ast.Del, ast.And, ast.Or, ast.Add, ast.Sub,
    ast.Mult, ast.MatMult, ast.Div, ast.Mod, ast.Pow, ast.LShift, ast.RShift,
    ast.BitOr, ast.BitXor, ast.BitAnd, ast.FloorDiv, ast.Invert, ast.Not,
    ast.UAdd, ast.USub, ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Is, ast.IsNot, ast.In, ast.NotIn, ast.MatchValue, ast.MatchSingleton,
    ast.MatchSequence, ast.MatchMapping, ast.MatchClass, ast.MatchStar,
    ast.MatchAs, ast.MatchOr, ast.arg, ast.arguments, ast.keyword, ast.alias,
    ast.withitem, ast.match_case, ast.TypeVar, ast.ParamSpec, ast.TypeVarTuple
}

BLOCKED_BUILTINS = {
    '__import__', 'eval', 'exec', 'open', 'globals', 'locals', 
    'compile', 'input'
}

BLOCKED_MODULES = {
    'os', 'sys', 'subprocess', 'shlex', 'pty', 'socket', 'urllib',
    'http', 'multiprocessing', 'threading', 'concurrent', 'asyncio',
    'importlib', 'ctypes', 'inspect', 'sysconfig', 'pathlib'
}

class SecurityAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.errors = []
        
    def generic_visit(self, node):
        if type(node) not in ALLOWED_NODES:
            self.errors.append(f"Disallowed AST node: {type(node).__name__}")
        super().generic_visit(node)
        
    def visit_Import(self, node):
        for alias in node.names:
            base_module = alias.name.split('.')[0]
            if base_module in BLOCKED_MODULES:
                self.errors.append(f"Security Policy Violation: Importing '{alias.name}' is blocked")
        self.generic_visit(node)
        
    def visit_ImportFrom(self, node):
        if node.module:
            base_module = node.module.split('.')[0]
            if base_module in BLOCKED_MODULES:
                self.errors.append(f"Security Policy Violation: Importing from '{node.module}' is blocked")
        self.generic_visit(node)
        
    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load) and node.id in BLOCKED_BUILTINS:
            self.errors.append(f"Security Policy Violation: Use of builtin '{node.id}' is blocked")
        self.generic_visit(node)
        
    def visit_Attribute(self, node):
        if getattr(node, 'attr', '').startswith('__'):
            self.errors.append(f"Security Policy Violation: Accessing dunder attributes '{node.attr}' is blocked")
        self.generic_visit(node)

def main():
    if len(sys.argv) < 2:
        print("Error: No code file provided", file=sys.stderr)
        sys.exit(1)
        
    file_path = sys.argv[1]
    with open(file_path, 'r', encoding='utf-8') as f:
        code_string = f.read()

    # Step 1: AST Analysis
    try:
        tree = ast.parse(code_string)
    except SyntaxError as e:
        print(f"SyntaxError: {e}", file=sys.stderr)
        sys.exit(1)
        
    analyzer = SecurityAnalyzer()
    analyzer.visit(tree)
    if analyzer.errors:
        for err in analyzer.errors:
            print(err, file=sys.stderr)
        sys.exit(1)

    # Step 2: Set up restricted globals
    import math
    import collections
    import itertools
    import random
    import datetime

    ALLOWED_IMPORTS = {
        'math': math,
        'collections': collections,
        'itertools': itertools,
        'random': random,
        'datetime': datetime
    }

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        base_name = name.split('.')[0]
        if base_name in ALLOWED_IMPORTS:
            return ALLOWED_IMPORTS[base_name]
        raise ImportError(f"Importing module '{name}' is blocked in this sandbox.")

    safe_builtins = {
        'print': print,
        'range': range,
        'len': len,
        'int': int,
        'str': str,
        'list': list,
        'dict': dict,
        'set': set,
        'tuple': tuple,
        'bool': bool,
        'float': float,
        'sum': sum,
        'min': min,
        'max': max,
        'abs': abs,
        'Exception': Exception,
        'ValueError': ValueError,
        'TypeError': TypeError,
        'KeyError': KeyError,
        'IndexError': IndexError,
        'ZeroDivisionError': ZeroDivisionError,
        'enumerate': enumerate,
        'zip': zip,
        'map': map,
        'filter': filter,
        'isinstance': isinstance,
        'issubclass': issubclass,
        'type': type,
        'hasattr': hasattr,
        'getattr': getattr,
        'setattr': setattr,
        'delattr': delattr,
        'dir': dir,
        'id': id,
        'repr': repr,
        'hash': hash,
        'sorted': sorted,
        'reversed': reversed,
        'round': round,
        'pow': pow,
        'divmod': divmod,
        'all': all,
        'any': any,
        '__import__': safe_import,
    }

    safe_globals = {
        '__builtins__': safe_builtins,
    }

    # Execute
    try:
        compiled_code = compile(tree, '<string>', 'exec')
        exec(compiled_code, safe_globals)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
