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
        'os.system', 'os.exec', 'os.spawn', 'os.posix_spawn', 'os.fork', 'os.kill',
        'subprocess.Popen', 'open', 'os.listdir', 'os.scandir', 'os.remove', 'os.rename',
        'socket.', 'urllib.Request', 'sys._getframe', 'ctypes.', 'code.__new__',
    ]
    if any(event.startswith(b) for b in blocked_events):
        raise RuntimeError(f"Sandbox violation: Action {event} is restricted.")

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
    ast.MatchAs, ast.MatchOr, ast.comprehension, ast.arg, ast.arguments, ast.keyword, ast.alias,
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

# Special methods students legitimately write or call (e.g. super().__init__()).
# Everything else that starts with "__" (__class__, __base__, __subclasses__,
# __globals__, __dict__, __code__ ...) stays blocked, since those are escape routes.
SAFE_DUNDERS = {
    '__init__', '__str__', '__repr__', '__len__', '__iter__', '__next__',
    '__contains__', '__getitem__', '__setitem__', '__delitem__', '__call__',
    '__eq__', '__ne__', '__lt__', '__le__', '__gt__', '__ge__', '__hash__',
    '__add__', '__sub__', '__mul__', '__truediv__', '__floordiv__', '__mod__',
    '__neg__', '__bool__', '__enter__', '__exit__', '__name__',
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

    def visit_Constant(self, node):
        if isinstance(node.value, str) and ('.__' in node.value or '{0._' in node.value):
            self.errors.append("Security Policy Violation: dunder access inside strings is blocked")
        self.generic_visit(node)

    def visit_Attribute(self, node):
        attr = getattr(node, 'attr', '')
        if attr.startswith('__') and attr not in SAFE_DUNDERS:
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

    def _check_name(name):
        if not isinstance(name, str) or name.startswith('_'):
            raise AttributeError("Access to private or dunder attributes is blocked in this sandbox.")
        return name

    def safe_getattr(obj, name, *default):
        return getattr(obj, _check_name(name), *default)

    def safe_setattr(obj, name, value):
        return setattr(obj, _check_name(name), value)

    def safe_delattr(obj, name):
        return delattr(obj, _check_name(name))

    def safe_hasattr(obj, name):
        return hasattr(obj, _check_name(name))

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
        'hasattr': safe_hasattr,
        'getattr': safe_getattr,
        'setattr': safe_setattr,
        'delattr': safe_delattr,
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
        'object': object,
        'super': super,
        'property': property,
        'staticmethod': staticmethod,
        'classmethod': classmethod,
        'iter': iter,
        'next': next,
        'chr': chr,
        'ord': ord,
        'slice': slice,
        'frozenset': frozenset,
        'callable': callable,
        'format': format,
        'bin': bin,
        'hex': hex,
        'AttributeError': AttributeError,
        'RuntimeError': RuntimeError,
        'StopIteration': StopIteration,
        'NotImplementedError': NotImplementedError,
        'ArithmeticError': ArithmeticError,
        'LookupError': LookupError,
        '__build_class__': __builtins__.__build_class__ if hasattr(__builtins__, '__build_class__') else __builtins__['__build_class__'],
        '__import__': safe_import,
    }

    safe_globals = {
        '__builtins__': safe_builtins,
        '__name__': '__main__',
    }

    compiled_code = compile(tree, '<string>', 'exec')
    sys.addaudithook(security_audit_hook)  # from here on: no files, processes or sockets

    # Execute
    try:
        exec(compiled_code, safe_globals)
    except BaseException as e:  # noqa: BLE001 - report every failure as a clean message
        line = None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == '<string>':
                line = tb.tb_lineno
            tb = tb.tb_next
        where = f" (line {line})" if line else ""
        sys.stderr.write(f"{type(e).__name__}{where}: {e}\n")
        sys.exit(1)

if __name__ == '__main__':
    main()
