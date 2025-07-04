# Deno introduction

Deno is an alternative to node.js. It is a command line tool that can install packages, and execute typescript or wasm. It addditionally has built-in dev tooling around linting, formatting, and testing, removing the need for configuring these manually

# Do I need to install deno to run anode?

Not directly. This anode repository is a traditional node-based application. It uses traditional nodejs paradigms, (the only difference is using pnpm instead of npm for managing packages).

However, once you launch anode, you'll need to connect it to a runtime agent to execute python code. For example, the given command of `NOTEBOOK_ID=notebook-abc-123 deno run --allow-all --env-file=.env "jsr:@runt/pyodide-runtime-agent"` uses deno for this part of the application. For local development, you'll probably run the runtime agent with deno on the same machine, otherwise it could be run on a completely different computer.

# What kinds of files can you run with deno?

Deno supports subsets of web standards (think import package), promises, async/await. So, if your package is regular typescript, this will probably work out-of-the box.

However, deno won't run Node code out of the box. If you're writing a deno-native package, this means making a series of source code transformations. So, instead of `import { promises as fs } from 'fs';`, you need to change the code to use the node shim layer of deno, which would be `import * as fs from 'node:fs/promises';`

Similarly, the `npm` package repository is not natively supported. Instead of `import React from react`, you would need to use `import React from npm:react`

# Permission model

When you start the deno runtime, you need to specify on the command line what types of permissions the app should be allowed to have (defaults to none). For example `deno --allow-net` would give the program the ability to bind network sockets. You should give the [security docs](https://docs.deno.com/runtime/fundamentals/security/) a read to understand how this works

# NPM, JSR, and Deno Land

These are all package repositories. JSR is a superset of npm - it contains packages that work for the node runtime, as well as deno, cloudflare workers etc. JSR itself will be responsible for transpiling any typescript-only package to work for javascript-only runtimes (node)

The difference between deno.land and jsr is that deno.land is a caching service behind some 3rd party URL. For example, you can publish a package to github, and have it cached on deno. Since deno.land doesn't maintain ownership, this means if the underlying host changes, then deno.land will change as well.

Another interesting thing that comes from deno understanding typescript is that we don't _need_ to bundle the imports. We can just `import React from https://esm.sh/react` (using the built in ecmascript standards) to pull the package remotely

# Where do I learn more?

- [What is Deno](https://docs.deno.com/examples/what_is_deno/)
- [Video Tutorial series](https://www.youtube.com/watch?v=KPTOo4k8-GE&list=PLvvLnBDNuTEov9EBIp3MMfHlBxaKGRWTe&index=1)
- [Runt codebase](https://github.com/runtimed/runt)
