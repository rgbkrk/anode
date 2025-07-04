# Pyodide Introduction

Pyodide allows you to run python code in a javascript runtime environment. To understand exactly how that works, let's quickly review how the CPython program works under normal circumstances. CPython is written in C as its source code. The code is then compiled into assembly (x86-64 or arm64), additionally targeting your operating system (linux, mac, etc), and that produces the final `python` binary. When you run `python script.py`, these assembly instructions know how to parse and execute script.py, providing a runtime that implements things like `os.open` and other API's

Now let's look at what happens for pyodide. We start with the same C source code in CPython. However, instead of targeting a specific assembly & operating system, pyodide targets web assembly as the compilation target. This resulting binary can't execute on its own, but needs to run from an engine (like your web browser or deno) which can execute web assembly. However, once that happens, then python can once again parse a `script.py` file and execute it.

The net result is that a browser can load up Pyodide, and then parse and handle a .py file in a similar manner as normal Python.

Beyond this simple introduction there's some extra advantages to Pyodide (javascript interaction), and some disadvantages (package availability, system interactions) that we'll cover later

# LLVM, Enscriptem, and WASI

When we say "generate webassembly" that's hiding a lot of complexity under the covers. If you're interested in reading a more detailed description, I would start with a [WASI overview](https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/), and Cloudflare's [python worker post](https://blog.cloudflare.com/python-workers/)

The very beginning of the compilation process is standardized. We start with the C source code, and then use the LLVM ecosystem to begin compilation. LLVM is a system where you have various frontends that understand the source code (like CLang for C), a standardized intermediate format (LLVM IR), and then a backend to produce the target code. If you're already using LLVM to build CPython nomally, then the first part is already done.

Enscriptem is a backend which takes the IR and generates webassembly. In addition, enscriptem created its own libc implementation that diverts some of the system-calling code back to the javascript land to use with browser api's.

This leads to a very non-portable mechanism where the compiled program is directly tied to how the system calls are supposed to work. The WASI implementation was made to standardize this, however that's not what pyodide uses.

# Javascript glue

Python has always had a way to interact with other languages - this is how you can call C code from python for example. Pyodide's implementation also generates modules that interact with the browser, which is then made available to python code using the [FFI](https://pyodide.org/en/stable/usage/api/python-api/ffi.html#module-pyodide.ffi). This bridge works in both directions, so you can use python code to interact with javascript and the other way around.

Different environments expose these wrappers a bit differently. For example, in pyscript one uses `from pyscript import window, document`, and in cloudflare workers it's `from js import document` but these are all built on top of what pyodide provides

# Python package availability

Python packages also can contain compiled code. The same challenges apply and they won't work in web assembly without cross-compiling them. That is why pyodide has a specific list of packages it cross compiles. This step is not needed if the package is pure python & available via a wheel file.

# System compatibility

Aside from cross-compiling, the underlying environments are just different. Cloudflare's blog has a lot more details, but for example the async programming model, access to raw sockets, filesystems and more are different in a browser environment as opposed to a raw machine. This is why other packages just aren't available at all, or require [source code changes](https://github.com/cloudflare/pyodide/blob/main/packages/httpx/httpx_patch.py) to adapt a package to working in a browser environment, regardless of the fact that it's in web assembly.

# Browsers, deno, and workers

Pyodide by itself just provides the mechanism to cross-compile python and other packages. It doesn't actually run the code itself. That's where a runtime comes in. For pyscript, this means your browser. For cloudflare it means their worker system. For anode, it means loading pyodide in deno.

# Learn more

- [WASI overview](https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/)
- [Cloudflare's python worker post](https://blog.cloudflare.com/python-workers/)
- [Urllib3 and webassembly](https://urllib3.readthedocs.io/en/stable/reference/contrib/emscripten.html)
- [Pyscript introduction](https://www.anaconda.com/blog/pyscript-python-in-the-browser)
