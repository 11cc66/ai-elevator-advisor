import path from "node:path";

import ts from "typescript";

const SCRIPT_TYPES = new Map([
  [".bat", "cmd"],
  [".bash", "shell"],
  [".command", "shell"],
  [".cjs", "javascript"],
  [".cmd", "cmd"],
  [".js", "javascript"],
  [".ksh", "shell"],
  [".mjs", "javascript"],
  [".ps1", "powershell"],
  [".psm1", "powershell"],
  [".sh", "shell"],
  [".ts", "javascript"],
  [".tsx", "javascript"],
  [".zsh", "shell"],
]);

const UNVERIFIED_SCRIPT_EXTENSIONS = new Set([
  ".fish",
  ".php",
  ".pl",
  ".py",
  ".rb",
]);

const EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".p13-build",
  ".p13-releases",
  "build",
  "coverage",
  "dist",
  "docs",
  "node_modules",
  "out",
  "test-results",
  "tests",
]);

const JS_PROCESS_FUNCTIONS = new Set([
  "exec",
  "execFile",
  "execFileSync",
  "execSync",
  "fork",
  "spawn",
  "spawnSync",
]);

const CHILD_PROCESS_MODULES = new Set([
  "child_process",
  "node:child_process",
]);

const PATH_MODULES = new Set(["node:path", "path"]);

const SAFE_JS_COMMANDS = new Set([
  "cmd.exe",
  "node",
  "node.exe",
  "npm",
  "npx",
  "pnpm",
  "powershell",
  "powershell.exe",
  "pwsh",
  "sh",
  "tsx",
  "yarn",
]);

const SHELL_WRAPPERS = new Set([
  "bash",
  "dash",
  "sh",
  "zsh",
]);

const SUSPICIOUS_RUNTIME_PATH =
  /(?:^|[/\\])(?:worker-entry|dist[/\\]index)(?:\.[cm]?js|\.ts)?(?:$|["'\s])/i;

const JAVASCRIPT_ANALYSIS_LIMITS = Object.freeze({
  maxAstNodes: 100_000,
  maxAbstractStates: 100_000,
  maxDepth: 32,
  maxMilliseconds: 1_500,
});

function normalizePath(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function fileExtension(relativePath) {
  const normalized = normalizePath(relativePath);
  const index = normalized.lastIndexOf(".");
  return index < 0 ? "" : normalized.slice(index).toLowerCase();
}

export function scriptTypeForPath(relativePath) {
  return SCRIPT_TYPES.get(fileExtension(relativePath)) ?? null;
}

export function isRelevantExecutableScript(relativePath) {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  if (
    segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))
  ) {
    return false;
  }
  const scriptType = scriptTypeForPath(normalized);
  if (
    normalized.startsWith("apps/") ||
    normalized.startsWith("scripts/")
  ) {
    if (!scriptType) {
      return (
        segments.includes("scripts") &&
        (fileExtension(normalized) === "" ||
          UNVERIFIED_SCRIPT_EXTENSIONS.has(
            fileExtension(normalized),
          ))
      );
    }
    if (scriptType !== "javascript") {
      return true;
    }
    return segments.includes("scripts");
  }
  return false;
}

function finding(
  code,
  relativePath,
  message,
  classification,
  scriptType,
  line = undefined,
) {
  return {
    code,
    file: relativePath,
    message,
    classification,
    scriptType,
    ...(line === undefined ? {} : { line }),
  };
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (content[offset] === "\n") {
      line += 1;
    }
  }
  return line;
}

function stripJavaScriptComments(content) {
  let output = "";
  let state = "code";
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (state === "line-comment") {
      if (character === "\n") {
        state = "code";
        output += character;
      } else {
        output += " ";
      }
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += character === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (state === "single-quote") {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "'") {
        state = "code";
      }
      continue;
    }
    if (state === "double-quote") {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        state = "code";
      }
      continue;
    }
    if (state === "template") {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "`") {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
      continue;
    }
    if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
      continue;
    }
    output += character;
    if (character === "'") {
      state = "single-quote";
    } else if (character === '"') {
      state = "double-quote";
    } else if (character === "`") {
      state = "template";
    }
  }
  return output;
}

function stripLineComments(content, marker) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      let escaped = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (character === "\\") {
          escaped = true;
          continue;
        }
        if (character === "'" && !inDouble) {
          inSingle = !inSingle;
          continue;
        }
        if (character === '"' && !inSingle) {
          inDouble = !inDouble;
          continue;
        }
        if (
          !inSingle &&
          !inDouble &&
          line.startsWith(marker, index)
        ) {
          return line.slice(0, index);
        }
      }
      return line;
    })
    .join("\n");
}

function stripPowerShellComments(content) {
  let output = content.replace(/<#[\s\S]*?#>/g, (value) =>
    value.replace(/[^\n]/g, " "),
  );
  output = stripLineComments(output, "#");
  return output;
}

function stripCmdComments(content) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart();
      if (
        /^@?rem(?:\s|$)/i.test(trimmed) ||
        trimmed.startsWith("::")
      ) {
        return "";
      }
      return line;
    })
    .join("\n");
}

function quotedValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractAssignments(content, pattern) {
  const values = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match?.[1] && match?.[2] !== undefined) {
      const value = quotedValue(match[2]);
      values.set(
        match[1],
        /\$(?:[A-Za-z_{0-9@*#?])/.test(value)
          ? `@@${match[1]}@@`
          : value,
      );
    }
  }
  return values;
}

function extractCmdAssignments(content) {
  const values = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(
      /^\s*@?set\s+(?:"([A-Za-z_][A-Za-z0-9_]*)=([^"]*)"|([A-Za-z_][A-Za-z0-9_]*)=(.*))$/i,
    );
    if (!match) {
      continue;
    }
    const name = match[1] ?? match[3];
    const value = match[2] ?? match[4] ?? "";
    if (name) {
      values.set(
        name.toUpperCase(),
        /(?:%|!)[A-Za-z0-9_*]+(?:%|!)/.test(value)
          ? `@@${name}@@`
          : value,
      );
    }
  }
  return values;
}

function expandShellVariables(value, variables) {
  return value.replace(
    /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g,
    (whole, braced, plain) => {
      const name = braced ?? plain;
      return variables.get(name) ?? `@@${name}@@`;
    },
  );
}

function expandPowerShellVariables(value, variables) {
  return value.replace(
    /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g,
    (whole, braced, plain) => {
      const name = braced ?? plain;
      return variables.get(name) ?? `@@${name}@@`;
    },
  );
}

function expandCmdVariables(value, variables) {
  return value
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (whole, name) => {
      return variables.get(name.toUpperCase()) ?? `@@${name}@@`;
    })
    .replace(/!([A-Za-z_][A-Za-z0-9_]*)!/g, (whole, name) => {
      return variables.get(name.toUpperCase()) ?? `@@${name}@@`;
    })
    .replace(/%([0-9*])/g, (whole, name) => {
      return `@@ARG${name}@@`;
    });
}

function commandSegments(line) {
  const segments = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (";|&(){}".includes(character)) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) {
    segments.push(current.trim());
  }
  return segments.map((segment) =>
    segment
      .replace(/^(?:then|do|else)\s+/i, "")
      .trim(),
  );
}

function firstWord(value) {
  return value.match(/^@?["']?([^\s"'=]+)["']?/)?.[1]?.toLowerCase();
}

function directNextStart(value) {
  return /(?:^|(?:&&|\|\||[;|&]))\s*(?:(?:command|exec|nohup|sudo|time|xargs)\s+)*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:env(?:\s+\S+=\S+)*\s+)?(?:(?:pnpm|npm|yarn|bunx|npx|corepack)(?:\s+exec)?\s+)?next\s+start(?:\s|$)/i.test(
    value,
  );
}

function directWorkerDist(value) {
  return /(?:^|(?:&&|\|\||[;|&]))\s*(?:(?:command|exec|nohup|sudo|time|xargs)\s+)*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:env(?:\s+\S+=\S+)*\s+)?["']?node(?:\.exe)?["']?\s+(?:--\S+\s+)*[^;&|\r\n]*?\bdist[\\/]index\.js\b/i.test(
    value,
  );
}

function shellTokens(value) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (escaped) {
    current += "\\";
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function wrapperExecutableFromTokens(tokens) {
  tokens = [...tokens];
  for (let index = 0; index < tokens.length; index += 1) {
    if (path.basename(tokens[index]).toLowerCase() !== "env") {
      continue;
    }
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const option = tokens[cursor];
      let splitValue = null;
      let consumed = 1;
      if (option === "-S" || option === "--split-string") {
        splitValue = tokens[cursor + 1] ?? null;
        consumed = 2;
      } else if (option.startsWith("--split-string=")) {
        splitValue = option.slice("--split-string=".length);
      } else if (option.startsWith("-S") && option.length > 2) {
        splitValue = option.slice(2);
      }
      if (splitValue === null || splitValue === undefined) {
        if (!option.startsWith("-")) {
          break;
        }
        continue;
      }
      const expanded = shellTokens(splitValue);
      if (expanded.length === 0) {
        return null;
      }
      tokens.splice(cursor, consumed, ...expanded);
      cursor += expanded.length - 1;
    }
  }
  let index = 0;
  let stdinForwarded = true;
  const wrapperNames = [];
  const takeOptionValue = new Set([
    "-C",
    "-D",
    "-E",
    "-L",
    "-a",
    "-c",
    "--chdir",
    "--chroot",
    "--close-from",
    "-d",
    "-g",
    "--group",
    "-h",
    "-I",
    "-k",
    "-n",
    "-o",
    "-P",
    "-p",
    "--prompt",
    "-s",
    "-T",
    "-u",
    "--user",
    "--role",
    "--type",
  ]);
  function commandName(value) {
    return path.basename(value).toLowerCase();
  }
  function skipOptions(valueOptions, noValueOptions = []) {
    const consumesValue = new Set(valueOptions);
    const consumesNoValue = new Set(noValueOptions);
    while (index < tokens.length && tokens[index].startsWith("-")) {
      const option = tokens[index].toLowerCase();
      if (consumesNoValue.has(option)) {
        index += 1;
      } else if (consumesValue.has(option)) {
        index += 2;
      } else {
        index += 1;
      }
    }
  }
  while (index < tokens.length) {
    const token = commandName(tokens[index]);
    if (/^[a-z_][a-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (token === "command") {
      wrapperNames.push(token);
      index += 1;
      skipOptions([], ["-p", "-v", "-V"]);
      continue;
    }
    if (token === "exec") {
      wrapperNames.push(token);
      index += 1;
      skipOptions(["-a", "--argv0"], ["-c", "-l"]);
      continue;
    }
    if (token === "nice") {
      wrapperNames.push(token);
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        const option = tokens[index].toLowerCase();
        if (option === "-n" || option === "--adjustment") {
          index += 2;
        } else {
          index += 1;
        }
      }
      continue;
    }
    if (token === "stdbuf") {
      wrapperNames.push(token);
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        const option = tokens[index].toLowerCase();
        if (
          ["-i", "-o", "-e"].includes(option) &&
          index + 1 < tokens.length &&
          !tokens[index + 1].startsWith("-")
        ) {
          index += 2;
        } else {
          index += 1;
        }
      }
      continue;
    }
    if (["nohup", "time"].includes(token)) {
      wrapperNames.push(token);
      index += 1;
      skipOptions([], ["-p"]);
      continue;
    }
    if (token === "env") {
      wrapperNames.push(token);
      index += 1;
      while (index < tokens.length) {
        const option = tokens[index];
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(option)) {
          index += 1;
          continue;
        }
        if (option.startsWith("-")) {
          index += takeOptionValue.has(option) ? 2 : 1;
          continue;
        }
        break;
      }
      continue;
    }
    if (token === "sudo") {
      wrapperNames.push(token);
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        index += takeOptionValue.has(tokens[index]) ? 2 : 1;
      }
      continue;
    }
    if (token === "timeout") {
      wrapperNames.push(token);
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        index += takeOptionValue.has(tokens[index]) ? 2 : 1;
      }
      index += 1;
      continue;
    }
    if (token === "xargs") {
      wrapperNames.push(token);
      stdinForwarded = false;
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        index += takeOptionValue.has(tokens[index]) ? 2 : 1;
      }
      continue;
    }
    if (token === "find") {
      wrapperNames.push(token);
      const execIndex = tokens.findIndex(
        (item) =>
          item.toLowerCase() === "-exec" ||
          item.toLowerCase() === "-execdir",
      );
      if (execIndex < 0) {
        return null;
      }
      stdinForwarded = false;
      index = execIndex + 1;
      continue;
    }
    break;
  }
  if (index >= tokens.length) {
    return null;
  }
  const executable = path.basename(tokens[index]).toLowerCase();
  return {
    executable,
    index,
    stdinForwarded,
    tokens,
    wrapperNames,
  };
}

function wrapperPayloadFromTokens(tokens) {
  const resolved = wrapperExecutableFromTokens(tokens);
  if (!resolved) {
    return null;
  }
  const { executable } = resolved;
  tokens = resolved.tokens;
  let index = resolved.index;
  if (
    ![
      "bash",
      "cmd",
      "cmd.exe",
      "dash",
      "powershell",
      "powershell.exe",
      "pwsh",
      "sh",
      "zsh",
    ].includes(executable)
  ) {
    return null;
  }
  index += 1;
  for (; index < tokens.length; index += 1) {
    const token = tokens[index].toLowerCase();
    const embeddedCommand =
      token !== "-command"
        ? tokens[index].match(/^-[a-z]*c([\s\S]+)$/i)
        : null;
    if (embeddedCommand?.[1]) {
      return embeddedCommand[1];
    }
    const commandFlag =
      /^-[a-z]*c[a-z]*$/i.test(tokens[index]) ||
      token === "--command" ||
      token === "/c";
    if (!commandFlag) {
      continue;
    }
    let payloadIndex = index + 1;
    if (tokens[payloadIndex] === "--") {
      payloadIndex += 1;
    }
    return tokens[payloadIndex] ?? null;
  }
  return null;
}

function wrapperCommand(value) {
  return wrapperPayloadFromTokens(shellTokens(value));
}

function wrapperCommandIncomplete(value) {
  const tokens = shellTokens(value);
  const resolved = wrapperExecutableFromTokens(tokens);
  if (
    !resolved ||
    !SHELL_WRAPPERS.has(resolved.executable)
  ) {
    return false;
  }
  const resolvedTokens = resolved.tokens;
  for (
    let index = resolved.index + 1;
    index < resolvedTokens.length;
    index += 1
  ) {
    const token = resolvedTokens[index].toLowerCase();
    const commandFlag =
      /^-[a-z]*c[a-z]*$/i.test(token) ||
      token === "--command" ||
      token === "/c";
    if (!commandFlag) {
      continue;
    }
    let payloadIndex = index + 1;
    if (resolvedTokens[payloadIndex] === "--") {
      payloadIndex += 1;
    }
    return payloadIndex >= resolvedTokens.length;
  }
  return false;
}

function executableTextDanger(value) {
  return {
    nextStart: directNextStart(value),
    workerDist: directWorkerDist(value),
  };
}

function nestedShellPayloads(value) {
  const payloads = [];
  for (const match of value.matchAll(/\$\(([^()]*)\)/g)) {
    payloads.push(match[1]);
  }
  for (const match of value.matchAll(/`([^`]*)`/g)) {
    payloads.push(match[1]);
  }
  const wrapper = wrapperCommand(value);
  if (wrapper) {
    payloads.push(wrapper);
  }
  if (/^\s*eval\s+/i.test(value)) {
    payloads.push(
      value
        .replace(/^\s*eval\s+/i, "")
        .replace(/^(["'])([\s\S]*)\1$/, "$2"),
    );
  }
  return payloads;
}

function shellHeredocDescriptor(value) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (!value.startsWith("<<", index) || value.startsWith("<<<", index)) {
      continue;
    }
    let cursor = index + 2;
    const stripTabs = value[cursor] === "-";
    if (stripTabs) {
      cursor += 1;
    }
    while (value[cursor] === " " || value[cursor] === "\t") {
      cursor += 1;
    }
    let delimiterQuote = null;
    if (value[cursor] === "'" || value[cursor] === '"') {
      delimiterQuote = value[cursor];
      cursor += 1;
    }
    const match = value
      .slice(cursor)
      .match(delimiterQuote ? /^[^'"]+/ : /^[A-Za-z0-9_.-]+/);
    if (!match) {
      return {
        invalid: true,
        lineIndex: index,
      };
    }
    return {
      index,
      stripTabs,
      delimiter: match[0],
      delimiterQuote,
      endIndex: cursor + match[0].length,
    };
  }
  return null;
}

function splitShellPipeline(value) {
  const stages = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "|") {
      if (value[index - 1] === "|" || value[index + 1] === "|") {
        current += character;
        continue;
      }
      if (current.trim()) {
        stages.push(current.trim());
      }
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) {
    stages.push(current.trim());
  }
  return stages;
}

function shellStageInformation(stage) {
  const tokens = shellTokens(stage);
  const resolved = wrapperExecutableFromTokens(tokens);
  if (resolved?.wrapperNames.includes("xargs")) {
    return { shell: false, executable: "xargs" };
  }
  if (!resolved || !SHELL_WRAPPERS.has(resolved.executable)) {
    return {
      shell: false,
      executable:
        resolved?.executable ??
        path.basename(tokens[0] ?? "").toLowerCase(),
    };
  }
  return {
    shell: true,
    payload: wrapperCommand(stage),
    stdinForwarded: resolved.stdinForwarded,
  };
}

function xargsStdinExecutionMode(stage) {
  const tokens = shellTokens(stage);
  const xargsIndex = tokens.findIndex(
    (token) =>
      path.basename(token).toLowerCase() === "xargs",
  );
  if (xargsIndex < 0) {
    return null;
  }
  let index = xargsIndex + 1;
  let replacement = null;
  while (index < tokens.length && tokens[index].startsWith("-")) {
    const option = tokens[index];
    if (option === "-I" || option === "--replace") {
      replacement = tokens[index + 1] ?? null;
      index += 2;
      continue;
    }
    if (option.startsWith("-I") && option.length > 2) {
      replacement = option.slice(2);
      index += 1;
      continue;
    }
    if (option.startsWith("--replace=")) {
      replacement = option.slice("--replace=".length);
      index += 1;
      continue;
    }
    index += 1;
  }
  if (index >= tokens.length) {
    return "unknown";
  }
  const commandTokens = tokens.slice(index);
  const resolvedCommand = wrapperExecutableFromTokens(commandTokens);
  if (
    !resolvedCommand ||
    !SHELL_WRAPPERS.has(resolvedCommand.executable)
  ) {
    if (
      replacement &&
      commandTokens[0]?.includes(replacement)
    ) {
      return "unknown";
    }
    return "data";
  }
  const payload = wrapperPayloadFromTokens(commandTokens);
  if (payload === null) {
    return "data";
  }
  if (replacement && payload.includes(replacement)) {
    return "execute";
  }
  return "data";
}

function shellStdinExecutionMode(value, depth = 0) {
  if (depth > 8) {
    return "unknown";
  }
  if (/@@|\$(?:[A-Za-z_{0-9@*#?])/.test(value)) {
    return "unknown";
  }
  const stages = splitShellPipeline(value);
  if (stages.length === 0) {
    return "data";
  }
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    const information = shellStageInformation(stage);
    if (information.shell) {
      if (!information.stdinForwarded) {
        continue;
      }
      if (information.payload) {
        const nested = shellStdinExecutionMode(
          information.payload,
          depth + 1,
        );
        if (nested !== "data") {
          return nested;
        }
        continue;
      }
      return "execute";
    }
    if (information.executable === "xargs") {
      const xargsMode = xargsStdinExecutionMode(stage);
      if (xargsMode !== null && xargsMode !== "data") {
        return xargsMode;
      }
      continue;
    }
    if (
      [
        "awk",
        "cat",
        "cut",
        "dd",
        "grep",
        "head",
        "sed",
        "sort",
        "tail",
        "tee",
        "tr",
        "uniq",
        "wc",
      ].includes(information.executable)
    ) {
      continue;
    }
    if (index === 0) {
      continue;
    }
    return "unknown";
  }
  return "data";
}

function shellHeredocExecutionMode(commandLine, descriptor) {
  const prefix = commandLine.slice(0, descriptor.index).trim();
  const suffix = commandLine
    .slice(
      (descriptor.endIndex ?? descriptor.index + 2) +
        (descriptor.delimiterQuote ? 1 : 0),
    )
    .trim();
  const first = firstWord(
    prefix.replace(
      /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/,
      "",
    ),
  );
  if (SHELL_WRAPPERS.has(first ?? "")) {
    return "execute";
  }
  if (first === "eval") {
    return "unknown";
  }
  if (!suffix) {
    return "data";
  }
  if (!suffix.startsWith("|")) {
    return "unknown";
  }
  return shellStdinExecutionMode(`${prefix} ${suffix}`);
}

function shellExecutableLines(
  relativePath,
  content,
  findings,
) {
  const sourceLines = content.split(/\r?\n/);
  const executableLines = [];
  let activeHeredoc = null;
  for (let index = 0; index < sourceLines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = sourceLines[index];
    if (activeHeredoc) {
      let candidate = activeHeredoc.stripTabs
        ? rawLine.replace(/^\t+/, "")
        : rawLine;
      if (candidate.trim() === activeHeredoc.delimiter) {
        activeHeredoc = null;
        continue;
      }
      if (activeHeredoc.executeBody) {
        executableLines.push({ line: lineNumber, text: candidate });
      }
      continue;
    }
    executableLines.push({ line: lineNumber, text: rawLine });
    const descriptor = shellHeredocDescriptor(rawLine);
    if (!descriptor) {
      continue;
    }
    if (descriptor.invalid) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_HEREDOC",
          relativePath,
          "Shell Here-doc delimiter cannot be resolved statically.",
          "UNKNOWN",
          "shell",
          lineNumber,
        ),
      );
      continue;
    }
    if (
      rawLine.indexOf("<<", descriptor.endIndex ?? 0) >= 0
    ) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_HEREDOC",
          relativePath,
          "Multiple simultaneous Here-docs cannot be fully analyzed.",
          "UNKNOWN",
          "shell",
          lineNumber,
        ),
      );
    }
    const executionMode = shellHeredocExecutionMode(
      rawLine,
      descriptor,
    );
    if (executionMode === "unknown") {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_HEREDOC_EXECUTION",
          relativePath,
          "Here-doc execution semantics cannot be determined.",
          "UNKNOWN",
          "shell",
          lineNumber,
        ),
      );
    }
    activeHeredoc = {
      ...descriptor,
      executeBody: executionMode === "execute",
      openerLine: lineNumber,
    };
  }
  if (activeHeredoc) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_HEREDOC",
        relativePath,
        "Shell Here-doc is not terminated.",
        "UNKNOWN",
        "shell",
        activeHeredoc.openerLine,
      ),
    );
  }
  return executableLines;
}

function shellPayloadDanger(value, variables, depth = 0) {
  if (depth > 8) {
    return { nextStart: false, workerDist: false, unknown: true };
  }
  const expanded = expandShellVariables(value, variables);
  const dangerous = executableTextDanger(expanded);
  let unknown =
    /@@[A-Za-z_][A-Za-z0-9_]*@@|\$(?:[0-9@*#?])/.test(
      expanded,
    ) || wrapperCommandIncomplete(expanded);
  for (const payload of nestedShellPayloads(expanded)) {
    const nested = shellPayloadDanger(
      payload,
      variables,
      depth + 1,
    );
    dangerous.nextStart ||= nested.nextStart;
    dangerous.workerDist ||= nested.workerDist;
    unknown ||= nested.unknown;
  }
  return { ...dangerous, unknown };
}

function scanShell(
  relativePath,
  content,
  findings,
) {
  const scriptType = "shell";
  const executableLines = shellExecutableLines(
    relativePath,
    content,
    findings,
  );
  const withoutComments = stripLineComments(content, "#");
  const variables = extractAssignments(
    withoutComments,
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/,
  );
  for (const executableLine of executableLines) {
    const lineNumber = executableLine.line;
    const expanded = stripLineComments(
      executableLine.text.replace(/\\\r?$/,''),
      "#",
    );
    for (const segment of commandSegments(expanded)) {
      if (/^\s*alias\s+/i.test(segment)) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_COMMAND_ALIAS",
            relativePath,
            "Shell alias prevents complete command resolution.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
      const payloadDanger = shellPayloadDanger(segment, variables);
      if (payloadDanger.nextStart) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_NEXT_START",
            relativePath,
            "Shell script invokes next start.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      if (payloadDanger.workerDist) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "Shell script invokes a Worker dist entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      const dynamicExec = [
        ".",
        "command",
        "eval",
        "exec",
        "source",
        "xargs",
      ].includes(firstWord(segment) ?? "");
      const evalHasNestedCode =
        firstWord(segment) === "eval" &&
        nestedShellPayloads(segment).length > 0;
      if (
        payloadDanger.unknown ||
        (dynamicExec &&
          /@@|\$(?:[0-9@*#?])/.test(segment)) ||
        evalHasNestedCode
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "Shell command execution cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
  }
}

function powerShellSubexpressions(value) {
  const expressions = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] !== "$" || value[index + 1] !== "(") {
      continue;
    }
    let cursor = index + 2;
    let depth = 1;
    let quote = null;
    let escaped = false;
    for (; cursor < value.length; cursor += 1) {
      const character = value[cursor];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "`") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          expressions.push(value.slice(index + 2, cursor));
          index = cursor;
          break;
        }
      }
    }
    if (depth !== 0) {
      expressions.push(null);
      break;
    }
  }
  return expressions;
}

function powerShellConstructedExpressionMode(expression) {
  if (expression === null || /@@/.test(expression)) {
    return "unknown";
  }
  const normalized = quotedValue(expression.trim());
  const nextStart =
    directNextStart(normalized) ||
    /&\s*(?:\{[^}]*\})?[\s\S]{0,400}\bnext\b[\s\S]{0,120}\bstart\b/i.test(
      normalized,
    ) ||
    /\bStart-Process\b[\s\S]{0,500}\bnext\b[\s\S]{0,200}\bstart\b/i.test(
      normalized,
    );
  const workerDist =
    directWorkerDist(normalized) ||
    /&\s*(?:\{[^}]*\})?[\s\S]{0,500}\bnode(?:\.exe)?\b[\s\S]{0,300}\bdist[\\/]index\.js\b/i.test(
      normalized,
    ) ||
    /\bStart-Process\b[\s\S]{0,500}\bnode(?:\.exe)?\b[\s\S]{0,500}\bdist[\\/]index\.js\b/i.test(
      normalized,
    );
  if (nextStart) {
    return "next-start";
  }
  if (workerDist) {
    return "worker-dist";
  }
  if (
    /(?:^|[;|{(]\s*)(?:Invoke-Expression|iex|Invoke-Command)\b/i.test(
      normalized,
    ) ||
    /(?:^|[;|{(]\s*)[.&]\s+\$/i.test(normalized) ||
    /\$\([^)]+\)/.test(normalized)
  ) {
    return "unknown";
  }
  if (
    /\[scriptblock\]::Create/i.test(normalized) &&
    /\b(?:Get-Content|Get-Item|gc|cat|type)\b/i.test(normalized)
  ) {
    return "unknown";
  }
  return "safe";
}

function extractPowerShellHereStrings(
  relativePath,
  content,
  findings,
) {
  const lines = content.split(/\r?\n/);
  const output = [];
  const values = new Map();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const opener = line.match(/(?:^|\s)@(['"])\s*$/);
    if (!opener) {
      output.push(line);
      index += 1;
      continue;
    }
    const quote = opener[1];
    const assignment = line.match(
      /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*@['"]\s*$/,
    );
    const openerPrefix = line.replace(/@['"]\s*$/, "");
    const openerLine = index + 1;
    const bodyLines = [];
    index += 1;
    let closingSuffix = null;
    while (index < lines.length) {
      const closing = lines[index].match(/^(['"])@(.*)$/);
      if (closing && closing[1] === quote) {
        closingSuffix = closing[2] ?? "";
        break;
      }
      bodyLines.push(lines[index]);
      index += 1;
    }
    if (closingSuffix === null) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_HERESTRING",
          relativePath,
          "PowerShell Here-string is not terminated.",
          "UNKNOWN",
          "powershell",
          openerLine,
        ),
      );
      break;
    }
    const body = bodyLines.join("\n");
    if (quote === '"') {
      for (const expression of powerShellSubexpressions(body)) {
        const mode = powerShellConstructedExpressionMode(expression);
        if (mode === "next-start" || mode === "worker-dist") {
          findings.push(
            finding(
              mode === "next-start"
                ? "SCRIPT_DIRECT_NEXT_START"
                : "SCRIPT_DIRECT_WORKER_DIST",
              relativePath,
              "PowerShell double-quoted Here-string executes a forbidden startup entry during interpolation.",
              "DANGEROUS",
              "powershell",
              openerLine,
            ),
          );
        } else if (mode === "unknown") {
          findings.push(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
              relativePath,
              "PowerShell Here-string interpolation cannot be resolved statically.",
              "UNKNOWN",
              "powershell",
              openerLine,
            ),
          );
        }
      }
    }
    const executableSuffix =
      /\b(?:Invoke-Expression|iex|Invoke-Command)\b|(?:^|\s)&\s/i.test(
        closingSuffix,
      );
    const executablePrefix =
      /\b(?:Invoke-Expression|iex|Invoke-Command)\b|(?:^|\s)&\s/i.test(
        openerPrefix,
      );
    if (assignment?.[1]) {
      const name = assignment[1];
      const value =
        quote === '"' && /\$(?:[A-Za-z_{0-9@*#?])/.test(body)
          ? `@@PS_HEREDOC_${name}@@`
          : body;
      values.set(name, value);
      output.push(`$${name} = "@@PS_HEREDOC_${name}@@"`);
    }
    if (executableSuffix || executablePrefix) {
      output.push(...bodyLines);
    }
    if (!assignment?.[1] && closingSuffix.trim()) {
      output.push(`${quote}@${closingSuffix}`);
    }
    index += 1;
  }
  return {
    content: output.join("\n"),
    values,
  };
}

function normalizePowerShellBuiltinAliases(value, overridden) {
  const aliases = new Map([
    ["cat", "Get-Content"],
    ["dir", "Get-ChildItem"],
    ["gc", "Get-Content"],
    ["gci", "Get-ChildItem"],
    ["icm", "Invoke-Command"],
    ["iex", "Invoke-Expression"],
    ["ls", "Get-ChildItem"],
    ["type", "Get-Content"],
  ]);
  return value.replace(
    /(^|[|;{(]\s*)([A-Za-z][A-Za-z0-9_-]*)\b/g,
    (whole, prefix, command) => {
      const replacement = aliases.get(command.toLowerCase());
      if (!replacement || overridden.has(command.toLowerCase())) {
        return whole;
      }
      return `${prefix}${replacement}`;
    },
  );
}

function splitPowerShellConcatenation(value) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "`") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    }
    if (character === "+" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts;
}

function powerShellStringLiteralValue(value) {
  const quote = value[0];
  if (quote !== "'" && quote !== '"') {
    return null;
  }
  let result = "";
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index];
    if (character === "`") {
      if (index + 1 < value.length) {
        result += value[index + 1];
        index += 1;
      }
      continue;
    }
    if (character === quote) {
      if (value[index + 1] === quote) {
        result += quote;
        index += 1;
        continue;
      }
      return index === value.length - 1 ? result : null;
    }
    result += character;
  }
  return null;
}

function evaluatePowerShellStringExpression(
  expression,
  variables,
  depth = 0,
) {
  if (!expression || depth > 16) {
    return null;
  }
  let value = expression.trim();
  while (
    value.startsWith("(") &&
    value.endsWith(")")
  ) {
    value = value.slice(1, -1).trim();
  }
  const parts = splitPowerShellConcatenation(value);
  if (parts.length > 1) {
    let result = "";
    for (const part of parts) {
      const resolved = evaluatePowerShellStringExpression(
        part,
        variables,
        depth + 1,
      );
      if (resolved === null) {
        return null;
      }
      result += resolved;
    }
    return result;
  }
  const literal = powerShellStringLiteralValue(value);
  if (literal !== null) {
    return literal;
  }
  const variable = value.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
  if (variable?.[1]) {
    return variables.get(variable[1]) ?? null;
  }
  return null;
}

function extractBalancedPowerShellCreateArgument(value) {
  const match = /\[scriptblock\]::Create\s*\(/i.exec(value);
  if (!match || match.index === undefined) {
    return null;
  }
  const open = match.index + match[0].lastIndexOf("(");
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = open + 1; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "`") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(open + 1, index);
      }
    }
  }
  return null;
}

function powerShellStructureStatus(content) {
  const pairs = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "`") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (content[index + 1] === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "#") {
      lineComment = true;
      continue;
    }
    if (character === "{" || character === "(") {
      pairs.push(character);
    } else if (character === "}" || character === ")") {
      const expected = character === "}" ? "{" : "(";
      if (pairs.pop() !== expected) {
        return { complete: false, reason: "mismatched delimiter" };
      }
    }
  }
  if (quote) {
    return { complete: false, reason: "unterminated string" };
  }
  if (pairs.length > 0) {
    return { complete: false, reason: "unclosed delimiter" };
  }
  return { complete: true, reason: null };
}

function sanitizePowerShellHereStrings(content) {
  const output = [];
  let hereStringQuote = null;
  for (const line of content.split(/\r?\n/)) {
    if (hereStringQuote) {
      if (
        new RegExp(
          `^\\s*${hereStringQuote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@`,
        ).test(line)
      ) {
        hereStringQuote = null;
      }
      output.push("");
      continue;
    }
    const opener = line.match(/@(['"])\s*$/);
    if (opener?.[1]) {
      hereStringQuote = opener[1];
      output.push("");
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function extractPowerShellFunctionBodies(content) {
  const functions = new Map();
  const pattern =
    /\bfunction\s+(?:global:)?([A-Za-z][A-Za-z0-9_-]*)(?:\s*\([^)]*\))?\s*\{/gi;
  for (const match of content.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }
    const open = match.index + match[0].lastIndexOf("{");
    let depth = 1;
    let quote = null;
    let escaped = false;
    for (let index = open + 1; index < content.length; index += 1) {
      const character = content[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "`") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          functions.set(match[1].toLowerCase(), content.slice(open + 1, index));
          break;
        }
      }
    }
  }
  return functions;
}

function extractPowerShellAliasTargets(content) {
  const aliases = new Map();
  for (const match of content.matchAll(
    /\b(?:Set|New)-Alias\s+(?:-Name\s+)?["']?([A-Za-z][A-Za-z0-9_-]*)["']?\s+(?:-Value\s+)?["']?([A-Za-z][A-Za-z0-9_.-]*)["']?/gi,
  )) {
    aliases.set(match[1].toLowerCase(), match[2]);
  }
  for (const match of content.matchAll(
    /\b(?:Set|New)-Item\s+-Path\s+["']?Alias:([A-Za-z][A-Za-z0-9_-]*)["']?\s+-Value\s+["']?([A-Za-z][A-Za-z0-9_.-]*)["']?/gi,
  )) {
    aliases.set(match[1].toLowerCase(), match[2]);
  }
  return aliases;
}

function normalizePowerShellCustomAliases(value, aliases) {
  return value.replace(
    /(^|[|;{(]\s*)([A-Za-z][A-Za-z0-9_-]*)\b/g,
    (whole, prefix, command) =>
      aliases.has(command.toLowerCase())
        ? `${prefix}${aliases.get(command.toLowerCase())}`
        : whole,
  );
}

function strictPowerShellBase64Payload(payload) {
  if (
    !payload ||
    payload.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(payload) ||
    /=/.test(payload.slice(0, -2))
  ) {
    return null;
  }
  const bytes = Buffer.from(payload, "base64");
  if (bytes.toString("base64") !== payload) {
    return null;
  }
  if (bytes.length === 0) {
    return null;
  }
  try {
    const decoded =
      bytes.includes(0) && bytes.length % 2 === 0
        ? bytes.toString("utf16le").replace(/\0/g, "")
        : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded.trim().length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function decodePowerShellEncodedCommands(content) {
  const commands = [];
  for (const match of content.matchAll(
    /\b(?:pwsh|powershell)(?:\.exe)?\b[^\r\n]*?\s-(?:EncodedCommand|ec|e)\s+['"]?([^\s"']+)/gi,
  )) {
    commands.push({
      decoded: strictPowerShellBase64Payload(match[1]),
    });
  }
  return commands;
}

const POWERSHELL_SEMANTIC_POLICY_VERSION = "a7.18.1";
const POWERSHELL_SEMANTIC_LIMITS = Object.freeze({
  maxExpressionDepth: 32,
  maxPropertyChainDepth: 32,
  maxMethodChainDepth: 16,
  maxAliases: 2_000,
  maxObjectProperties: 2_000,
  maxFunctionDepth: 16,
  maxAbstractStates: 50_000,
  maxMilliseconds: 1_500,
});

const POWERHELL_KNOWN_UNKNOWN_SOURCE_COMMANDS = new Set([
  "get-content",
  "get-item",
  "get-objectwithunknowncomparer",
  "get-psobjectwithcasecollidingmembers",
  "get-random",
  "get-remotescript",
  "get-remote",
  "read-host",
]);

const POWERSHELL_NON_OUTPUT_COMMANDS = new Set([
  "out-null",
  "write-error",
  "write-host",
]);

function psCanonicalName(value) {
  return value.toLowerCase();
}

function psStableDigest(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function psSemanticTokenize(content) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let unsupportedReason = null;

  function push(type, value, tokenLine = line, extra = {}) {
    tokens.push({ type, value, line: tokenLine, ...extra });
  }

  function readQuotedString(quote) {
    const startLine = line;
    let value = "";
    let dynamic = false;
    index += 1;
    while (index < content.length) {
      const character = content[index];
      if (character === quote) {
        if (content[index + 1] === quote) {
          value += quote;
          index += 2;
          continue;
        }
        index += 1;
        break;
      }
      if (quote === '"' && character === "`") {
        if (index + 1 < content.length) {
          value += content[index + 1];
          index += 2;
          continue;
        }
      }
      if (quote === '"' && character === "$") {
        dynamic = true;
      }
      if (character === "\n") {
        line += 1;
      }
      value += character;
      index += 1;
    }
    push("string", value, startLine, {
      dynamic,
      quote,
    });
  }

  while (index < content.length) {
    const character = content[index];
    const next = content[index + 1];
    if (character === " " || character === "\t" || character === "\f") {
      index += 1;
      continue;
    }
    if (character === "\r") {
      index += content[index + 1] === "\n" ? 2 : 1;
      line += 1;
      push("newline", "\n");
      continue;
    }
    if (character === "\n") {
      index += 1;
      line += 1;
      push("newline", "\n");
      continue;
    }
    if (character === "#") {
      while (index < content.length && content[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (character === "<" && next === "#") {
      index += 2;
      while (
        index < content.length &&
        !(content[index] === "#" && content[index + 1] === ">")
      ) {
        if (content[index] === "\n") {
          line += 1;
        }
        index += 1;
      }
      index = Math.min(index + 2, content.length);
      continue;
    }
    if (
      (character === "@" && next === "'") ||
      (character === "@" && next === '"')
    ) {
      unsupportedReason ??= "PowerShell Here-string";
      const quote = next;
      index += 2;
      while (index < content.length) {
        if (
          content[index] === quote &&
          content[index + 1] === "@" &&
          (index === 0 || content[index - 1] === "\n")
        ) {
          index += 2;
          break;
        }
        if (content[index] === "\n") {
          line += 1;
        }
        index += 1;
      }
      push("unsupported", "Here-string", line);
      continue;
    }
    if (character === "'" || character === '"') {
      readQuotedString(character);
      continue;
    }
    if (character === "`") {
      if (next === "\n") {
        index += 2;
        line += 1;
        continue;
      }
      unsupportedReason ??= "PowerShell line continuation";
      index += Math.min(2, content.length - index);
      continue;
    }
    if (character === "$") {
      const tokenLine = line;
      let end = index + 1;
      if (content[end] === "{") {
        end += 1;
        while (end < content.length && content[end] !== "}") {
          end += 1;
        }
        if (content[end] === "}") {
          end += 1;
        } else {
          unsupportedReason ??= "Unterminated variable name";
        }
      } else {
        while (
          end < content.length &&
          /[A-Za-z0-9_:?]/.test(content[end])
        ) {
          end += 1;
        }
      }
      let raw = content.slice(index + 1, end);
      if (raw.startsWith("{") && raw.endsWith("}")) {
        raw = raw.slice(1, -1);
      }
      const colon = raw.indexOf(":");
      const scope = colon >= 0 ? raw.slice(0, colon).toLowerCase() : null;
      const name = colon >= 0 ? raw.slice(colon + 1) : raw;
      push("variable", name, tokenLine, {
        scope,
        raw: content.slice(index, end),
      });
      index = end;
      continue;
    }
    if (content.startsWith("2>&1", index)) {
      push("errorRedirect", "2>&1");
      index += 4;
      continue;
    }
    if (content.startsWith("::", index)) {
      push("symbol", "::");
      index += 2;
      continue;
    }
    if (content.startsWith("+=", index)) {
      push("symbol", "+=");
      index += 2;
      continue;
    }
    if (/[0-9]/.test(character)) {
      const start = index;
      const tokenLine = line;
      while (index < content.length && /[0-9.]/.test(content[index])) {
        index += 1;
      }
      push("number", content.slice(start, index), tokenLine);
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = index;
      const tokenLine = line;
      while (
        index < content.length &&
        /[A-Za-z0-9_-]/.test(content[index])
      ) {
        index += 1;
      }
      const value = content.slice(start, index);
      push(
        value.startsWith("-") ? "parameter" : "identifier",
        value,
        tokenLine,
      );
      continue;
    }
    if (character === "-" && /[A-Za-z]/.test(next ?? "")) {
      const start = index;
      const tokenLine = line;
      index += 1;
      while (
        index < content.length &&
        /[A-Za-z0-9_-]/.test(content[index])
      ) {
        index += 1;
      }
      push("parameter", content.slice(start, index), tokenLine);
      continue;
    }
    if ("(){}[],;=+.|&!>".includes(character)) {
      push("symbol", character);
      index += 1;
      continue;
    }
    if (character === "@") {
      push("symbol", "@");
      index += 1;
      continue;
    }
    unsupportedReason ??= `Unsupported PowerShell token ${character}`;
    push("unsupported", character);
    index += 1;
  }
  push("eof", "");
  return {
    tokens,
    complete: unsupportedReason === null,
    unsupportedReason,
  };
}

class PowerShellSemanticParser {
  constructor(tokens, complete) {
    this.tokens = tokens;
    this.index = 0;
    this.complete = complete;
    this.error = null;
  }

  peek(offset = 0) {
    return this.tokens[
      Math.min(this.index + offset, this.tokens.length - 1)
    ];
  }

  consume() {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  matchSymbol(value) {
    const token = this.peek();
    if (token.type === "symbol" && token.value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expectSymbol(value) {
    if (this.matchSymbol(value)) {
      return true;
    }
    this.complete = false;
    this.error ??= `Expected ${value} at line ${this.peek().line}`;
    return false;
  }

  isIdentifier(value) {
    const token = this.peek();
    return (
      token.type === "identifier" &&
      token.value.toLowerCase() === value
    );
  }

  skipSeparators() {
    while (
      this.peek().type === "newline" ||
      (this.peek().type === "symbol" &&
        this.peek().value === ";")
    ) {
      this.index += 1;
    }
  }

  isBoundary() {
    const token = this.peek();
    return (
      token.type === "eof" ||
      token.type === "newline" ||
      token.type === "unsupported" ||
      (token.type === "symbol" &&
        [")", "}", "]", ",", ";"].includes(token.value))
    );
  }

  parseProgram() {
    this.skipSeparators();
    const statements = [];
    while (this.peek().type !== "eof") {
      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      }
      this.skipSeparators();
    }
    return {
      kind: "program",
      statements,
      complete: this.complete,
      error: this.error,
    };
  }

  parseStatement() {
    this.skipSeparators();
    const token = this.peek();
    if (token.type === "eof" || token.type === "unsupported") {
      if (token.type === "unsupported") {
        this.complete = false;
        this.consume();
      }
      return null;
    }
    if (this.isIdentifier("function")) {
      return this.parseFunctionDefinition();
    }
    if (this.isIdentifier("param")) {
      return {
        kind: "param",
        line: this.peek().line,
        parameters: this.parseParamList(),
      };
    }
    if (this.isIdentifier("if")) {
      return this.parseIf(false);
    }
    if (this.isIdentifier("switch")) {
      return this.parseSwitch();
    }
    if (this.isIdentifier("try")) {
      return this.parseTry();
    }
    if (this.isIdentifier("foreach")) {
      return this.parseForeach();
    }
    if (this.isIdentifier("while")) {
      return this.parseWhile();
    }
    if (this.isIdentifier("for")) {
      return this.parseFor();
    }
    if (this.isIdentifier("do")) {
      return this.parseDo();
    }
    if (this.isIdentifier("return")) {
      const returnToken = this.consume();
      const value = this.isBoundary()
        ? null
        : this.parseExpression();
      return {
        kind: "return",
        line: returnToken.line,
        value,
      };
    }
    if (
      this.isIdentifier("break") ||
      this.isIdentifier("continue")
    ) {
      const flowToken = this.consume();
      return {
        kind: flowToken.value.toLowerCase(),
        line: flowToken.line,
      };
    }

    const expression = this.parseExpression();
    if (
      this.peek().type === "symbol" &&
      (this.peek().value === "=" || this.peek().value === "+=")
    ) {
      const operator = this.consume();
      const value = this.parseExpression();
      return {
        kind: "assignment",
        line: operator.line,
        operator: operator.value,
        target: expression,
        value,
      };
    }
    return {
      kind: "expression",
      line: expression.line,
      expression,
    };
  }

  parseParamList(consumeKeyword = true) {
    if (consumeKeyword) {
      this.consume();
    }
    const parameters = [];
    this.expectSymbol("(");
    while (this.peek().type !== "eof" && !this.matchSymbol(")")) {
      if (this.matchSymbol("[")) {
        let depth = 1;
        while (depth > 0 && this.peek().type !== "eof") {
          if (this.matchSymbol("[")) {
            depth += 1;
          } else if (this.matchSymbol("]")) {
            depth -= 1;
          } else {
            this.consume();
          }
        }
      }
      if (this.peek().type === "variable") {
        parameters.push(this.consume());
      } else {
        this.consume();
      }
      this.skipSeparators();
      this.matchSymbol(",");
      this.skipSeparators();
    }
    return parameters;
  }

  parseFunctionDefinition() {
    const functionToken = this.consume();
    const nameToken = this.consume();
    if (nameToken.type !== "identifier") {
      this.complete = false;
      this.error ??= `Expected function name at line ${nameToken.line}`;
    }
    let parameters = [];
    if (this.peek().type === "symbol" && this.peek().value === "(") {
      parameters = this.parseParamList(false);
    }
    const body = this.parseBlock();
    return {
      kind: "function",
      line: functionToken.line,
      name: nameToken.value ?? "",
      parameters,
      body,
    };
  }

  parseBlock() {
    const open = this.peek();
    if (!this.expectSymbol("{")) {
      return {
        kind: "block",
        line: open.line,
        statements: [],
      };
    }
    const statements = [];
    this.skipSeparators();
    while (
      this.peek().type !== "eof" &&
      !(this.peek().type === "symbol" && this.peek().value === "}")
    ) {
      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      }
      this.skipSeparators();
    }
    this.expectSymbol("}");
    return {
      kind: "block",
      line: open.line,
      statements,
    };
  }

  parseCondition() {
    if (!this.expectSymbol("(")) {
      return {
        kind: "unknown",
        line: this.peek().line,
      };
    }
    const expression = this.parseExpression();
    this.expectSymbol(")");
    return expression;
  }

  parseIf(asExpression) {
    const ifToken = this.consume();
    const branches = [];
    branches.push({
      condition: this.parseCondition(),
      body: this.parseBlock(),
    });
    while (this.isIdentifier("elseif")) {
      this.consume();
      branches.push({
        condition: this.parseCondition(),
        body: this.parseBlock(),
      });
    }
    let elseBody = null;
    if (this.isIdentifier("else")) {
      this.consume();
      elseBody = this.parseBlock();
    }
    return {
      kind: asExpression ? "ifExpression" : "if",
      line: ifToken.line,
      branches,
      elseBody,
    };
  }

  parseSwitch() {
    const switchToken = this.consume();
    const selector = this.parseCondition();
    const cases = [];
    if (!this.expectSymbol("{")) {
      return {
        kind: "switch",
        line: switchToken.line,
        selector,
        cases,
        defaultBody: null,
      };
    }
    this.skipSeparators();
    while (
      this.peek().type !== "eof" &&
      !(this.peek().type === "symbol" && this.peek().value === "}")
    ) {
      if (this.isIdentifier("default")) {
        this.consume();
        cases.push({
          condition: null,
          body: this.parseBlock(),
        });
      } else {
        const condition = this.parseExpression();
        cases.push({
          condition,
          body: this.parseBlock(),
        });
      }
      this.skipSeparators();
    }
    this.expectSymbol("}");
    const defaultCase = cases.find((value) => value.condition === null);
    return {
      kind: "switch",
      line: switchToken.line,
      selector,
      cases: cases.filter((value) => value.condition !== null),
      defaultBody: defaultCase?.body ?? null,
    };
  }

  parseTry() {
    const tryToken = this.consume();
    const tryBody = this.parseBlock();
    const catchBodies = [];
    while (this.isIdentifier("catch")) {
      this.consume();
      if (this.matchSymbol("[")) {
        let depth = 1;
        while (depth > 0 && this.peek().type !== "eof") {
          if (this.matchSymbol("[")) {
            depth += 1;
          } else if (this.matchSymbol("]")) {
            depth -= 1;
          } else {
            this.consume();
          }
        }
      }
      catchBodies.push(this.parseBlock());
    }
    let finallyBody = null;
    if (this.isIdentifier("finally")) {
      this.consume();
      finallyBody = this.parseBlock();
    }
    return {
      kind: "try",
      line: tryToken.line,
      tryBody,
      catchBodies,
      finallyBody,
    };
  }

  parseForeach() {
    const loopToken = this.consume();
    this.expectSymbol("(");
    const variable =
      this.peek().type === "variable"
        ? this.consume()
        : {
            type: "variable",
            value: "__unknown__",
            scope: null,
            line: loopToken.line,
          };
    if (this.isIdentifier("in")) {
      this.consume();
    } else {
      this.complete = false;
    }
    const iterable = this.parseExpression();
    this.expectSymbol(")");
    return {
      kind: "loop",
      line: loopToken.line,
      variable,
      iterable,
      body: this.parseBlock(),
    };
  }

  parseWhile() {
    const loopToken = this.consume();
    const condition = this.parseCondition();
    return {
      kind: "loop",
      line: loopToken.line,
      variable: null,
      iterable: condition,
      body: this.parseBlock(),
    };
  }

  parseFor() {
    const loopToken = this.consume();
    this.expectSymbol("(");
    let depth = 1;
    while (depth > 0 && this.peek().type !== "eof") {
      if (this.matchSymbol("(")) {
        depth += 1;
      } else if (this.matchSymbol(")")) {
        depth -= 1;
      } else {
        this.consume();
      }
    }
    return {
      kind: "loop",
      line: loopToken.line,
      variable: null,
      iterable: {
        kind: "unknown",
        line: loopToken.line,
      },
      body: this.parseBlock(),
    };
  }

  parseDo() {
    const loopToken = this.consume();
    const body = this.parseBlock();
    let condition = null;
    if (this.isIdentifier("while") || this.isIdentifier("until")) {
      this.consume();
      condition = this.parseCondition();
    } else {
      this.complete = false;
    }
    return {
      kind: "loop",
      line: loopToken.line,
      variable: null,
      iterable: condition ?? {
        kind: "unknown",
        line: loopToken.line,
      },
      body,
    };
  }

  parseExpression(minimumPrecedence = 0) {
    let left = this.parsePrefix();
    left = this.parsePostfix(left);
    while (true) {
      const token = this.peek();
      if (token.type !== "symbol" || !["+", "|"].includes(token.value)) {
        break;
      }
      const precedence = token.value === "|" ? 1 : 5;
      if (precedence < minimumPrecedence) {
        break;
      }
      this.consume();
      const right = this.parseExpression(precedence + 1);
      left = {
        kind: token.value === "|" ? "pipeline" : "binary",
        line: token.line,
        operator: token.value,
        left,
        right,
      };
    }
    return left;
  }

  parsePrefix() {
    const token = this.peek();
    if (token.type === "symbol" && token.value === "&") {
      this.consume();
      const target = this.parsePostfix(this.parsePrimary());
      const args = this.parseCommandArguments();
      return {
        kind: "call",
        line: token.line,
        target,
        args,
      };
    }
    if (
      (token.type === "symbol" && token.value === "!") ||
      (token.type === "parameter" &&
        token.value.toLowerCase() === "-not")
    ) {
      this.consume();
      return {
        kind: "not",
        line: token.line,
        expression: this.parseExpression(8),
      };
    }
    const primary = this.parsePrimary();
    return primary;
  }

  parsePostfix(expression) {
    let current = expression;
    while (true) {
      if (this.matchSymbol(".")) {
        const member = this.consume();
        if (member.type !== "identifier") {
          this.complete = false;
          this.error ??= `Expected member name at line ${member.line}`;
          return current;
        }
        if (this.matchSymbol("(")) {
          const args = [];
          this.skipSeparators();
          while (
            this.peek().type !== "eof" &&
            !(this.peek().type === "symbol" &&
              this.peek().value === ")")
          ) {
            args.push(this.parseExpression());
            this.skipSeparators();
            if (!this.matchSymbol(",")) {
              break;
            }
            this.skipSeparators();
          }
          this.expectSymbol(")");
          current = {
            kind: "method",
            line: member.line,
            receiver: current,
            name: member.value,
            args,
          };
        } else {
          current = {
            kind: "member",
            line: member.line,
            receiver: current,
            name: member.value,
          };
        }
        continue;
      }
      if (this.matchSymbol("[")) {
        const indexExpression = this.parseExpression();
        this.expectSymbol("]");
        current = {
          kind: "index",
          line: indexExpression.line,
          receiver: current,
          index: indexExpression,
        };
        continue;
      }
      break;
    }
    return current;
  }

  parsePrimary() {
    const token = this.peek();
    if (token.type === "variable") {
      this.consume();
      return {
        kind: "variable",
        line: token.line,
        name: token.value,
        scope: token.scope,
        raw: token.raw,
      };
    }
    if (token.type === "string") {
      this.consume();
      return {
        kind: token.dynamic ? "unknown" : "literal",
        line: token.line,
        value: token.value,
        reason: token.dynamic ? "dynamic-string" : null,
      };
    }
    if (token.type === "number") {
      this.consume();
      return {
        kind: "literal",
        line: token.line,
        value: Number(token.value),
      };
    }
    if (token.type === "symbol" && token.value === "(") {
      this.consume();
      const expression = this.parseExpression();
      this.expectSymbol(")");
      return expression;
    }
    if (token.type === "symbol" && token.value === "@") {
      this.consume();
      if (this.matchSymbol("(")) {
        const elements = [];
        this.skipSeparators();
        while (
          this.peek().type !== "eof" &&
          !(this.peek().type === "symbol" &&
            this.peek().value === ")")
        ) {
          elements.push(this.parseExpression());
          this.skipSeparators();
          if (this.matchSymbol(",")) {
            this.skipSeparators();
          }
        }
        this.expectSymbol(")");
        return {
          kind: "array",
          line: token.line,
          elements,
        };
      }
      if (this.matchSymbol("{")) {
        return this.parseHashtable(token.line);
      }
      this.complete = false;
      return {
        kind: "unknown",
        line: token.line,
        reason: "unsupported-splat",
      };
    }
    if (token.type === "symbol" && token.value === "{") {
      const body = this.parseBlock();
      return {
        kind: "scriptblock",
        line: token.line,
        body,
      };
    }
    if (token.type === "symbol" && token.value === "[") {
      return this.parseTypeExpression();
    }
    if (
      token.type === "identifier" &&
      token.value.toLowerCase() === "if"
    ) {
      return this.parseIf(true);
    }
    if (token.type === "identifier") {
      return this.parseCommand();
    }
    if (token.type === "parameter") {
      this.consume();
      return {
        kind: "literal",
        line: token.line,
        value: token.value,
      };
    }
    this.complete = false;
    this.error ??= `Unsupported expression at line ${token.line}`;
    this.consume();
    return {
      kind: "unknown",
      line: token.line,
      reason: "unsupported-expression",
    };
  }

  parseHashtable(line) {
    const entries = [];
    this.skipSeparators();
    while (
      this.peek().type !== "eof" &&
      !(this.peek().type === "symbol" && this.peek().value === "}")
    ) {
      const keyToken = this.consume();
      if (!["identifier", "string", "number"].includes(keyToken.type)) {
        this.complete = false;
        this.error ??= `Unsupported hashtable key at line ${keyToken.line}`;
        break;
      }
      this.expectSymbol("=");
      const value = this.parseExpression();
      entries.push({
        key: String(keyToken.value),
        keyLine: keyToken.line,
        value,
      });
      this.skipSeparators();
      this.matchSymbol(",");
      this.skipSeparators();
    }
    this.expectSymbol("}");
    return {
      kind: "hashtable",
      line,
      entries,
    };
  }

  parseTypeExpression() {
    const open = this.consume();
    const typeToken = this.consume();
    if (!this.matchSymbol("]")) {
      this.complete = false;
    }
    const typeName = String(typeToken.value ?? "").toLowerCase();
    if (this.matchSymbol("::")) {
      const method = this.consume();
      if (method.type !== "identifier") {
        this.complete = false;
      }
      this.expectSymbol("(");
      const args = [];
      this.skipSeparators();
      while (
        this.peek().type !== "eof" &&
        !(this.peek().type === "symbol" && this.peek().value === ")")
      ) {
        args.push(this.parseExpression());
        this.skipSeparators();
        if (!this.matchSymbol(",")) {
          break;
        }
        this.skipSeparators();
      }
      this.expectSymbol(")");
      return {
        kind: "staticCall",
        line: open.line,
        typeName,
        method: String(method.value ?? "").toLowerCase(),
        args,
      };
    }
    if (
      typeName === "pscustomobject" &&
      this.peek().type === "symbol" &&
      this.peek().value === "@"
    ) {
      this.consume();
      if (this.matchSymbol("{")) {
        return {
          ...this.parseHashtable(open.line),
          kind: "customObject",
        };
      }
    }
    return {
      kind: "unknown",
      line: open.line,
      reason: `unsupported-type-${typeName}`,
    };
  }

  parseCommand() {
    const commandToken = this.consume();
    const args = this.parseCommandArguments();
    return {
      kind: "command",
      line: commandToken.line,
      name: commandToken.value,
      args,
    };
  }

  parseCommandArguments() {
    const args = [];
    let hasErrorRedirect = false;
    while (!this.isBoundary()) {
      if (this.peek().type === "errorRedirect") {
        this.consume();
        hasErrorRedirect = true;
        continue;
      }
      if (
        this.peek().type === "symbol" &&
        (this.peek().value === "." ||
          this.peek().value === "|" ||
          this.peek().value === "=" ||
          this.peek().value === "+=")
      ) {
        break;
      }
      if (this.peek().type === "parameter") {
        const parameter = this.consume();
        let value = null;
        if (!this.isBoundary()) {
          value = this.parseArgumentExpression();
        }
        args.push({
          kind: "namedArgument",
          line: parameter.line,
          name: parameter.value,
          value,
        });
        continue;
      }
      args.push(this.parseArgumentExpression());
    }
    if (hasErrorRedirect) {
      args.push({
        kind: "errorRedirect",
        line: this.peek().line,
      });
    }
    return args;
  }

  parseArgumentExpression() {
    const token = this.peek();
    if (token.type === "identifier") {
      this.consume();
      return {
        kind: "literal",
        line: token.line,
        value: token.value,
      };
    }
    return this.parsePrefix();
  }
}

function psParseSemanticPowerShell(content) {
  const lexical = psSemanticTokenize(content);
  const parser = new PowerShellSemanticParser(
    lexical.tokens,
    lexical.complete,
  );
  const program = parser.parseProgram();
  return {
    ...program,
    complete:
      lexical.complete &&
      program.complete &&
      program.error === null,
    unsupportedReason:
      lexical.unsupportedReason ?? program.error ?? null,
  };
}

function psSecurityRank(state) {
  return {
    SAFE: 0,
    UNKNOWN: 1,
    DANGEROUS: 2,
    ERROR: 3,
  }[state] ?? 1;
}

function psMergeSecurity(...states) {
  let result = "SAFE";
  for (const state of states) {
    if (psSecurityRank(state) > psSecurityRank(result)) {
      result = state;
    }
  }
  return result;
}

function psValueSignature(value) {
  if (value.kind === "scalar") {
    return `scalar:${typeof value.value}:${String(value.value)}`;
  }
  if (value.kind === "scriptblock") {
    return `scriptblock:${value.id}:${value.securityState}`;
  }
  if (value.kind === "closure") {
    return `closure:${value.id}`;
  }
  if (
    value.kind === "objectRef" ||
    value.kind === "arrayRef"
  ) {
    return `${value.kind}:${value.id}`;
  }
  return `${value.kind}:${value.reason ?? ""}`;
}

function psUnionValues(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const signature = psValueSignature(value);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(value);
    }
  }
  return result;
}

function psCloneValues(values) {
  return psUnionValues(values.map((value) => ({ ...value })));
}

function psScalar(value) {
  return {
    kind: "scalar",
    value,
  };
}

function psUnknown(reason = "unknown-value") {
  return {
    kind: "unknown",
    reason,
  };
}

function psErrorValue(reason = "semantic-error") {
  return {
    kind: "error",
    reason,
  };
}

function psValueSecurity(value) {
  if (value.kind === "scriptblock") {
    return value.securityState ?? "UNKNOWN";
  }
  if (value.kind === "unknown") {
    return "UNKNOWN";
  }
  if (value.kind === "error") {
    return "ERROR";
  }
  return "SAFE";
}

function psValuesSecurity(values) {
  return values.reduce(
    (state, value) =>
      psMergeSecurity(state, psValueSecurity(value)),
    "SAFE",
  );
}

function psDescribeValue(value) {
  if (value.kind === "scriptblock") {
    if (
      Array.isArray(value.candidateStates) &&
      new Set(value.candidateStates).size > 1
    ) {
      return `VALUE_UNION(${value.candidateStates
        .map((state) => `SCRIPTBLOCK(${state})`)
        .join(", ")})`;
    }
    return `SCRIPTBLOCK(${value.securityState})`;
  }
  if (value.kind === "closure") {
    return `CLOSURE(${value.securityState ?? "UNKNOWN"})`;
  }
  if (value.kind === "objectRef") {
    return `OBJECT_REF(${value.id})`;
  }
  if (value.kind === "arrayRef") {
    return `ARRAY_REF(${value.id})`;
  }
  if (value.kind === "scalar") {
    return `SCALAR(${String(value.value)})`;
  }
  if (value.kind === "error") {
    return "ERROR";
  }
  return "UNKNOWN";
}

function psDescribeValues(values) {
  if (values.length === 0) {
    return "EMPTY_SUCCESS_STREAM";
  }
  const descriptions = values.map(psDescribeValue);
  return descriptions.length === 1
    ? descriptions[0]
    : `VALUE_UNION(${descriptions.join(", ")})`;
}

function psAddSemanticFinding(
  context,
  code,
  line,
  message,
  classification,
) {
  const duplicate = context.findings.some(
    (value) =>
      value.code === code &&
      value.line === line &&
      value.classification === classification,
  );
  if (!duplicate) {
    context.findings.push(
      finding(
        code,
        context.relativePath,
        message,
        classification,
        "powershell",
        line,
      ),
    );
  }
}

function psMarkAnalysisState(runtime, state) {
  runtime.analysisState = psMergeSecurity(
    runtime.analysisState,
    state,
  );
  return runtime.analysisState;
}

function psFailBudget(runtime, reason) {
  if (!runtime.meta.budgetErrorReported) {
    runtime.meta.budgetErrorReported = true;
    psAddSemanticFinding(
      runtime.context,
      "SCRIPT_POWERSHELL_SEMANTIC_ERROR",
      1,
      `PowerShell semantic analysis budget exhausted: ${reason}.`,
      "ERROR",
    );
  }
  runtime.complete = false;
  runtime.fatalError = true;
  psMarkAnalysisState(runtime, "ERROR");
}

function psCharge(runtime, states = 1) {
  runtime.meta.abstractStates += states;
  if (
    runtime.meta.abstractStates >
      runtime.meta.limits.maxAbstractStates
  ) {
    psFailBudget(runtime, "abstract-state limit");
    return false;
  }
  if (Date.now() > runtime.meta.deadline) {
    psFailBudget(runtime, "time limit");
    return false;
  }
  return true;
}

function psCreateRuntime(context, complete = true) {
  return {
    context,
    meta: context.meta,
    frames: [
      {
        id: context.meta.nextFrameId++,
        kind: "global",
        bindings: new Map(),
      },
      {
        id: context.meta.nextFrameId++,
        kind: "script",
        bindings: new Map(),
      },
    ],
    locations: new Map(),
    functions: new Map(),
    aliases: new Map(),
    complete,
    fatalError: false,
    analysisState: "SAFE",
    functionDepth: 0,
  };
}

function psCloneBindings(bindings) {
  return new Map(
    [...bindings].map(([key, values]) => [
      key,
      psCloneValues(values),
    ]),
  );
}

function psCloneLocation(location) {
  if (location.kind === "object") {
    return {
      ...location,
      properties: new Map(
        [...location.properties].map(([key, value]) => [
          key,
          {
            ...value,
            values: psCloneValues(value.values),
          },
        ]),
      ),
    };
  }
  return {
    ...location,
    elements: new Map(
      [...location.elements].map(([key, values]) => [
        key,
        psCloneValues(values),
      ]),
    ),
  };
}

function psCloneRuntime(runtime) {
  return {
    ...runtime,
    frames: runtime.frames.map((frame) => ({
      ...frame,
      bindings: psCloneBindings(frame.bindings),
    })),
    locations: new Map(
      [...runtime.locations].map(([id, location]) => [
        id,
        psCloneLocation(location),
      ]),
    ),
    functions: new Map(runtime.functions),
    aliases: new Map(runtime.aliases),
  };
}

function psCurrentFrame(runtime) {
  return runtime.frames[runtime.frames.length - 1];
}

function psFindScopedFrame(runtime, kind) {
  if (kind === "local") {
    return psCurrentFrame(runtime);
  }
  return runtime.frames.find((frame) => frame.kind === kind) ?? null;
}

function psGetBindingValues(bindings, canonicalName) {
  return bindings.get(canonicalName);
}

function psBind(runtime, scope, name, values) {
  const canonical = psCanonicalName(name);
  if (scope && !["local", "script", "global"].includes(scope)) {
    return [psUnknown(`unsupported-scope-${scope}`)];
  }
  const frame =
    scope === "script"
      ? psFindScopedFrame(runtime, "script")
      : scope === "global"
        ? psFindScopedFrame(runtime, "global")
        : psCurrentFrame(runtime);
  if (!frame) {
    runtime.complete = false;
    return [psUnknown(`missing-${scope ?? "local"}-scope`)];
  }
  frame.bindings.set(canonical, psUnionValues(values));
  runtime.meta.environmentGeneration += 1;
  return values;
}

function psReadVariable(runtime, node) {
  const lower = psCanonicalName(node.name ?? "");
  if (!node.scope || node.scope === "local") {
    if (lower === "true") {
      return [psScalar(true)];
    }
    if (lower === "false") {
      return [psScalar(false)];
    }
    if (lower === "null") {
      return [psScalar(null)];
    }
  }
  if (node.scope) {
    const frame = psFindScopedFrame(runtime, node.scope);
    if (!frame) {
      return [psUnknown(`unsupported-scope-${node.scope}`)];
    }
    const values = psGetBindingValues(frame.bindings, lower);
    if (values) {
      return psCloneValues(values);
    }
    return node.scope === "local"
      ? [psScalar(null)]
      : [psUnknown(`external-${node.scope}-binding`)];
  }
  for (
    let frameIndex = runtime.frames.length - 1;
    frameIndex >= 0;
    frameIndex -= 1
  ) {
    const values = psGetBindingValues(
      runtime.frames[frameIndex].bindings,
      lower,
    );
    if (values) {
      return psCloneValues(values);
    }
  }
  return [psUnknown("unresolved-unqualified-variable")];
}

function psNewObject(runtime, comparer, entries) {
  const id = `object-${runtime.meta.nextLocationId++}`;
  const properties = new Map();
  let duplicate = false;
  for (const entry of entries) {
    const canonical = psCanonicalName(entry.key);
    if (
      comparer !== "case-sensitive" &&
      properties.has(canonical)
    ) {
      duplicate = true;
      continue;
    }
    const key = comparer === "case-sensitive" ? entry.key : canonical;
    properties.set(key, {
      originalName: entry.key,
      values: entry.values,
      line: entry.line,
    });
  }
  runtime.locations.set(id, {
    id,
    kind: "object",
    comparer,
    properties,
    ambiguousMembers: false,
  });
  return {
    value: {
      kind: "objectRef",
      id,
      snapshotVersion: 1,
    },
    duplicate,
  };
}

function psNewArray(runtime, elements) {
  const id = `array-${runtime.meta.nextLocationId++}`;
  const elementMap = new Map();
  elements.forEach((values, index) => {
    elementMap.set(index, psUnionValues(values));
  });
  runtime.locations.set(id, {
    id,
    kind: "array",
    elements: elementMap,
    partial: false,
  });
  return {
    kind: "arrayRef",
    id,
    snapshotVersion: 1,
  };
}

function psStringValue(value) {
  if (value.kind === "scalar") {
    if (
      typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean"
    ) {
      return String(value.value);
    }
    if (value.value === null) {
      return "";
    }
  }
  return null;
}

function psBoolBranches(values) {
  const branches = new Set();
  for (const value of values) {
    if (value.kind !== "scalar") {
      branches.add("unknown");
      continue;
    }
    if (value.value === true) {
      branches.add(true);
    } else if (value.value === false || value.value === null) {
      branches.add(false);
    } else if (typeof value.value === "number") {
      branches.add(value.value !== 0);
    } else if (typeof value.value === "string") {
      branches.add(value.value.length > 0);
    } else {
      branches.add("unknown");
    }
  }
  if (branches.size === 0) {
    branches.add("unknown");
  }
  if (branches.has("unknown")) {
    branches.add(true);
    branches.add(false);
  }
  return branches;
}

function psMergeBindingsMaps(maps) {
  const result = new Map();
  for (const bindingMap of maps) {
    for (const [key, values] of bindingMap) {
      const existing = result.get(key) ?? [];
      result.set(key, psUnionValues([...existing, ...values]));
    }
  }
  return result;
}

function psMergeLocationValues(
  leftValues,
  rightValues,
) {
  return psUnionValues([
    ...(leftValues ?? []),
    ...(rightValues ?? []),
  ]);
}

function psMergeRuntimes(runtimes, fallback) {
  if (runtimes.length === 0) {
    return fallback;
  }
  const base = psCloneRuntime(runtimes[0]);
  const maxFrames = Math.max(
    ...runtimes.map((runtime) => runtime.frames.length),
  );
  const frames = [];
  for (let frameIndex = 0; frameIndex < maxFrames; frameIndex += 1) {
    const sourceFrames = runtimes
      .map((runtime) => runtime.frames[frameIndex])
      .filter(Boolean);
    const first = sourceFrames[0];
    frames.push({
      ...first,
      bindings: psMergeBindingsMaps(
        sourceFrames.map((frame) => frame.bindings),
      ),
    });
  }
  const locations = new Map();
  for (const runtime of runtimes) {
    for (const [id, location] of runtime.locations) {
      const existing = locations.get(id);
      if (!existing) {
        locations.set(id, psCloneLocation(location));
        continue;
      }
      if (location.kind === "object") {
        for (const [key, property] of location.properties) {
          const current = existing.properties.get(key);
          if (current) {
            current.values = psMergeLocationValues(
              current.values,
              property.values,
            );
          } else {
            existing.properties.set(key, {
              ...property,
              values: psCloneValues(property.values),
            });
          }
        }
        existing.ambiguousMembers =
          existing.ambiguousMembers ||
          location.ambiguousMembers;
      } else {
        for (const [index, values] of location.elements) {
          existing.elements.set(
            index,
            psMergeLocationValues(
              existing.elements.get(index),
              values,
            ),
          );
        }
        existing.partial =
          existing.partial || location.partial;
      }
    }
  }
  return {
    ...base,
    frames,
    locations,
    complete: runtimes.every((runtime) => runtime.complete),
    fatalError: runtimes.some((runtime) => runtime.fatalError),
    analysisState: runtimes.reduce(
      (state, runtime) =>
        psMergeSecurity(state, runtime.analysisState),
      "SAFE",
    ),
  };
}

function psNormalPath(runtime, outputs = []) {
  return {
    runtime,
    outputs: psUnionValues(outputs),
    flow: "normal",
  };
}

function psExecuteBlock(block, runtime) {
  let paths = [psNormalPath(runtime)];
  for (const statement of block.statements ?? []) {
    const nextPaths = [];
    for (const path of paths) {
      if (path.flow !== "normal") {
        nextPaths.push(path);
        continue;
      }
      if (!psCharge(path.runtime)) {
        nextPaths.push({
          ...path,
          runtime: {
            ...path.runtime,
            fatalError: true,
            complete: false,
            analysisState: "ERROR",
          },
        });
        continue;
      }
      const results = psExecuteStatement(statement, path.runtime);
      for (const result of results) {
        nextPaths.push({
          runtime: result.runtime,
          outputs: psUnionValues([
            ...path.outputs,
            ...result.outputs,
          ]),
          flow: result.flow,
        });
      }
    }
    paths = nextPaths;
  }
  return paths;
}

function psExecuteStatement(statement, runtime) {
  if (!statement || runtime.fatalError) {
    return [psNormalPath(runtime)];
  }
  if (statement.kind === "function") {
    runtime.functions.set(
      psCanonicalName(statement.name),
      statement,
    );
    return [psNormalPath(runtime)];
  }
  if (statement.kind === "param") {
    for (const parameter of statement.parameters) {
      psBind(
        runtime,
        parameter.scope,
        parameter.value,
        [psUnknown("external-parameter")],
      );
    }
    return [psNormalPath(runtime)];
  }
  if (statement.kind === "if") {
    return psExecuteIf(statement, runtime);
  }
  if (statement.kind === "switch") {
    return psExecuteSwitch(statement, runtime);
  }
  if (statement.kind === "try") {
    return psExecuteTry(statement, runtime);
  }
  if (statement.kind === "loop") {
    return psExecuteLoop(statement, runtime);
  }
  if (statement.kind === "return") {
    const values = statement.value
      ? psEvalExpression(statement.value, runtime, 0)
      : [];
    return [
      {
        runtime,
        outputs: values,
        flow: "return",
      },
    ];
  }
  if (statement.kind === "break" || statement.kind === "continue") {
    return [
      {
        runtime,
        outputs: [],
        flow: statement.kind,
      },
    ];
  }
  if (statement.kind === "assignment") {
    const value = psEvalExpression(
      statement.value,
      runtime,
      0,
    );
    if (statement.operator === "+=") {
      const existing = psReadAssignmentTarget(
        statement.target,
        runtime,
      );
      const combined = [];
      for (const oldValue of existing) {
        for (const newValue of value) {
          const oldString = psStringValue(oldValue);
          const newString = psStringValue(newValue);
          combined.push(
            oldString !== null && newString !== null
              ? psScalar(oldString + newString)
              : psUnknown("unsupported-compound-assignment"),
          );
        }
      }
      psWriteAssignmentTarget(
        statement.target,
        puUnionOrUnknown(combined),
        runtime,
        statement.line,
      );
    } else {
      psWriteAssignmentTarget(
        statement.target,
        value,
        runtime,
        statement.line,
      );
    }
    return [psNormalPath(runtime)];
  }
  if (statement.kind === "expression") {
    const outputs = psEvalExpression(
      statement.expression,
      runtime,
      0,
    );
    return [psNormalPath(runtime, outputs)];
  }
  runtime.complete = false;
  return [psNormalPath(runtime, [psUnknown("unsupported-statement")])];
}

function puUnionOrUnknown(values) {
  return values.length > 0 ? psUnionValues(values) : [psUnknown()];
}

function psBranchRuntime(runtime) {
  return psCloneRuntime({
    ...runtime,
    analysisState: "SAFE",
    complete: true,
    fatalError: false,
  });
}

function psExecuteIf(statement, runtime) {
  let outputRuntime = runtime;
  const results = [];
  for (const branch of statement.branches) {
    const conditionValues = psEvalExpression(
      branch.condition,
      outputRuntime,
      0,
    );
    const possible = psBoolBranches(conditionValues);
    if (possible.has(true)) {
      const trueRuntime = psBranchRuntime(outputRuntime);
      const paths = psExecuteBlock(branch.body, trueRuntime);
      results.push(...paths);
    }
    if (!possible.has(false)) {
      return results;
    }
    outputRuntime = psCloneRuntime(outputRuntime);
  }
  if (statement.elseBody) {
    results.push(
      ...psExecuteBlock(
        statement.elseBody,
        psBranchRuntime(outputRuntime),
      ),
    );
  } else {
    results.push(psNormalPath(outputRuntime));
  }
  return results;
}

function psExecuteSwitch(statement, runtime) {
  psEvalExpression(statement.selector, runtime, 0);
  const results = [];
  for (const branch of statement.cases) {
    results.push(
      ...psExecuteBlock(
        branch.body,
        psBranchRuntime(runtime),
      ),
    );
  }
  if (statement.defaultBody) {
    results.push(
      ...psExecuteBlock(
        statement.defaultBody,
        psBranchRuntime(runtime),
      ),
    );
  }
  results.push(psNormalPath(psBranchRuntime(runtime)));
  return results;
}

function psExecuteTry(statement, runtime) {
  const results = [
    ...psExecuteBlock(
      statement.tryBody,
      psBranchRuntime(runtime),
    ),
  ];
  for (const catchBody of statement.catchBodies) {
    results.push(
      ...psExecuteBlock(
        catchBody,
        psBranchRuntime(runtime),
      ),
    );
  }
  if (statement.finallyBody) {
    const finalPaths = [];
    for (const result of results) {
      if (result.flow === "error") {
        finalPaths.push(result);
        continue;
      }
      for (const finalResult of psExecuteBlock(
        statement.finallyBody,
        result.runtime,
      )) {
        finalPaths.push({
          runtime: finalResult.runtime,
          outputs: psUnionValues([
            ...result.outputs,
            ...finalResult.outputs,
          ]),
          flow:
            finalResult.flow === "normal"
              ? result.flow
              : finalResult.flow,
        });
      }
    }
    return finalPaths;
  }
  return results;
}

function psExecuteLoop(statement, runtime) {
  const results = [psNormalPath(psBranchRuntime(runtime))];
  const bodyRuntime = psBranchRuntime(runtime);
  if (statement.variable) {
    const iterable = psEvalExpression(
      statement.iterable,
      bodyRuntime,
      0,
    );
    const elementValues = [];
    for (const value of iterable) {
      if (value.kind === "arrayRef") {
        const location = bodyRuntime.locations.get(value.id);
        for (const values of location?.elements.values() ?? []) {
          elementValues.push(...values);
        }
      } else {
        elementValues.push(value);
      }
    }
    psBind(
      bodyRuntime,
      statement.variable.scope,
      statement.variable.value,
      elementValues.length > 0
        ? elementValues
        : [psUnknown("loop-iteration-value")],
    );
  } else {
    psEvalExpression(statement.iterable, bodyRuntime, 0);
  }
  for (const path of psExecuteBlock(statement.body, bodyRuntime)) {
    results.push({
      ...path,
      flow:
        path.flow === "break" || path.flow === "continue"
          ? "normal"
          : path.flow,
    });
  }
  psAddSemanticFinding(
    runtime.context,
    "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
    statement.line,
    "PowerShell loop iteration state cannot be fully resolved statically.",
    "UNKNOWN",
  );
  psMarkAnalysisState(runtime, "UNKNOWN");
  runtime.complete = false;
  return results;
}

function psReadAssignmentTarget(target, runtime) {
  if (target.kind === "variable") {
    return psReadVariable(runtime, target);
  }
  if (target.kind === "member") {
    return psReadMember(target, runtime, 0);
  }
  if (target.kind === "index") {
    return psReadIndex(target, runtime, 0);
  }
  return [psUnknown("unsupported-assignment-target")];
}

function psWriteAssignmentTarget(target, values, runtime, line) {
  if (target.kind === "variable") {
    const canonical = psCanonicalName(target.name);
    if (
      !target.scope &&
      (canonical === "null" || canonical === "_")
    ) {
      return;
    }
    psBind(runtime, target.scope, target.name, values);
    return;
  }
  if (target.kind === "member") {
    const receivers = psEvalExpression(
      target.receiver,
      runtime,
      0,
    );
    for (const receiver of receivers) {
      if (receiver.kind === "unknown" || receiver.kind === "error") {
        continue;
      }
      if (receiver.kind !== "objectRef") {
        runtime.complete = false;
        continue;
      }
      const location = runtime.locations.get(receiver.id);
      if (!location || location.comparer === "unknown") {
        continue;
      }
      const key =
        location.comparer === "case-sensitive"
          ? target.name
          : psCanonicalName(target.name);
      location.properties.set(key, {
        originalName: target.name,
        values: psUnionValues(values),
        line,
      });
      location.snapshotVersion =
        (location.snapshotVersion ?? 1) + 1;
      runtime.meta.environmentGeneration += 1;
    }
    return;
  }
  if (target.kind === "index") {
    const receivers = psEvalExpression(
      target.receiver,
      runtime,
      0,
    );
    const indexes = psEvalExpression(target.index, runtime, 0);
    for (const receiver of receivers) {
      if (receiver.kind !== "arrayRef") {
        continue;
      }
      const location = runtime.locations.get(receiver.id);
      for (const indexValue of indexes) {
        if (
          indexValue.kind !== "scalar" ||
          !Number.isInteger(Number(indexValue.value))
        ) {
          location.partial = true;
          continue;
        }
        location.elements.set(
          Number(indexValue.value),
          psUnionValues(values),
        );
      }
      location.snapshotVersion =
        (location.snapshotVersion ?? 1) + 1;
      runtime.meta.environmentGeneration += 1;
    }
    return;
  }
  runtime.complete = false;
}

function psEvalExpression(expression, runtime, depth) {
  if (!expression || runtime.fatalError) {
    return runtime.fatalError ? [psErrorValue()] : [];
  }
  if (
    depth >
    runtime.meta.limits.maxExpressionDepth + 1
  ) {
    psFailBudget(runtime, "expression depth");
    return [psErrorValue("expression-depth")];
  }
  if (!psCharge(runtime)) {
    return [psErrorValue("budget")];
  }
  if (expression.kind === "literal") {
    return [psScalar(expression.value)];
  }
  if (expression.kind === "variable") {
    return psReadVariable(runtime, expression);
  }
  if (expression.kind === "array") {
    const elements = expression.elements.map((element) =>
      psEvalExpression(element, runtime, depth + 1),
    );
    return [psNewArray(runtime, elements)];
  }
  if (
    expression.kind === "hashtable" ||
    expression.kind === "customObject"
  ) {
    const entries = [];
    for (const entry of expression.entries) {
      entries.push({
        key: entry.key,
        line: entry.keyLine,
        values: psEvalExpression(
          entry.value,
          runtime,
          depth + 1,
        ),
      });
    }
    const object = psNewObject(
      runtime,
      "case-insensitive",
      entries,
    );
    if (object.duplicate) {
      psAddSemanticFinding(
        runtime.context,
        "SCRIPT_POWERSHELL_SEMANTIC_ERROR",
        expression.line,
        "PowerShell object contains duplicate case-insensitive keys.",
        "ERROR",
      );
      psMarkAnalysisState(runtime, "ERROR");
      return [psErrorValue("duplicate-object-key")];
    }
    return [object.value];
  }
  if (expression.kind === "scriptblock") {
    return [
      {
        kind: "scriptblock",
        id: `scriptblock-${runtime.meta.nextScriptBlockId++}`,
        body: expression.body,
        securityState: "UNKNOWN",
        dangerousEntry: null,
        line: expression.line,
      },
    ];
  }
  if (expression.kind === "staticCall") {
    return psEvalStaticCall(expression, runtime, depth + 1);
  }
  if (expression.kind === "command") {
    return psEvalCommand(expression, runtime, [], depth + 1);
  }
  if (expression.kind === "pipe" || expression.kind === "pipeline") {
    const left = psEvalExpression(
      expression.left,
      runtime,
      depth + 1,
    );
    if (expression.right.kind === "command") {
      return psEvalCommand(
        expression.right,
        runtime,
        left,
        depth + 1,
      );
    }
    runtime.complete = false;
    return [psUnknown("unsupported-pipeline-transformer")];
  }
  if (expression.kind === "binary") {
    if (expression.operator === "+") {
      const left = psEvalExpression(
        expression.left,
        runtime,
        depth + 1,
      );
      const right = psEvalExpression(
        expression.right,
        runtime,
        depth + 1,
      );
      const results = [];
      for (const leftValue of left) {
        for (const rightValue of right) {
          const leftString = psStringValue(leftValue);
          const rightString = psStringValue(rightValue);
          results.push(
            leftString !== null && rightString !== null
              ? psScalar(leftString + rightString)
              : psUnknown("unsupported-binary-value"),
          );
        }
      }
      return psUnionValues(results);
    }
    runtime.complete = false;
    return [psUnknown("unsupported-binary-operator")];
  }
  if (expression.kind === "member") {
    return psReadMember(expression, runtime, depth);
  }
  if (expression.kind === "index") {
    return psReadIndex(expression, runtime, depth);
  }
  if (expression.kind === "method") {
    return psEvalMethod(expression, runtime, depth);
  }
  if (expression.kind === "call") {
    const target = psEvalExpression(
      expression.target,
      runtime,
      depth + 1,
    );
    const args = expression.args.flatMap((arg) =>
      psEvalArgument(arg, runtime, depth + 1),
    );
    return psInvokeValues(
      runtime,
      target,
      args,
      expression.line,
      {
        record: true,
        allowScalarCommand: true,
      },
    );
  }
  if (expression.kind === "not") {
    const values = psEvalExpression(
      expression.expression,
      runtime,
      depth + 1,
    );
    return psUnionValues(
      values.map((value) =>
        value.kind === "scalar" &&
        typeof value.value === "boolean"
          ? psScalar(!value.value)
          : psUnknown("unresolved-boolean"),
      ),
    );
  }
  if (expression.kind === "ifExpression") {
    const paths = psExecuteIf(
      { ...expression, kind: "if" },
      runtime,
    );
    const mergedRuntime = psMergeRuntimes(
      paths.map((path) => path.runtime),
      runtime,
    );
    psReplaceRuntime(runtime, mergedRuntime);
    return psUnionValues(
      paths.flatMap((path) => path.outputs),
    );
  }
  runtime.complete = false;
  return [psUnknown(expression.reason ?? "unsupported-expression")];
}

function psEvalArgument(argument, runtime, depth) {
  if (argument.kind === "namedArgument") {
    return argument.value
      ? psEvalExpression(argument.value, runtime, depth + 1)
      : [];
  }
  if (argument.kind === "errorRedirect") {
    return [psUnknown("error-to-success-redirection")];
  }
  return psEvalExpression(argument, runtime, depth + 1);
}

function psReplaceRuntime(target, source) {
  target.frames = source.frames;
  target.locations = source.locations;
  target.functions = source.functions;
  target.aliases = source.aliases;
  target.complete = source.complete;
  target.fatalError = source.fatalError;
  target.analysisState = source.analysisState;
  target.functionDepth = source.functionDepth;
}

function psEvalStaticCall(expression, runtime, depth) {
  if (
    expression.typeName === "scriptblock" &&
    expression.method === "create"
  ) {
    const argumentValues = expression.args.flatMap((arg) =>
      psEvalExpression(arg, runtime, depth + 1),
    );
    const strings = argumentValues
      .map(psStringValue)
      .filter((value) => value !== null);
    if (
      strings.length === 0 ||
      strings.length !== argumentValues.length
    ) {
      return [
        {
          kind: "scriptblock",
          id: `scriptblock-${runtime.meta.nextScriptBlockId++}`,
          body: null,
          securityState: "UNKNOWN",
          dangerousEntry: null,
          line: expression.line,
        },
      ];
    }
    const classifications = strings.map((body) =>
      psClassifyPowerShellBody(runtime.context, body, depth + 1),
    );
    const securityState = classifications.reduce(
      (state, classification) =>
        psMergeSecurity(state, classification.state),
      "SAFE",
    );
    const dangerousEntry = classifications.find(
      (classification) =>
        classification.state === "DANGEROUS",
    )?.dangerousEntry;
    return [
      {
        kind: "scriptblock",
        id: `scriptblock-${runtime.meta.nextScriptBlockId++}`,
        body: null,
        bodyText:
          strings.length === 1 ? strings[0] : null,
        securityState,
        candidateStates: [
          ...new Set(
            classifications.map(
              (classification) => classification.state,
            ),
          ),
        ],
        dangerousEntry: dangerousEntry ?? null,
        line: expression.line,
      },
    ];
  }
  runtime.complete = false;
  return [psUnknown("unsupported-static-call")];
}

function psClassifyPowerShellBody(context, body, depth) {
  if (
    depth > POWERSHELL_SEMANTIC_LIMITS.maxExpressionDepth
  ) {
    return {
      state: "ERROR",
      dangerousEntry: null,
    };
  }
  const key = `${psStableDigest(body)}:${depth}:${POWERSHELL_SEMANTIC_POLICY_VERSION}`;
  const cached = context.cache.get(key);
  if (cached) {
    return cached;
  }
  const nested = psAnalyzePowerShellSemanticsInternal(
    context.relativePath,
    body,
    {
      depth: depth + 1,
      isolated: true,
    },
  );
  let state;
  if (nested.parseError) {
    state = "ERROR";
  } else if (!nested.complete) {
    state = "UNKNOWN";
  } else if (nested.analysisState === "ERROR") {
    state = "ERROR";
  } else if (nested.analysisState === "DANGEROUS") {
    state = "DANGEROUS";
  } else if (nested.analysisState === "UNKNOWN") {
    state = "UNKNOWN";
  } else {
    state = "SAFE";
  }
  const result = {
    state,
    dangerousEntry:
      nested.findings.find(
        (value) =>
          value.classification === "DANGEROUS",
      )?.code === "SCRIPT_DIRECT_WORKER_DIST"
        ? "worker-dist"
        : state === "DANGEROUS"
          ? "next-start"
          : null,
  };
  context.cache.set(key, result);
  return result;
}

function psEvalCommand(
  expression,
  runtime,
  pipelineInput,
  depth,
) {
  const name = psCanonicalName(expression.name);
  const evaluatedArgs = [];
  const named = new Map();
  for (const arg of expression.args) {
    if (arg.kind === "namedArgument") {
      const values = arg.value
        ? psEvalExpression(arg.value, runtime, depth + 1)
        : [];
      named.set(psCanonicalName(arg.name.replace(/^-/, "")), values);
      evaluatedArgs.push(...values);
    } else if (arg.kind === "errorRedirect") {
      named.set("__errorRedirect", [psUnknown()]);
    } else {
      evaluatedArgs.push(
        ...psEvalArgument(arg, runtime, depth + 1),
      );
    }
  }

  if (name === "write-output") {
    return psUnionValues([
      ...pipelineInput,
      ...evaluatedArgs,
    ]);
  }
  if (POWERSHELL_NON_OUTPUT_COMMANDS.has(name)) {
    if (
      name === "write-error" &&
      named.has("__errorRedirect")
    ) {
      return [psUnknown("error-to-success-redirection")];
    }
    return [];
  }
  if (name === "out-null") {
    return [];
  }
  if (name === "invoke-command") {
    const target =
      named.get("scriptblock") ??
      (evaluatedArgs.length > 0 ? [evaluatedArgs[0]] : []);
    return psInvokeValues(
      runtime,
      target,
      [],
      expression.line,
      {
        record: true,
        allowScalarCommand: false,
      },
    );
  }
  if (name === "next") {
    const start = evaluatedArgs
      .map(psStringValue)
      .some((value) => value?.toLowerCase() === "start");
    if (start) {
      psAddSemanticFinding(
        runtime.context,
        "SCRIPT_DIRECT_NEXT_START",
        expression.line,
        "PowerShell semantically resolves next start.",
        "DANGEROUS",
      );
      psMarkAnalysisState(runtime, "DANGEROUS");
    } else {
      runtime.complete = false;
    }
    return [];
  }
  if (name === "start-process") {
    const words = evaluatedArgs
      .map(psStringValue)
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    if (
      words.some((value) => value.includes("next")) &&
      words.some((value) => value.includes("start"))
    ) {
      psAddSemanticFinding(
        runtime.context,
        "SCRIPT_DIRECT_NEXT_START",
        expression.line,
        "PowerShell Start-Process resolves next start.",
        "DANGEROUS",
      );
      psMarkAnalysisState(runtime, "DANGEROUS");
      return [];
    }
    runtime.complete = false;
    return [psUnknown("unsupported-start-process")];
  }
  if (name === "get-command") {
    runtime.complete = false;
    return [psUnknown("unsupported-command-discovery")];
  }
  const functionDefinition = runtime.functions.get(name);
  if (functionDefinition) {
    return psCallFunction(
      runtime,
      functionDefinition,
      evaluatedArgs,
      expression.line,
    );
  }
  if (
    POWERHELL_KNOWN_UNKNOWN_SOURCE_COMMANDS.has(name) ||
    name.startsWith("get-") ||
    name.startsWith("read-")
  ) {
    return [psUnknown(`unknown-command-output-${name}`)];
  }
  runtime.complete = false;
  return [psUnknown(`unsupported-command-${name}`)];
}

function psCallFunction(runtime, definition, args, line) {
  if (
    runtime.functionDepth >=
    runtime.meta.limits.maxFunctionDepth
  ) {
    psFailBudget(runtime, "function depth");
    return [psErrorValue("function-depth")];
  }
  const functionRuntime = psCloneRuntime(runtime);
  functionRuntime.functionDepth += 1;
  const frame = {
    id: `function-${functionRuntime.meta.nextFrameId++}`,
    kind: "function",
    bindings: new Map(),
    name: definition.name,
  };
  functionRuntime.frames.push(frame);
  definition.parameters.forEach((parameter, index) => {
    frame.bindings.set(
      psCanonicalName(parameter.value),
      args[index] ? [args[index]] : [psUnknown("missing-parameter")],
    );
  });
  const paths = psExecuteBlock(
    definition.body,
    functionRuntime,
  );
  const outputs = psUnionValues(
    paths.flatMap((path) => path.outputs),
  );
  const merged = psMergeRuntimes(
    paths.map((path) => path.runtime),
    functionRuntime,
  );
  psMarkAnalysisState(runtime, merged.analysisState);
  if (!merged.complete) {
    runtime.complete = false;
  }
  if (merged.fatalError) {
    runtime.fatalError = true;
  }
  runtime.context.evaluations.push({
    id: `function-${definition.name}-${line}`,
    line,
    abstractValueKind: psDescribeValues(outputs),
    securityState: psValuesSecurity(outputs),
    invocationTarget: `function:${definition.name}`,
  });
  return outputs;
}

function psReadMember(expression, runtime, depth) {
  const receivers = psEvalExpression(
    expression.receiver,
    runtime,
    depth + 1,
  );
  const results = [];
  for (const receiver of receivers) {
    if (receiver.kind === "error") {
      results.push(psErrorValue("error-member-receiver"));
      continue;
    }
    if (receiver.kind === "unknown") {
      results.push(psUnknown("unknown-member-receiver"));
      continue;
    }
    if (receiver.kind !== "objectRef") {
      results.push(psUnknown("unsupported-member-receiver"));
      continue;
    }
    const location = runtime.locations.get(receiver.id);
    if (
      !location ||
      location.comparer === "unknown" ||
      location.ambiguousMembers
    ) {
      results.push(psUnknown("ambiguous-object-member"));
      continue;
    }
    const key =
      location.comparer === "case-sensitive"
        ? expression.name
        : psCanonicalName(expression.name);
    const property = location.properties.get(key);
    results.push(
      ...(property?.values ?? [psScalar(null)]),
    );
  }
  return psUnionValues(results);
}

function psReadIndex(expression, runtime, depth) {
  const receivers = psEvalExpression(
    expression.receiver,
    runtime,
    depth + 1,
  );
  const indexes = psEvalExpression(
    expression.index,
    runtime,
    depth + 1,
  );
  const results = [];
  for (const receiver of receivers) {
    if (receiver.kind === "error") {
      results.push(psErrorValue("error-index-receiver"));
      continue;
    }
    if (receiver.kind === "unknown") {
      results.push(psUnknown("unknown-index-receiver"));
      continue;
    }
    if (receiver.kind !== "arrayRef") {
      results.push(psUnknown("unsupported-index-receiver"));
      continue;
    }
    const location = runtime.locations.get(receiver.id);
    for (const indexValue of indexes) {
      if (
        indexValue.kind === "scalar" &&
        Number.isInteger(Number(indexValue.value))
      ) {
        results.push(
          ...(location?.elements.get(
            Number(indexValue.value),
          ) ?? [psScalar(null)]),
        );
      } else {
        for (const values of location?.elements.values() ?? []) {
          results.push(...values);
        }
        results.push(psUnknown("dynamic-index"));
      }
    }
  }
  return psUnionValues(results);
}

function psEvalMethod(expression, runtime, depth) {
  const receivers = psEvalExpression(
    expression.receiver,
    runtime,
    depth + 1,
  );
  const method = psCanonicalName(expression.name);
  if (method === "invoke") {
    return psInvokeValues(
      runtime,
      receivers,
      [],
      expression.line,
      {
        record: true,
        allowScalarCommand: false,
      },
    );
  }
  if (method === "getnewclosure") {
    return psUnionValues(
      receivers.map((receiver) => {
        if (receiver.kind === "error") {
          return psErrorValue("error-closure-target");
        }
        if (receiver.kind === "unknown") {
          return psUnknown("unknown-closure-target");
        }
        if (receiver.kind !== "scriptblock") {
          return psUnknown("unknown-closure-target");
        }
        const captures = new Map();
        for (const frame of runtime.frames) {
          for (const [name, values] of frame.bindings) {
            captures.set(name, psCloneValues(values));
          }
        }
        return {
          kind: "closure",
          id: `closure-${runtime.meta.nextClosureId++}`,
          body: receiver.body,
          bodyText: receiver.bodyText ?? null,
          capturedBindings: captures,
          securityState: receiver.securityState,
          dangerousEntry: receiver.dangerousEntry ?? null,
          line: expression.line,
        };
      }),
    );
  }
  runtime.complete = false;
  return [psUnknown(`unsupported-method-${method}`)];
}

function psInvokeValues(
  runtime,
  targets,
  args,
  line,
  options,
) {
  if (targets.length === 0) {
    if (options.record) {
      runtime.context.evaluations.push({
        id: `invoke-${line}-${runtime.context.evaluations.length + 1}`,
        line,
        abstractValueKind: "EMPTY_SUCCESS_STREAM",
        securityState: "SAFE",
        invocationTarget: "null",
      });
    }
    return [];
  }
  let state = "SAFE";
  let dangerousEntry = null;
  const invocationOutputs = [];
  for (const target of targets) {
    if (target.kind === "scriptblock") {
      const execution =
        target.body === null
          ? {
              securityState: target.securityState,
              outputs: [],
            }
          : psExecuteScriptBlockBody(
              runtime,
              target.body,
              null,
            );
      const targetState = execution.securityState;
      invocationOutputs.push(...execution.outputs);
      state = psMergeSecurity(state, targetState);
      dangerousEntry ??= target.dangerousEntry;
      continue;
    }
    if (target.kind === "closure") {
      const result = psExecuteScriptBlockBody(
        runtime,
        target.body,
        target.capturedBindings,
      );
      target.securityState = result.securityState;
      invocationOutputs.push(...result.outputs);
      state = psMergeSecurity(
        state,
        result.securityState,
      );
      dangerousEntry ??= target.dangerousEntry;
      continue;
    }
    if (target.kind === "unknown") {
      state = psMergeSecurity(state, "UNKNOWN");
      continue;
    }
    if (target.kind === "error") {
      state = psMergeSecurity(state, "ERROR");
      continue;
    }
    if (
      options.allowScalarCommand &&
      target.kind === "scalar" &&
      typeof target.value === "string"
    ) {
      const commandName = target.value.toLowerCase();
      if (commandName === "next") {
        const starts = args
          .map(psStringValue)
          .some(
            (value) => value?.toLowerCase() === "start",
          );
        if (starts) {
          state = psMergeSecurity(state, "DANGEROUS");
          dangerousEntry = "next-start";
        }
      } else if (
        commandName === "node" ||
        commandName === "node.exe"
      ) {
        const invokesWorkerDist = args
          .map(psStringValue)
          .filter(Boolean)
          .some((value) =>
            /(?:^|[/\\])dist[/\\]index\.js$/i.test(
              value.trim(),
            ),
          );
        if (invokesWorkerDist) {
          state = psMergeSecurity(state, "DANGEROUS");
          dangerousEntry = "worker-dist";
        }
      } else if (!["write-host", "write-output"].includes(commandName)) {
        state = psMergeSecurity(state, "UNKNOWN");
      }
      continue;
    }
    if (target.kind === "objectRef") {
      state = psMergeSecurity(state, "UNKNOWN");
    }
  }
  if (state === "DANGEROUS") {
    psAddSemanticFinding(
      runtime.context,
      dangerousEntry === "worker-dist"
        ? "SCRIPT_DIRECT_WORKER_DIST"
        : "SCRIPT_DIRECT_NEXT_START",
      line,
      "PowerShell invocation target resolves to a forbidden startup entry.",
      "DANGEROUS",
    );
    psMarkAnalysisState(runtime, state);
  } else if (state === "UNKNOWN") {
    psAddSemanticFinding(
      runtime.context,
      "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
      line,
      "PowerShell invocation target cannot be proven safe.",
      "UNKNOWN",
    );
    psMarkAnalysisState(runtime, state);
  } else if (state === "ERROR") {
    psAddSemanticFinding(
      runtime.context,
      "SCRIPT_POWERSHELL_SEMANTIC_ERROR",
      line,
      "PowerShell invocation target analysis failed.",
      "ERROR",
    );
    psMarkAnalysisState(runtime, state);
  }
  if (options.record) {
    runtime.context.evaluations.push({
      id: `invoke-${line}-${runtime.context.evaluations.length + 1}`,
      line,
      abstractValueKind: psDescribeValues(targets),
      securityState: state,
      invocationTarget: psDescribeValues(targets),
    });
  }
  return psUnionValues(invocationOutputs);
}

function psExecuteScriptBlockBody(
  runtime,
  body,
  capturedBindings,
) {
  if (!body) {
    return {
      securityState: "UNKNOWN",
      outputs: [],
    };
  }
  const executionRuntime = psCloneRuntime(runtime);
  executionRuntime.analysisState = "SAFE";
  if (capturedBindings) {
    executionRuntime.frames.push({
      id: `closure-frame-${executionRuntime.meta.nextFrameId++}`,
      kind: "function",
      bindings: new Map(
        [...capturedBindings].map(([key, values]) => [
          key,
          psCloneValues(values),
        ]),
      ),
    });
  }
  executionRuntime.frames.push({
    id: `scriptblock-frame-${executionRuntime.meta.nextFrameId++}`,
    kind: "function",
    bindings: new Map(),
  });
  const paths = psExecuteBlock(body, executionRuntime);
  const merged = psMergeRuntimes(
    paths.map((path) => path.runtime),
    executionRuntime,
  );
  const outputs = psUnionValues(
    paths.flatMap((path) => path.outputs),
  );
  let securityState = psMergeSecurity(
    merged.analysisState,
    psValuesSecurity(outputs),
  );
  if (!merged.complete) {
    securityState = psMergeSecurity(
      securityState,
      "UNKNOWN",
    );
  }
  if (merged.fatalError) {
    securityState = "ERROR";
  }
  return {
    securityState,
    outputs,
  };
}

function psAnalyzePowerShellSemanticsInternal(
  relativePath,
  content,
  options = {},
) {
  const depth = options.depth ?? 0;
  const parsed = psParseSemanticPowerShell(content);
  const findings = [];
  const context = {
    relativePath,
    findings,
    evaluations: [],
    cache: options.cache ?? new Map(),
    meta: options.meta ?? {
      abstractStates: 0,
      nextFrameId: 1,
      nextLocationId: 1,
      nextScriptBlockId: 1,
      nextClosureId: 1,
      environmentGeneration: 0,
      limits: {
        ...POWERSHELL_SEMANTIC_LIMITS,
        ...(options.limits ?? {}),
      },
      deadline:
        Date.now() +
        (options.limits?.maxMilliseconds ??
          POWERSHELL_SEMANTIC_LIMITS.maxMilliseconds),
      budgetErrorReported: false,
    },
  };
  const parseError =
    !parsed.complete && parsed.unsupportedReason !== null
      ? /Expected|Unsupported expression|hashtable key|Unterminated/i.test(
          parsed.unsupportedReason,
        )
      : false;
  if (!parsed.complete) {
    return {
      complete: false,
      parseError,
      analysisState: parseError ? "ERROR" : "UNKNOWN",
      findings,
      evaluations: [],
      unsupportedReason: parsed.unsupportedReason,
    };
  }
  const runtime = psCreateRuntime(context);
  const paths = psExecuteBlock(
    {
      statements: parsed.statements,
    },
    runtime,
  );
  const mergedRuntime = psMergeRuntimes(
    paths.map((path) => path.runtime),
    runtime,
  );
  return {
    complete:
      depth <= POWERSHELL_SEMANTIC_LIMITS.maxExpressionDepth &&
      mergedRuntime.complete &&
      !mergedRuntime.fatalError,
    parseError: false,
    analysisState: psMergeSecurity(
      mergedRuntime.analysisState,
      ...paths.map((path) =>
        psValuesSecurity(path.outputs),
      ),
    ),
    findings,
    evaluations: context.evaluations,
    unsupportedReason: null,
  };
}

export function inspectPowerShellSemantics(
  relativePath,
  content,
  options = {},
) {
  return psAnalyzePowerShellSemanticsInternal(
    normalizePath(relativePath),
    content,
    options,
  );
}

function scanPowerShell(
  relativePath,
  content,
  findings,
  depth = 0,
) {
  const semantic = psAnalyzePowerShellSemanticsInternal(
    relativePath,
    content,
  );
  if (
    semantic.complete ||
    semantic.findings.some(
      (value) => value.classification === "ERROR",
    )
  ) {
    findings.push(...semantic.findings);
    return;
  }
  scanPowerShellLegacy(
    relativePath,
    content,
    findings,
    depth,
  );
  for (const semanticFinding of semantic.findings) {
    const duplicate = findings.some(
      (value) =>
        value.code === semanticFinding.code &&
        value.line === semanticFinding.line &&
        value.classification ===
          semanticFinding.classification,
    );
    if (!duplicate) {
      findings.push(semanticFinding);
    }
  }
}

function scanPowerShellLegacy(
  relativePath,
  content,
  findings,
  depth = 0,
) {
  if (depth > 4) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
        relativePath,
        "PowerShell nested encoded command exceeds the analysis limit.",
        "UNKNOWN",
        "powershell",
      ),
    );
    return;
  }
  const scriptType = "powershell";
  const hereStrings = extractPowerShellHereStrings(
    relativePath,
    content,
    findings,
  );
  const structure = powerShellStructureStatus(
    stripPowerShellComments(
      sanitizePowerShellHereStrings(content),
    ),
  );
  if (!structure.complete) {
    findings.push(
      finding(
        "SCRIPT_POWERSHELL_SYNTAX_INCOMPLETE",
        relativePath,
        `PowerShell syntax is incomplete: ${structure.reason}.`,
        "ERROR",
        "powershell",
      ),
    );
  }
  const encodedCommands = decodePowerShellEncodedCommands(
    hereStrings.content,
  );
  if (
    encodedCommands.length === 0 &&
    /\b(?:pwsh|powershell)(?:\.exe)?\b[^\r\n]*?\s-(?:EncodedCommand|ec|e)\b/i.test(
      hereStrings.content,
    )
  ) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
        relativePath,
        "PowerShell encoded command payload cannot be parsed statically.",
        "UNKNOWN",
        "powershell",
      ),
    );
  }
  for (const encoded of encodedCommands) {
    if (!encoded.decoded) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          relativePath,
          "PowerShell encoded command cannot be decoded statically.",
          "UNKNOWN",
          "powershell",
        ),
      );
      continue;
    }
    scanPowerShellLegacy(
      relativePath,
      encoded.decoded,
      findings,
      depth + 1,
    );
  }
  const invokeExpressionAliases = new Set();
  for (const match of hereStrings.content.matchAll(
    /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Get-Command\s+(?:-Name\s+)?['"]?Invoke-Expression['"]?/gim,
  )) {
    invokeExpressionAliases.add(match[1]);
  }
  const withoutComments = stripPowerShellComments(
    hereStrings.content,
  ).replace(
    /`\r?\n/g,
    " ",
  );
  if (
    /\b(?:Get-Content|gc|cat|type)\b[\s\S]{0,1000}\|\s*ForEach-Object\b[\s\S]{0,1000}\[scriptblock\]::Create[\s\S]{0,1000}\.Invoke\s*\(/i.test(
      withoutComments,
    )
  ) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
        relativePath,
        "PowerShell file content is created and invoked as a ScriptBlock.",
        "UNKNOWN",
        scriptType,
      ),
    );
  }
  const variables = extractAssignments(
    withoutComments,
    /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/,
  );
  for (const [name, value] of hereStrings.values) {
    variables.set(name, value);
  }
  for (const line of withoutComments.split(/\r?\n/)) {
    const assignment = line.match(
      /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/,
    );
    if (!assignment?.[1] || assignment[2] === undefined) {
      continue;
    }
    if (assignment[2].includes("@@PS_HEREDOC_")) {
      continue;
    }
    const resolved = evaluatePowerShellStringExpression(
      assignment[2],
      variables,
    );
    if (resolved !== null) {
      variables.set(assignment[1], resolved);
    }
  }
  const overriddenAliases = new Set();
  const customFunctions = extractPowerShellFunctionBodies(
    withoutComments,
  );
  const customAliases = extractPowerShellAliasTargets(
    withoutComments,
  );
  const scriptBlockVariables = new Map();
  function scriptBlockModeFromText(text, depth = 0) {
    if (depth > 8) {
      return "unknown";
    }
    const value = text.trim();
    if (!value) {
      return null;
    }
    const body = extractBalancedPowerShellCreateArgument(value);
    if (body !== null) {
      if (
        /\b(?:Get-Content|Get-Item|gc|cat|type)\b/i.test(body)
      ) {
        return "unknown";
      }
      const resolved = evaluatePowerShellStringExpression(
        body,
        variables,
      );
      return resolved === null
        ? "unknown"
        : directNextStart(resolved)
          ? "next-start"
          : directWorkerDist(resolved)
            ? "worker-dist"
            : "safe";
    }
    const variable = value.match(/^\$([A-Za-z_][A-Za-z0-9_.\[\]-]*)/);
    if (variable?.[1]) {
      const normalized = variable[1].replaceAll('"', "").replaceAll("'", "").toLowerCase();
      const root = normalized.split(/[.[]/)[0];
      return (
        scriptBlockVariables.get(normalized) ??
        scriptBlockVariables.get(root) ??
        null
      );
    }
    const functionName = value.match(/^([A-Za-z][A-Za-z0-9_-]*)\b/)?.[1];
    const functionBody = functionName
      ? customFunctions.get(functionName.toLowerCase())
      : null;
    if (functionBody) {
      return scriptBlockModeFromText(functionBody, depth + 1);
    }
    return null;
  }
  function powerShellMayProduceUnknownInvocation(text) {
    const value = text.trim();
    if (!value) {
      return false;
    }
    if (
      evaluatePowerShellStringExpression(value, variables) !== null ||
      /^(?:-?\d+(?:\.\d+)?|\$true|\$false|\$null)$/i.test(value) ||
      /^@\([\s\S]*\)$/.test(value) ||
      /^@\{[\s\S]*\}$/.test(value)
    ) {
      return false;
    }
    return (
      /\$|\(|\)|\[|\]|\.|[A-Za-z]/.test(value)
    );
  }
  for (const match of withoutComments.matchAll(
    /\b(?:Set|New)-Alias(?:\s+-Name)?\s+['"]?([A-Za-z][A-Za-z0-9_-]*)\b/gi,
  )) {
    overriddenAliases.add(match[1].toLowerCase());
  }
  for (const match of withoutComments.matchAll(
    /\bfunction\s+(?:global:)?([A-Za-z][A-Za-z0-9_-]*)\b/gi,
  )) {
    overriddenAliases.add(match[1].toLowerCase());
  }
  for (const match of withoutComments.matchAll(
    /\b(?:Set|New)-Item\s+-Path\s+['"]?Alias:([A-Za-z][A-Za-z0-9_-]*)\b/gi,
  )) {
    overriddenAliases.add(match[1].toLowerCase());
  }
  let offset = 0;
  for (const rawLine of withoutComments.split(/\r?\n/)) {
    const lineNumber = lineNumberAt(withoutComments, offset);
    offset += rawLine.length + 1;
    const skipAssignmentLine =
      /^\s*\$[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:["']|@@PS_HEREDOC_)/.test(
        rawLine,
      );
    for (const alias of invokeExpressionAliases) {
      const aliasInvocation = rawLine.match(
        new RegExp(
          `^\\s*&\\s*\\$${alias.replaceAll("$", "\\$")}\\b([\\s\\S]*)$`,
          "i",
        ),
      );
      if (aliasInvocation) {
        findings.push(
          finding(
            /\bnext\s+start\b/i.test(aliasInvocation[1] ?? "")
              ? "SCRIPT_DIRECT_NEXT_START"
              : "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
            relativePath,
            "Invoke-Expression alias invocation was detected.",
            /\bnext\s+start\b/i.test(aliasInvocation[1] ?? "")
              ? "DANGEROUS"
              : "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
    const aliasNormalized = normalizePowerShellCustomAliases(
      normalizePowerShellBuiltinAliases(
        rawLine,
        overriddenAliases,
      ),
      customAliases,
    );
    const expanded = expandPowerShellVariables(
      aliasNormalized,
      variables,
    );
    const scriptBlockAssignment = rawLine.match(
      /^\s*\$([A-Za-z_][A-Za-z0-9_.\[\]"'-]*)\s*=\s*([\s\S]*)$/,
    );
    if (scriptBlockAssignment?.[1]) {
      const key = scriptBlockAssignment[1]
        .replaceAll('"', "")
        .replaceAll("'", "")
        .toLowerCase();
      const mode = scriptBlockModeFromText(
        scriptBlockAssignment[2],
      );
      if (mode) {
        scriptBlockVariables.set(key, mode);
      } else if (
        evaluatePowerShellStringExpression(
          scriptBlockAssignment[2],
          variables,
        ) !== null ||
        /^(?:-?\d+(?:\.\d+)?|\$true|\$false|\$null)$/i.test(
          scriptBlockAssignment[2].trim(),
        )
      ) {
        scriptBlockVariables.set(key, "safe");
      } else if (
        /\$|\[scriptblock\]::Create|scriptblock/i.test(
          scriptBlockAssignment[2],
        )
      ) {
        scriptBlockVariables.set(key, "unknown");
      } else if (
        powerShellMayProduceUnknownInvocation(
          scriptBlockAssignment[2],
        )
      ) {
        scriptBlockVariables.set(key, "unknown");
      } else {
        scriptBlockVariables.delete(key);
      }
    }
    if (skipAssignmentLine) {
      continue;
    }
    let matchedScriptBlockIdentity = false;
    for (const [name, mode] of scriptBlockVariables) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (
        new RegExp(
          `\\$${escapedName}(?=\\b|\\[|\\.)`,
          "i",
        ).test(aliasNormalized)
      ) {
        matchedScriptBlockIdentity = true;
      }
      const invocation =
        new RegExp(
          `^\\s*&\\s*\\$${escapedName}(?=\\b|\\[|\\.)`,
          "i",
        ).test(
          aliasNormalized,
        ) ||
        new RegExp(
          `^\\s*\\$${escapedName}(?:\\[[^\\]]+\\])?\\.Invoke\\s*\\(`,
          "i",
        ).test(aliasNormalized);
      if (!invocation || mode === "safe") {
        continue;
      }
      findings.push(
        finding(
          mode === "unknown"
            ? "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION"
            : mode === "next-start"
              ? "SCRIPT_DIRECT_NEXT_START"
              : "SCRIPT_DIRECT_WORKER_DIST",
          relativePath,
          "PowerShell ScriptBlock variable is invoked with an analyzed source.",
          mode === "unknown" ? "UNKNOWN" : "DANGEROUS",
          scriptType,
          lineNumber,
        ),
      );
    }
    for (const [functionName, body] of customFunctions) {
      if (
        !new RegExp(
          `^\\s*${functionName.replaceAll("-", "\\-")}\\b`,
          "i",
        ).test(aliasNormalized) ||
        !/(?:&\s*\$|\.Invoke\s*\()/i.test(body)
      ) {
        continue;
      }
      const mode =
        [...scriptBlockVariables].find(
          ([name, candidateMode]) =>
            candidateMode !== "safe" &&
            new RegExp(
              `\\$${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\b|\\[|\\.)`,
              "i",
            ).test(aliasNormalized),
        )?.[1] ??
        [...scriptBlockVariables].find(
          ([name, candidateMode]) =>
            candidateMode !== "safe" &&
            /(?:&\s*\$|\.Invoke\s*\()/i.test(body) &&
            new RegExp(
              `\\$${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\b|\\[|\\.)`,
              "i",
            ).test(body),
        )?.[1];
      if (!mode) {
        continue;
      }
      findings.push(
        finding(
          mode === "unknown"
            ? "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION"
            : mode === "next-start"
              ? "SCRIPT_DIRECT_NEXT_START"
              : "SCRIPT_DIRECT_WORKER_DIST",
          relativePath,
          "PowerShell ScriptBlock argument reaches an execution parameter.",
          mode === "unknown" ? "UNKNOWN" : "DANGEROUS",
          scriptType,
          lineNumber,
        ),
      );
    }
    const rawCallOperator = aliasNormalized.match(
      /^\s*&\s+([\s\S]+)$/,
    );
    const callOperator = expanded.match(/^\s*&\s+([\s\S]+)$/);
    if (callOperator?.[1]) {
      const command = callOperator[1].trim();
      const nextStart = directNextStart(command);
      const workerDist = directWorkerDist(command);
      if (nextStart || workerDist) {
        findings.push(
          finding(
            nextStart
              ? "SCRIPT_DIRECT_NEXT_START"
              : "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "PowerShell call operator reaches a forbidden startup entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      } else if (/@@/.test(command)) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "PowerShell call operator target cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      } else if (
        /^\$/.test(rawCallOperator?.[1]?.trim() ?? "") &&
        !matchedScriptBlockIdentity
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "PowerShell call operator references an unknown identity.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      } else if (!/^\$/.test(rawCallOperator?.[1]?.trim() ?? "")) {
        const mode = scriptBlockModeFromText(command);
        if (mode === "next-start" || mode === "worker-dist") {
          findings.push(
            finding(
              mode === "next-start"
                ? "SCRIPT_DIRECT_NEXT_START"
                : "SCRIPT_DIRECT_WORKER_DIST",
              relativePath,
              "PowerShell call operator resolves to a forbidden ScriptBlock.",
              "DANGEROUS",
              scriptType,
              lineNumber,
            ),
          );
        } else if (mode === "unknown") {
          findings.push(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
              relativePath,
              "PowerShell call operator target is an unknown ScriptBlock.",
              "UNKNOWN",
              scriptType,
              lineNumber,
            ),
          );
        } else {
          const literal = evaluatePowerShellStringExpression(
            command,
            variables,
          );
          if (
            literal === null ||
            !/^(?:Write-Host|Write-Output|Write-Error)\b/i.test(
              literal,
            )
          ) {
            findings.push(
              finding(
                "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
                relativePath,
                "PowerShell call operator target cannot be proven safe.",
                "UNKNOWN",
                scriptType,
                lineNumber,
              ),
            );
          }
        }
      }
    }
    for (const [name, body] of customFunctions) {
      const customPipeline = expanded.match(
        new RegExp(
          `(?:^|\\|)\\s*${name.replaceAll("-", "\\-")}\\b[^|]*\\|\\s*(?:Invoke-Expression|iex)\\b`,
          "i",
        ),
      );
      if (!customPipeline) {
        continue;
      }
      if (
        /\b(?:Get-Content|Get-Item|gc|cat|type)\b/i.test(body) ||
        /\$(?:[A-Za-z_{0-9@*#?])/.test(body)
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
            relativePath,
            "Custom PowerShell function output cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      } else if (/\bnext\s+start\b/i.test(body)) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_NEXT_START",
            relativePath,
            "Custom PowerShell function emits a forbidden startup entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      } else if (/\bdist[\\/]index\.js\b/i.test(body)) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "Custom PowerShell function emits a Worker dist entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      } else {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
            relativePath,
            "Custom PowerShell function output cannot be proven safe.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
    const dynamicExpression = expanded.match(
      /^\s*(?:Invoke-Expression|iex)\s+([\s\S]+)$/i,
    );
    if (dynamicExpression?.[1]) {
      const expression = dynamicExpression[1].trim();
      const resolved = evaluatePowerShellStringExpression(
        expression,
        variables,
      );
      if (resolved !== null) {
        if (directNextStart(resolved)) {
          findings.push(
            finding(
              "SCRIPT_DIRECT_NEXT_START",
              relativePath,
              "PowerShell dynamic expression resolves to next start.",
              "DANGEROUS",
              scriptType,
              lineNumber,
            ),
          );
        } else if (directWorkerDist(resolved)) {
          findings.push(
            finding(
              "SCRIPT_DIRECT_WORKER_DIST",
              relativePath,
              "PowerShell dynamic expression resolves to a Worker dist entry.",
              "DANGEROUS",
              scriptType,
              lineNumber,
            ),
          );
        }
      } else {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
            relativePath,
            "PowerShell Invoke-Expression input cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
    const scriptBlockBody = extractBalancedPowerShellCreateArgument(
      expanded,
    );
    if (scriptBlockBody !== null) {
      const scriptBlockInvoked =
        /(?:^|\s)&\s*\(/i.test(expanded) ||
        /\)\s*\.Invoke\s*\(/i.test(expanded) ||
        /^\s*(?:Invoke-Expression|iex|Invoke-Command)\b/i.test(
          expanded,
        );
      if (!scriptBlockInvoked) {
        // Constructing a ScriptBlock without invoking it is data creation.
      } else {
      const body = scriptBlockBody.trim();
      const resolvedBody = evaluatePowerShellStringExpression(
        body,
        variables,
      );
      if (resolvedBody === null) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
            relativePath,
            "PowerShell ScriptBlock source cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      } else if (resolvedBody !== null) {
        const normalizedBody = resolvedBody;
        const nextStart = directNextStart(normalizedBody);
        const workerDist = directWorkerDist(normalizedBody);
        if (nextStart || workerDist) {
          findings.push(
            finding(
              nextStart
                ? "SCRIPT_DIRECT_NEXT_START"
                : "SCRIPT_DIRECT_WORKER_DIST",
              relativePath,
              "PowerShell ScriptBlock contains a forbidden startup entry.",
              "DANGEROUS",
              scriptType,
              lineNumber,
            ),
          );
        }
      }
      }
    }
    if (
      /^\s*(?:Invoke-Expression|iex)\b/i.test(expanded) &&
      /\bGet-Content\b|\bGet-Item\b/i.test(expanded)
    ) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          relativePath,
          "Invoke-Expression input comes from an unresolved file source.",
          "UNKNOWN",
          scriptType,
          lineNumber,
        ),
      );
    }
    if (
      /\bGet-Content\b/i.test(expanded) &&
      /\|\s*(?:Invoke-Expression|iex)\b/i.test(expanded)
    ) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          relativePath,
          "Piped file content is passed to Invoke-Expression.",
          "UNKNOWN",
          scriptType,
          lineNumber,
        ),
      );
    }
    if (
      /^\s*Invoke-Command\b/i.test(expanded) &&
      /(?:^|\s)-FilePath(?:\s|$)/i.test(expanded)
    ) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          relativePath,
          "Invoke-Command FilePath source cannot be verified statically.",
          "UNKNOWN",
          scriptType,
          lineNumber,
        ),
      );
    }
    for (const segment of commandSegments(expanded)) {
      const lower = segment.toLowerCase();
      if (/^\s*(?:Set|New)-Alias\b/i.test(segment)) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_COMMAND_ALIAS",
            relativePath,
            "PowerShell alias prevents complete command resolution.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
      const nested = wrapperCommand(segment);
      const nestedExpanded =
        nested == null
          ? undefined
          : expandPowerShellVariables(nested, variables);
      if (
        directNextStart(segment) ||
        /&\s+(?:"?next"?)\s+(?:"?start"?)(?:\s|$)/i.test(
          segment,
        ) ||
        /\bStart-Process\b[\s\S]{0,500}\bnext\b[\s\S]{0,200}\bstart\b/i.test(
          segment,
        ) ||
        /^(?:Invoke-Expression|iex)\s+[\s\S]*\bnext\s+start\b/i.test(
          segment,
        ) ||
        (nestedExpanded && directNextStart(nestedExpanded))
      ) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_NEXT_START",
            relativePath,
            "PowerShell script invokes next start.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      if (
        directWorkerDist(segment) ||
        /&\s+(?:"?node(?:\.exe)?"?)\s+[\s\S]*\bdist[\\/]index\.js\b/i.test(
          segment,
        ) ||
        /\bStart-Process\b[\s\S]{0,500}\bnode(?:\.exe)?\b[\s\S]{0,500}\bdist[\\/]index\.js\b/i.test(
          segment,
        ) ||
        /^(?:Invoke-Expression|iex)\s+[\s\S]*\bnode(?:\.exe)?\b[\s\S]*\bdist[\\/]index\.js\b/i.test(
          segment,
        ) ||
        (nestedExpanded && directWorkerDist(nestedExpanded))
      ) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "PowerShell script invokes a Worker dist entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      if (
        /@@[A-Za-z_][A-Za-z0-9_]*@@/.test(segment) &&
        (/&\s+@@|^(?:Invoke-Command|Invoke-Expression|iex)\b|\bStart-Process\b|^(?:pwsh|powershell|cmd)\b/i.test(
          segment,
        ) ||
          lower.includes("next") ||
          lower.includes("dist"))
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "PowerShell command execution cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
  }
}

function scanCmd(
  relativePath,
  content,
  findings,
) {
  const scriptType = "cmd";
  const withoutComments = stripCmdComments(content).replace(
    /\^\r?\n/g,
    " ",
  );
  const normalizedVariables =
    extractCmdAssignments(withoutComments);

  let offset = 0;
  for (const rawLine of withoutComments.split(/\r?\n/)) {
    const lineNumber = lineNumberAt(withoutComments, offset);
    offset += rawLine.length + 1;
    const expanded = expandCmdVariables(
      rawLine,
      normalizedVariables,
    );
    for (const segment of commandSegments(expanded)) {
      const lower = segment.toLowerCase();
      if (/^\s*doskey\b/i.test(segment)) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_COMMAND_ALIAS",
            relativePath,
            "DOSKEY alias prevents complete command resolution.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
      const nested = wrapperCommand(segment);
      const nestedExpanded =
        nested == null
          ? undefined
          : expandCmdVariables(nested, normalizedVariables);
      const conditionalNextStart =
        /^\s*if\b[\s\S]{0,400}\bnext\s+start\b/i.test(
          segment,
        ) ||
        /^\s*for\b[\s\S]{0,400}\bdo\s+next\s+start\b/i.test(
          segment,
        );
      const conditionalWorkerDist =
        /^\s*if\b[\s\S]{0,400}\bnode(?:\.exe)?\b[\s\S]{0,400}\bdist[\\/]index\.js\b/i.test(
          segment,
        ) ||
        /^\s*for\b[\s\S]{0,400}\bdo\s+node(?:\.exe)?\b[\s\S]{0,400}\bdist[\\/]index\.js\b/i.test(
          segment,
        );
      if (
        directNextStart(segment) ||
        conditionalNextStart ||
        /\b(?:call|start)\b[\s\S]{0,300}\bnext\s+start\b/i.test(
          segment,
        ) ||
        (nestedExpanded && directNextStart(nestedExpanded))
      ) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_NEXT_START",
            relativePath,
            "CMD/BAT script invokes next start.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      if (
        directWorkerDist(segment) ||
        conditionalWorkerDist ||
        /\b(?:call|start)\b[\s\S]{0,300}\bnode(?:\.exe)?\b[\s\S]{0,300}\bdist[\\/]index\.js\b/i.test(
          segment,
        ) ||
        (nestedExpanded && directWorkerDist(nestedExpanded))
      ) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "CMD/BAT script invokes a Worker dist entry.",
            "DANGEROUS",
            scriptType,
            lineNumber,
          ),
        );
      }
      if (
        /@@[A-Za-z_][A-Za-z0-9_]*@@/.test(segment) &&
        (/^@@/.test(segment) ||
          /\b(?:call|start|cmd)\b/i.test(segment) ||
          lower.includes("next") ||
          lower.includes("dist"))
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "CMD/BAT command execution cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            lineNumber,
          ),
        );
      }
    }
  }
}

function literalAssignments(content) {
  const values = new Map();
  const assignment =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`$]*)\2/g;
  for (const match of content.matchAll(assignment)) {
    values.set(match[1], match[3]);
  }
  const arrays =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]{0,500}?)\]/g;
  for (const match of content.matchAll(arrays)) {
    const parts = [
      ...match[2].matchAll(/(["'`])([^"'`$]*)\1/g),
    ].map((part) => part[2]);
    if (parts.length > 0) {
      values.set(match[1], parts.join(" "));
    }
  }
  return values;
}

function expandJavaScriptIdentifiers(value, assignments) {
  let expanded = value;
  for (const [name, assigned] of assignments) {
    expanded = expanded.replace(
      new RegExp(`\\b${name.replaceAll("$", "\\$")}\\b`, "g"),
      assigned,
    );
  }
  return expanded;
}

function childProcessAliases(content) {
  const aliases = new Set(
    [...JS_PROCESS_FUNCTIONS].map(
      (name) => `(?<![.\\w$])${name}`,
    ),
  );
  for (const match of content.matchAll(
    /\bimport\s*\{([^}]+)\}\s*from\s*["'](?:node:)?child_process["']/g,
  )) {
    for (const part of match[1].split(",")) {
      const [original, alias] = part
        .trim()
        .split(/\s+as\s+/i)
        .map((value) => value.trim());
      if (JS_PROCESS_FUNCTIONS.has(original) && alias) {
        aliases.add(`(?<![.\\w$])${alias}`);
      }
    }
  }
  for (const match of content.matchAll(
    /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*["'](?:node:)?child_process["']\s*\)/g,
  )) {
    for (const part of match[1].split(",")) {
      const [original, alias] = part
        .trim()
        .split(/\s*:\s*/)
        .map((value) => value.trim());
      if (JS_PROCESS_FUNCTIONS.has(original) && alias) {
        aliases.add(`(?<![.\\w$])${alias}`);
      }
    }
  }
  for (const match of content.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["'](?:node:)?child_process["']\s*\)/g,
  )) {
    for (const processFunction of JS_PROCESS_FUNCTIONS) {
      aliases.add(
        `${match[1].replaceAll("$", "\\$")}\\.${processFunction}`,
      );
    }
  }
  for (const match of content.matchAll(
    /\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*["'](?:node:)?child_process["']/g,
  )) {
    for (const processFunction of JS_PROCESS_FUNCTIONS) {
      aliases.add(
        `${match[1].replaceAll("$", "\\$")}\\.${processFunction}`,
      );
    }
  }
  for (const processFunction of JS_PROCESS_FUNCTIONS) {
    aliases.add(
      `require\\(\\s*["'](?:node:)?child_process["']\\s*\\)\\.${processFunction}`,
    );
  }
  return aliases;
}

function firstJavaScriptCallArgument(argumentsText) {
  const trimmed = argumentsText.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.startsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.startsWith("`")
  ) {
    return quotedValue(trimmed.match(/^(["'`])([\s\S]*?)\1/)?.[2] ?? "");
  }
  return trimmed.match(/^[$A-Za-z_][\w$]*(?:\.[\w$]+)*/)?.[0] ?? null;
}

function scriptKindForPath(relativePath) {
  return relativePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : relativePath.endsWith(".ts")
      ? ts.ScriptKind.TS
      : relativePath.endsWith(".mjs")
        ? ts.ScriptKind.JS
        : relativePath.endsWith(".cjs")
          ? ts.ScriptKind.JS
          : ts.ScriptKind.JS;
}

function astLine(sourceFile, node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      .line + 1
  );
}

function consumeJavaScriptAnalysisBudget(bindings, units = 1) {
  const budget = bindings.analysisBudget;
  if (!budget) {
    return true;
  }
  if (budget.exhausted) {
    return false;
  }
  budget.astNodes += units;
  budget.abstractStates += 1;
  if (
    budget.astNodes > JAVASCRIPT_ANALYSIS_LIMITS.maxAstNodes ||
    budget.abstractStates > JAVASCRIPT_ANALYSIS_LIMITS.maxAbstractStates ||
    Date.now() > budget.deadline
  ) {
    budget.exhausted = true;
    budget.onExhausted();
    return false;
  }
  return true;
}

function literalString(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }
  return null;
}

function propertyName(node, environment = null, bindings = null) {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  if (ts.isElementAccessExpression(node)) {
    const literal = literalString(node.argumentExpression);
    if (literal !== null) {
      return literal;
    }
    if (environment && bindings) {
      const value = staticJavaScriptValue(
        node.argumentExpression,
        environment,
        bindings,
      );
      return value?.kind === "string" ? value.value : null;
    }
  }
  return null;
}

function moduleSpecifier(node) {
  return node && literalString(node);
}

function unwrapExpression(node) {
  if (!node) {
    return node;
  }
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isUnresolvedRuntimeValueExpression(expression) {
  const node = unwrapExpression(expression);
  if (!node) {
    return false;
  }
  return (
    ts.isAwaitExpression(node) ||
    ts.isCallExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isYieldExpression(node)
  );
}

function isProcessEnvironmentExpression(expression) {
  const node = unwrapExpression(expression);
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "env" &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process"
  );
}

function staticJavaScriptValue(expression, environment, bindings) {
  if (!expression) {
    return null;
  }
  const node = unwrapExpression(expression);
  const literal = literalString(node);
  if (literal !== null) {
    return { kind: "string", value: literal };
  }
  if (ts.isIdentifier(node)) {
    if (environment.has(node.text)) {
      const value = environment.get(node.text);
      if (
        ["execpath", "string"].includes(value?.kind) ||
        (value?.kind === "array" &&
          Array.isArray(value.values))
      ) {
        return value;
      }
      if (value?.kind === "array" && !Array.isArray(value.values)) {
        const constant = bindings.constants.get(node.text);
        if (
          constant?.kind === "array" &&
          Array.isArray(constant.values)
        ) {
          return constant;
        }
      }
      return null;
    }
    if (node.text === "process") {
      return null;
    }
    return null;
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "execPath"
  ) {
    return { kind: "execpath", value: "process.execPath" };
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = [];
    let partial = false;
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        partial = true;
        continue;
      }
      const value = staticJavaScriptValue(
        element,
        environment,
        bindings,
      );
      if (value?.kind === "string") {
        values.push(value.value);
      } else if (value?.kind === "array") {
        values.push(...value.values);
        partial ||= value.partial;
      } else {
        partial = true;
      }
    }
    return { kind: "array", values, partial };
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
      return null;
    }
    const left = staticJavaScriptValue(
      node.left,
      environment,
      bindings,
    );
    const right = staticJavaScriptValue(
      node.right,
      environment,
      bindings,
    );
    if (left?.kind === "string" && right?.kind === "string") {
      return { kind: "string", value: left.value + right.value };
    }
    return null;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expressionValue = staticJavaScriptValue(
        span.expression,
        environment,
        bindings,
      );
      if (expressionValue?.kind !== "string") {
        return null;
      }
      value += expressionValue.value + span.literal.text;
    }
    return { kind: "string", value };
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    const pathNamespace =
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      bindings.pathNamespaces.has(callee.expression.text)
        ? {
            namespace: callee.expression.text,
            operation: callee.name.text,
          }
        : ts.isElementAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            bindings.pathNamespaces.has(callee.expression.text)
          ? {
              namespace: callee.expression.text,
              operation: propertyName(callee),
            }
          : null;
    if (
      pathNamespace &&
      (pathNamespace.operation === "join" ||
        pathNamespace.operation === "resolve")
    ) {
      const values = [];
      for (const argument of node.arguments) {
        const value = staticJavaScriptValue(
          argument,
          environment,
          bindings,
        );
        if (value?.kind !== "string") {
          return null;
        }
        values.push(value.value);
      }
      if (values.length === 0) {
        return null;
      }
      const joined =
        pathNamespace.operation === "join"
          ? path.join(...values)
          : path.resolve(...values);
      return {
        kind: "string",
        value: joined.replaceAll("\\", "/"),
      };
    }
  }
  return null;
}

function staticJavaScriptIndex(expression, environment, bindings) {
  if (!expression) {
    return null;
  }
  const node = unwrapExpression(expression);
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  const value = staticJavaScriptValue(node, environment, bindings);
  return value?.kind === "string" && /^\d+$/.test(value.value)
    ? Number(value.value)
    : null;
}

function bindingPatternContainsName(node, name) {
  if (!node) {
    return false;
  }
  if (ts.isIdentifier(node)) {
    return node.text === name;
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    return node.elements.some((element) =>
      ts.isBindingElement(element)
        ? bindingPatternContainsName(element.name, name)
        : false,
    );
  }
  return false;
}

function scopeDeclaresName(scope, name) {
  if (
    (ts.isFunctionLike(scope) || ts.isSourceFile(scope)) &&
    ts.isFunctionLike(scope)
  ) {
    for (const parameter of scope.parameters) {
      if (bindingPatternContainsName(parameter.name, name)) {
        return true;
      }
    }
  }
  let declared = false;
  function visit(node) {
    if (declared || node === scope) {
      return;
    }
    if (
      ts.isFunctionLike(node) ||
      ts.isClassDeclaration(node)
    ) {
      const nodeName = node.name?.text;
      if (nodeName === name) {
        declared = true;
      }
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      bindingPatternContainsName(node.name, name)
    ) {
      declared = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  if (ts.isSourceFile(scope)) {
    for (const statement of scope.statements) {
      visit(statement);
    }
  } else if (ts.isFunctionLike(scope) && scope.body) {
    visit(scope.body);
  } else {
    for (const statement of scope.statements ?? []) {
      visit(statement);
    }
  }
  return declared;
}

function isDynamicNameShadowed(node, name) {
  let current = node;
  while (current) {
    if (
      (ts.isSourceFile(current) ||
        ts.isFunctionLike(current) ||
        ts.isBlock(current)) &&
      scopeDeclaresName(current, name)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function dynamicExecutionTarget(
  expression,
  bindings,
  environment,
) {
  if (!consumeJavaScriptAnalysisBudget(bindings)) {
    return null;
  }
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const environmentValue = environment.get(node.text);
    if (environmentValue) {
      return environmentValue.kind === "dynamic"
        ? environmentValue.target
        : null;
    }
    const alias = bindings.dynamicExecutionAliases.get(node.text);
    if (alias) {
      return alias;
    }
    if (
      (node.text === "eval" || node.text === "Function") &&
      !isDynamicNameShadowed(node, node.text)
    ) {
      return node.text;
    }
  }
  if (ts.isElementAccessExpression(node)) {
    if (
      ts.isIdentifier(node.expression) &&
      ["globalThis", "window", "self"].includes(
        node.expression.text,
      )
    ) {
      const property = propertyName(node, environment, bindings);
      if (property === "eval" || property === "Function") {
        return property;
      }
    }
    if (ts.isIdentifier(node.expression)) {
      const objectAlias = bindings.objectAliases.get(
        node.expression.text,
      );
      const property = propertyName(node, environment, bindings);
      const alias = property ? objectAlias?.get(property) : null;
      if (alias?.kind === "dynamic") {
        return alias.target;
      }
    }
  }
  if (ts.isPropertyAccessExpression(node)) {
    if (
      ts.isIdentifier(node.expression) &&
      ["globalThis", "window", "self"].includes(
        node.expression.text,
      ) &&
      (node.name.text === "eval" || node.name.text === "Function")
    ) {
      return node.name.text;
    }
    if (ts.isIdentifier(node.expression)) {
      const objectAlias = bindings.objectAliases.get(
        node.expression.text,
      );
      const alias = objectAlias?.get(node.name.text);
      if (alias?.kind === "dynamic") {
        return alias.target;
      }
    }
  }
  if (ts.isConditionalExpression(node)) {
    return (
      dynamicExecutionTarget(
        node.whenTrue,
        bindings,
        environment,
      ) ??
      dynamicExecutionTarget(
        node.whenFalse,
        bindings,
        environment,
      )
    );
  }
  if (ts.isElementAccessExpression(node)) {
    const indexValue =
      ts.isNumericLiteral(node.argumentExpression)
        ? Number(node.argumentExpression.text)
        : null;
    const arrayAlias =
      ts.isArrayLiteralExpression(unwrapExpression(node.expression))
        ? {
            kind: "array",
            elements: unwrapExpression(node.expression).elements.map(
              (element) =>
                ts.isSpreadElement(element)
                  ? null
                  : directAliasForExpression(
                      element,
                      bindings,
                      environment,
                    ),
            ),
          }
        : directAliasForExpression(
            node.expression,
            bindings,
            environment,
          );
    if (arrayAlias?.kind === "array") {
      const elements = Array.isArray(arrayAlias.elements)
        ? arrayAlias.elements
        : [];
      const candidates =
        indexValue === null
          ? elements
          : [elements[indexValue] ?? null];
      for (const candidate of candidates) {
        if (candidate?.kind === "dynamic") {
          return candidate.target;
        }
      }
    }
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return dynamicExecutionTarget(
      node.right,
      bindings,
      environment,
    );
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      propertyName(callee, environment, bindings) === "bind"
    ) {
      return dynamicExecutionTarget(
        callee.expression,
        bindings,
        environment,
      );
    }
  }
  return null;
}

function bindingName(node) {
  return ts.isIdentifier(node) ? node.text : null;
}

function collectJavaScriptBindings(sourceFile) {
  const bindings = {
    constants: new Map(),
    functions: new Map(),
    pathNamespaces: new Set(),
    processAliases: new Map(),
    childProcessNamespaces: new Set(),
    requireAliases: new Set(),
    dynamicExecutionAliases: new Map(),
    shadowedDynamicGlobals: new Set(),
    objectAliases: new Map(),
    aliasValues: new Map(),
    functionCaptures: new Map(),
    reflectNamespaces: new Set(["Reflect"]),
  };
  const variableDeclarations = [];

  function bindChildProcessPattern(pattern, moduleName) {
    if (!CHILD_PROCESS_MODULES.has(moduleName)) {
      return;
    }
    if (ts.isIdentifier(pattern)) {
      bindings.childProcessNamespaces.add(pattern.text);
      return;
    }
    for (const element of pattern.elements) {
      if (!ts.isBindingElement(element)) {
        continue;
      }
      const local = bindingName(element.name);
      const imported = element.propertyName
        ? bindingName(element.propertyName)
        : local;
      if (local && imported && JS_PROCESS_FUNCTIONS.has(imported)) {
        bindings.processAliases.set(local, imported);
      }
    }
  }

  function bindPathPattern(pattern, moduleName) {
    if (!PATH_MODULES.has(moduleName)) {
      return;
    }
    if (ts.isIdentifier(pattern)) {
      bindings.pathNamespaces.add(pattern.text);
    }
  }

  function inspectBindingDeclaration(declaration) {
    if (!declaration.initializer) {
      return;
    }
    let initializer = unwrapExpression(declaration.initializer);
    if (ts.isAwaitExpression(initializer)) {
      initializer = unwrapExpression(initializer.expression);
    }
    if (ts.isCallExpression(initializer)) {
      const callee = unwrapExpression(initializer.expression);
      const isRequire =
        (ts.isIdentifier(callee) &&
          (callee.text === "require" ||
            bindings.requireAliases.has(callee.text))) ||
        (ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === "require" &&
          callee.name.text === "resolve");
      const isDynamicImport =
        callee.kind === ts.SyntaxKind.ImportKeyword;
      const moduleName = moduleSpecifier(initializer.arguments[0]);
      if ((isRequire || isDynamicImport) && moduleName !== null) {
        bindChildProcessPattern(declaration.name, moduleName);
        bindPathPattern(declaration.name, moduleName);
      } else {
        variableDeclarations.push(declaration);
      }
      return;
    }
    variableDeclarations.push(declaration);
  }

  function visit(node) {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node))
    ) {
      if (node.name && ["eval", "Function"].includes(node.name.text)) {
        bindings.shadowedDynamicGlobals.add(node.name.text);
      }
      for (const parameter of node.parameters) {
        const name = bindingName(parameter.name);
        if (name && ["eval", "Function"].includes(name)) {
          bindings.shadowedDynamicGlobals.add(name);
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "then" &&
      ts.isCallExpression(unwrapExpression(node.expression.expression)) &&
      unwrapExpression(node.expression.expression).expression.kind ===
        ts.SyntaxKind.ImportKeyword
    ) {
      const importCall = unwrapExpression(
        node.expression.expression,
      );
      const moduleName = moduleSpecifier(importCall.arguments[0]);
      const callback = node.arguments[0] && unwrapExpression(node.arguments[0]);
      if (
        moduleName &&
        callback &&
        (ts.isArrowFunction(callback) ||
          ts.isFunctionExpression(callback)) &&
        callback.parameters[0]
      ) {
        bindChildProcessPattern(
          callback.parameters[0].name,
          moduleName,
        );
        bindPathPattern(callback.parameters[0].name, moduleName);
      }
    }
    if (ts.isImportDeclaration(node)) {
      const moduleName = moduleSpecifier(node.moduleSpecifier);
      if (moduleName && CHILD_PROCESS_MODULES.has(moduleName)) {
        const clause = node.importClause;
        if (clause?.name) {
          bindings.childProcessNamespaces.add(clause.name.text);
        }
        if (clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            bindings.childProcessNamespaces.add(
              clause.namedBindings.name.text,
            );
          } else {
            for (const element of clause.namedBindings.elements) {
              const imported = element.propertyName?.text ?? element.name.text;
              if (JS_PROCESS_FUNCTIONS.has(imported)) {
                bindings.processAliases.set(element.name.text, imported);
              }
            }
          }
        }
      }
      if (moduleName && PATH_MODULES.has(moduleName)) {
        const clause = node.importClause;
        if (clause?.name) {
          bindings.pathNamespaces.add(clause.name.text);
        }
        if (
          clause?.namedBindings &&
          ts.isNamespaceImport(clause.namedBindings)
        ) {
          bindings.pathNamespaces.add(clause.namedBindings.name.text);
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      bindings.functions.set(node.name.text, node);
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        const name = bindingName(declaration.name);
        if (name && ["eval", "Function"].includes(name)) {
          bindings.shadowedDynamicGlobals.add(name);
        }
        if (name && declaration.initializer) {
          const initializer = unwrapExpression(declaration.initializer);
          if (
            ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer)
          ) {
            bindings.functions.set(name, initializer);
          }
          if (
            ts.isIdentifier(initializer) &&
            initializer.text === "require"
          ) {
            bindings.requireAliases.add(name);
          }
          if (
            ts.isIdentifier(initializer) &&
            bindings.reflectNamespaces.has(initializer.text)
          ) {
            bindings.reflectNamespaces.add(name);
          }
          if (
            ts.isPropertyAccessExpression(initializer) &&
            ts.isIdentifier(initializer.expression) &&
            bindings.childProcessNamespaces.has(
              initializer.expression.text,
            ) &&
            JS_PROCESS_FUNCTIONS.has(initializer.name.text)
          ) {
            bindings.processAliases.set(
              name,
              initializer.name.text,
            );
          }
          if (
            ts.isElementAccessExpression(initializer) &&
            ts.isIdentifier(initializer.expression) &&
            bindings.childProcessNamespaces.has(
              initializer.expression.text,
            )
          ) {
            const property = propertyName(initializer);
            if (property && JS_PROCESS_FUNCTIONS.has(property)) {
              bindings.processAliases.set(name, property);
            }
          }
          if (
            ts.isIdentifier(initializer) &&
            bindings.processAliases.has(initializer.text)
          ) {
            bindings.processAliases.set(
              name,
              bindings.processAliases.get(initializer.text),
            );
          }
          const dynamicTarget = dynamicExecutionTarget(
            initializer,
            bindings,
            bindings.constants,
          );
          if (dynamicTarget) {
            bindings.dynamicExecutionAliases.set(name, dynamicTarget);
          }
        }
        inspectBindingDeclaration(declaration);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  function setAliasBinding(name, value) {
    if (!name || !value) {
      return;
    }
    bindings.aliasValues.set(name, value);
    if (value.kind === "process") {
      bindings.processAliases.set(name, value.api);
    } else if (value.kind === "dynamic") {
      bindings.dynamicExecutionAliases.set(name, value.target);
    } else if (value.kind === "function") {
      bindings.functions.set(name, value.node);
      bindings.functionCaptures.set(name, value.captured);
    }
  }

  function unknownBindingsForPattern(pattern) {
    const values = new Map();
    function visit(node) {
      if (ts.isIdentifier(node)) {
        values.set(node.text, { kind: "unknown" });
        return;
      }
      if (
        ts.isArrayBindingPattern(node) ||
        ts.isObjectBindingPattern(node)
      ) {
        for (const element of node.elements) {
          if (ts.isBindingElement(element)) {
            visit(element.name);
          }
        }
      }
    }
    visit(pattern);
    return values;
  }

  function mergeBindingMaps(left, right) {
    const merged = new Map(left);
    for (const [name, value] of right) {
      merged.set(
        name,
        mergePotentialAliasValues(merged.get(name) ?? null, value),
      );
    }
    return merged;
  }

  function bindingsForPattern(pattern, value, depth = 0) {
    if (depth > JAVASCRIPT_ANALYSIS_LIMITS.maxDepth) {
      return unknownBindingsForPattern(pattern);
    }
    if (ts.isIdentifier(pattern)) {
      return new Map(
        value ? [[pattern.text, value]] : [],
      );
    }
    if (ts.isArrayBindingPattern(pattern)) {
      if (value?.kind !== "array") {
        return unknownBindingsForPattern(pattern);
      }
      const elements = Array.isArray(value.elements)
        ? value.elements
        : [];
      let result = new Map();
      pattern.elements.forEach((element, index) => {
        if (!ts.isBindingElement(element)) {
          return;
        }
        result = mergeBindingMaps(
          result,
          bindingsForPattern(
            element.name,
            elements[index] ?? null,
            depth + 1,
          ),
        );
      });
      return result;
    }
    if (ts.isObjectBindingPattern(pattern)) {
      if (
        value?.kind !== "object" ||
        !(value.properties instanceof Map)
      ) {
        return unknownBindingsForPattern(pattern);
      }
      let result = new Map();
      for (const element of pattern.elements) {
        if (!ts.isBindingElement(element)) {
          continue;
        }
        let candidates = [];
        if (
          element.propertyName &&
          ts.isComputedPropertyName(element.propertyName)
        ) {
          const keyValue =
            literalString(element.propertyName.expression) ??
            (() => {
              const resolved = staticJavaScriptValue(
                element.propertyName.expression,
                bindings.constants,
                bindings,
              );
              return resolved?.kind === "string"
                ? resolved.value
                : null;
            })();
          candidates =
            keyValue === null
              ? [...value.properties.values()]
              : [value.properties.get(keyValue) ?? null];
        } else {
          const property = element.propertyName
            ? bindingName(element.propertyName)
            : bindingName(element.name);
          if (property) {
            candidates = [value.properties.get(property) ?? null];
          }
        }
        if (element.initializer) {
          const fallback = directAliasForExpression(
            element.initializer,
            bindings,
            bindings.constants,
          );
          candidates =
            candidates.length === 0
              ? [fallback]
              : candidates.map((candidate) =>
                  mergePotentialAliasValues(candidate, fallback),
                );
        }
        if (candidates.length === 0) {
          result = mergeBindingMaps(
            result,
            unknownBindingsForPattern(element.name),
          );
          continue;
        }
        for (const candidate of candidates) {
          result = mergeBindingMaps(
            result,
            bindingsForPattern(
              element.name,
              candidate,
              depth + 1,
            ),
          );
        }
      }
      return result;
    }
    return new Map();
  }

  function bindAliasPattern(pattern, value) {
    for (const [name, alias] of bindingsForPattern(pattern, value)) {
      setAliasBinding(name, alias);
    }
  }

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const declaration of variableDeclarations) {
      const name = bindingName(declaration.name);
      const initializer = declaration.initializer
        ? unwrapExpression(declaration.initializer)
        : null;
      if (
        initializer &&
        (ts.isArrayBindingPattern(declaration.name) ||
          ts.isObjectBindingPattern(declaration.name))
      ) {
        const sourceAlias = directAliasForExpression(
          initializer,
          bindings,
          bindings.constants,
        );
        bindAliasPattern(declaration.name, sourceAlias);
      }
      if (
        ts.isObjectBindingPattern(declaration.name) &&
        initializer &&
        ts.isIdentifier(initializer)
      ) {
        if (
          bindings.childProcessNamespaces.has(initializer.text)
        ) {
          bindChildProcessPattern(
            declaration.name,
            "node:child_process",
          );
        }
        if (bindings.pathNamespaces.has(initializer.text)) {
          bindPathPattern(declaration.name, "node:path");
        }
        if (bindings.reflectNamespaces.has(initializer.text)) {
          for (const element of declaration.name.elements) {
            if (!ts.isBindingElement(element)) {
              continue;
            }
            const local = bindingName(element.name);
            const property = element.propertyName
              ? bindingName(element.propertyName)
              : local;
            if (
              local &&
              (property === "apply" || property === "construct")
            ) {
              setAliasBinding(local, {
                kind: "reflect",
                operation: property,
              });
            }
          }
        }
        const objectAlias = bindings.objectAliases.get(
          initializer.text,
        );
        if (objectAlias) {
          for (const element of declaration.name.elements) {
            if (!ts.isBindingElement(element)) {
              continue;
            }
            const local = bindingName(element.name);
            const property = element.propertyName
              ? bindingName(element.propertyName)
              : local;
            if (!local || !property) {
              continue;
            }
            const value = objectAlias.get(property);
            if (value) {
              bindings.aliasValues.set(local, value);
              if (value.kind === "process") {
                bindings.processAliases.set(local, value.api);
              } else if (value.kind === "dynamic") {
                bindings.dynamicExecutionAliases.set(
                  local,
                  value.target,
                );
              } else if (value.kind === "function") {
                bindings.functions.set(local, value.node);
                bindings.functionCaptures.set(local, value.captured);
              }
            }
          }
        }
      }
      if (!name || !declaration.initializer) {
        continue;
      }
      const value = staticJavaScriptValue(
        declaration.initializer,
        bindings.constants,
        bindings,
      );
      if (value) {
        const previous = bindings.constants.get(name);
        if (
          !previous ||
          valueText(previous) !== valueText(value)
        ) {
          bindings.constants.set(name, value);
          changed = true;
        }
      }
      const alias = directAliasForExpression(
        initializer,
        bindings,
        bindings.constants,
      );
      if (alias) {
        const previousAlias = bindings.aliasValues.get(name);
        if (previousAlias !== alias) {
          bindings.aliasValues.set(name, alias);
          changed = true;
        }
        if (alias.kind === "process") {
          bindings.processAliases.set(name, alias.api);
        } else if (alias.kind === "dynamic") {
          bindings.dynamicExecutionAliases.set(
            name,
            alias.target,
          );
        } else if (alias.kind === "object") {
          bindings.objectAliases.set(name, alias.properties);
        } else if (alias.kind === "function") {
          bindings.functions.set(name, alias.node);
          bindings.functionCaptures.set(name, alias.captured);
        }
      }
      const boundTarget =
        ts.isCallExpression(initializer) &&
        ts.isPropertyAccessExpression(initializer.expression) &&
        initializer.expression.name.text === "bind"
          ? processApiForExpression(
              initializer.expression.expression,
              bindings,
              bindings.constants,
            )
          : processApiForExpression(
              initializer,
              bindings,
              bindings.constants,
            );
      if (boundTarget && bindings.processAliases.get(name) !== boundTarget) {
        bindings.processAliases.set(name, boundTarget);
        changed = true;
      }
      const dynamicTarget = dynamicExecutionTarget(
        initializer,
        bindings,
        bindings.constants,
      );
      if (
        dynamicTarget &&
        bindings.dynamicExecutionAliases.get(name) !== dynamicTarget
      ) {
        bindings.dynamicExecutionAliases.set(name, dynamicTarget);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return bindings;
}

function processApiForExpression(expression, bindings, environment) {
  if (!consumeJavaScriptAnalysisBudget(bindings)) {
    return null;
  }
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const environmentValue = environment.get(node.text);
    if (environmentValue) {
      return environmentValue.kind === "process"
        ? environmentValue.api
        : null;
    }
    return bindings.processAliases.get(node.text) ?? null;
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return processApiForExpression(
      node.right,
      bindings,
      environment,
    );
  }
  if (ts.isConditionalExpression(node)) {
    return (
      processApiForExpression(
        node.whenTrue,
        bindings,
        environment,
      ) ??
      processApiForExpression(
        node.whenFalse,
        bindings,
        environment,
      )
    );
  }
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    if (
      ts.isCallExpression(receiver) &&
      ts.isIdentifier(unwrapExpression(receiver.expression)) &&
      unwrapExpression(receiver.expression).text === "require" &&
      CHILD_PROCESS_MODULES.has(
        moduleSpecifier(receiver.arguments[0]) ?? "",
      ) &&
      JS_PROCESS_FUNCTIONS.has(node.name.text)
    ) {
      return node.name.text;
    }
    if (
      ts.isIdentifier(node.expression) &&
      bindings.childProcessNamespaces.has(node.expression.text) &&
      JS_PROCESS_FUNCTIONS.has(node.name.text)
    ) {
      return node.name.text;
    }
    if (ts.isIdentifier(node.expression)) {
      const objectAlias = bindings.objectAliases.get(
        node.expression.text,
      );
      const alias = objectAlias?.get(node.name.text);
      if (alias?.kind === "process") {
        return alias.api;
      }
    }
  }
  if (ts.isElementAccessExpression(node)) {
    const property = propertyName(node, environment, bindings);
    const indexValue =
      ts.isNumericLiteral(node.argumentExpression)
        ? Number(node.argumentExpression.text)
        : null;
    const arrayAlias =
      ts.isArrayLiteralExpression(unwrapExpression(node.expression))
        ? {
            kind: "array",
            elements: unwrapExpression(node.expression).elements.map(
              (element) =>
                ts.isSpreadElement(element)
                  ? null
                  : directAliasForExpression(
                      element,
                      bindings,
                      environment,
                    ),
            ),
          }
        : directAliasForExpression(
            node.expression,
            bindings,
            environment,
          );
    if (arrayAlias?.kind === "array") {
      const elements = Array.isArray(arrayAlias.elements)
        ? arrayAlias.elements
        : [];
      const candidates =
        indexValue === null
          ? elements
          : [elements[indexValue] ?? null];
      for (const candidate of candidates) {
        if (candidate?.kind === "process") {
          return candidate.api;
        }
      }
    }
    const receiver = unwrapExpression(node.expression);
    if (
      property &&
      ts.isCallExpression(receiver) &&
      ts.isIdentifier(unwrapExpression(receiver.expression)) &&
      unwrapExpression(receiver.expression).text === "require" &&
      CHILD_PROCESS_MODULES.has(
        moduleSpecifier(receiver.arguments[0]) ?? "",
      ) &&
      JS_PROCESS_FUNCTIONS.has(property)
    ) {
      return property;
    }
    if (
      property &&
      ts.isIdentifier(node.expression) &&
      bindings.childProcessNamespaces.has(node.expression.text) &&
      JS_PROCESS_FUNCTIONS.has(property)
    ) {
      return property;
    }
    if (ts.isIdentifier(node.expression)) {
      const objectAlias = bindings.objectAliases.get(
        node.expression.text,
      );
      const alias = objectAlias?.get(property);
      if (alias?.kind === "process") {
        return alias.api;
      }
    }
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      propertyName(callee, environment, bindings) === "bind"
    ) {
      return processApiForExpression(
        callee.expression,
        bindings,
        environment,
      );
    }
  }
  return null;
}

function functionReturnExpressions(functionNode) {
  const results = [];
  function visit(node) {
    if (
      node !== functionNode &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node))
    ) {
      return;
    }
    if (ts.isReturnStatement(node) && node.expression) {
      results.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  }
  if (functionNode.body) {
    if (ts.isBlock(functionNode.body)) {
      visit(functionNode.body);
    } else {
      results.push(functionNode.body);
    }
  }
  return results;
}

function mergePotentialAliasValues(left, right) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  for (const kind of ["process", "dynamic", "reflect"]) {
    if (left.kind === kind) {
      return left;
    }
    if (right.kind === kind) {
      return right;
    }
  }
  if (left.kind === "unknown" || right.kind === "unknown") {
    return { kind: "unknown" };
  }
  return left.kind === right.kind ? left : { kind: "unknown" };
}

function dangerousCandidateFromAliases(values) {
  const candidates = Array.isArray(values) ? values : [];
  for (const kind of ["process", "dynamic", "reflect"]) {
    const match = candidates.find((value) => value?.kind === kind);
    if (match) {
      return match;
    }
  }
  if (candidates.some((value) => value?.kind === "unknown")) {
    return { kind: "unknown" };
  }
  return null;
}

function dangerousCandidateFromObject(value) {
  if (
    value?.kind !== "object" ||
    !(value.properties instanceof Map)
  ) {
    return null;
  }
  return dangerousCandidateFromAliases([
    ...value.properties.values(),
  ]);
}

function safeCallableCandidateFromObject(value) {
  if (
    value?.kind !== "object" ||
    !(value.properties instanceof Map)
  ) {
    return null;
  }
  return (
    [...value.properties.values()].find(
      (candidate) => candidate?.kind === "function",
    ) ?? null
  );
}

function dangerousCandidateFromArray(value) {
  if (value?.kind !== "array") {
    return null;
  }
  const candidates = Array.isArray(value.elements)
    ? value.elements
    : [];
  if (value.elementsUnknown) {
    return { kind: "unknown" };
  }
  return dangerousCandidateFromAliases(candidates);
}

function directAliasForExpression(
  expression,
  bindings,
  environment,
  depth = 0,
) {
  if (!expression) {
    return null;
  }
  if (depth > JAVASCRIPT_ANALYSIS_LIMITS.maxDepth) {
    return { kind: "unknown" };
  }
  if (!consumeJavaScriptAnalysisBudget(bindings)) {
    return { kind: "unknown" };
  }
  const node = unwrapExpression(expression);
  const api = processApiForExpression(
    node,
    bindings,
    environment,
  );
  if (api) {
    return { kind: "process", api };
  }
  const dynamic = dynamicExecutionTarget(
    node,
    bindings,
    environment,
  );
  if (dynamic) {
    return { kind: "dynamic", target: dynamic };
  }
  if (ts.isIdentifier(node)) {
    const environmentValue = environment.get(node.text);
    if (
      environmentValue &&
      [
        "array",
        "dynamic",
        "function",
        "object",
        "process",
        "reflect",
        "unknown",
      ].includes(environmentValue.kind)
    ) {
      return environmentValue;
    }
    const existingAlias = bindings.aliasValues.get(node.text);
    if (existingAlias) {
      return existingAlias;
    }
    const functionNode = bindings.functions.get(node.text);
    if (functionNode) {
      return {
        kind: "function",
        node: functionNode,
        captured: new Map(),
      };
    }
    return null;
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return directAliasForExpression(
      node.right,
      bindings,
      environment,
      depth + 1,
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
    ].includes(node.operatorToken.kind)
  ) {
    return mergePotentialAliasValues(
      directAliasForExpression(
        node.left,
        bindings,
        environment,
        depth + 1,
      ),
      directAliasForExpression(
        node.right,
        bindings,
        environment,
        depth + 1,
      ),
    );
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = directAliasForExpression(
      node.whenTrue,
      bindings,
      environment,
      depth + 1,
    );
    const whenFalse = directAliasForExpression(
      node.whenFalse,
      bindings,
      environment,
      depth + 1,
    );
    if (!whenTrue) {
      return whenFalse;
    }
    if (!whenFalse) {
      return whenTrue;
    }
    if (whenTrue.kind !== whenFalse.kind) {
      return ["dynamic", "process"].includes(whenTrue.kind)
        ? whenTrue
        : ["dynamic", "process"].includes(whenFalse.kind)
          ? whenFalse
          : null;
    }
    return whenTrue;
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    if (isProcessEnvironmentExpression(node)) {
      return { kind: "unknown" };
    }
    const property = propertyName(node, environment, bindings);
    const base = directAliasForExpression(
      node.expression,
      bindings,
      environment,
      depth + 1,
    );
    if (
      property &&
      ts.isIdentifier(node.expression) &&
      bindings.reflectNamespaces.has(node.expression.text) &&
      (property === "apply" || property === "construct")
    ) {
      return { kind: "reflect", operation: property };
    }
    if (base?.kind === "reflect") {
      return base;
    }
    if (
      ts.isElementAccessExpression(node) &&
      base?.kind === "array"
    ) {
      const indexValue =
        ts.isNumericLiteral(node.argumentExpression)
          ? Number(node.argumentExpression.text)
          : (() => {
              const value = staticJavaScriptValue(
                node.argumentExpression,
                environment,
                bindings,
              );
              return value?.kind === "string" &&
                /^\d+$/.test(value.value)
                ? Number(value.value)
                : null;
            })();
      const elements = Array.isArray(base.elements)
        ? base.elements
        : [];
      const candidates =
        indexValue === null
          ? elements
          : [elements[indexValue] ?? null];
      if (base.elementsUnknown) {
        return { kind: "unknown" };
      }
      if (indexValue !== null) {
        return candidates[0] ?? null;
      }
      return (
        candidates.find(
          (candidate) =>
            candidate?.kind === "dynamic" ||
            candidate?.kind === "process",
        ) ??
        candidates.find(
          (candidate) =>
            candidate?.kind === "object" ||
            candidate?.kind === "function",
        ) ??
        null
      );
    }
    if (base?.kind === "object" && property) {
      return base.properties.get(property) ?? null;
    }
    if (base?.kind === "object") {
      return (
        dangerousCandidateFromObject(base) ??
        safeCallableCandidateFromObject(base)
      );
    }
    if (property && ts.isIdentifier(node.expression)) {
      return (
        bindings.objectAliases
          .get(node.expression.text)
          ?.get(property) ?? null
      );
    }
    if (ts.isIdentifier(node.expression)) {
      const objectAlias = bindings.objectAliases.get(
        node.expression.text,
      );
      if (objectAlias) {
        return dangerousCandidateFromAliases([
          ...objectAlias.values(),
        ]);
      }
    }
  }
  if (ts.isObjectLiteralExpression(node)) {
    const properties = new Map();
    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !property.name
      ) {
        continue;
      }
      const propertyAlias = ts.isIdentifier(property.name)
        ? property.name.text
        : literalString(property.name);
      if (!propertyAlias) {
        continue;
      }
      const value = directAliasForExpression(
        property.initializer,
        bindings,
        environment,
        depth + 1,
      );
      if (value) {
        properties.set(propertyAlias, value);
      }
    }
    return { kind: "object", properties };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return {
      kind: "array",
      elements: node.elements.map((element) =>
        ts.isSpreadElement(element)
          ? null
          : directAliasForExpression(
              element,
              bindings,
              environment,
              depth + 1,
            ),
      ),
    };
  }
  if (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  ) {
    return {
      kind: "function",
      node,
      captured: new Map(
        [...environment].filter(([, value]) =>
          [
            "array",
            "process",
            "dynamic",
            "object",
            "function",
            "reflect",
            "unknown",
          ].includes(
            value?.kind,
          ),
        ),
      ),
    };
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      propertyName(callee, environment, bindings) === "at"
    ) {
      const arrayValue = directAliasForExpression(
        callee.expression,
        bindings,
        environment,
        depth + 1,
      );
      if (arrayValue?.kind === "array") {
        const elements = Array.isArray(arrayValue.elements)
          ? arrayValue.elements
          : [];
        const index = staticJavaScriptIndex(
          node.arguments[0],
          environment,
          bindings,
        );
        if (index !== null) {
          return elements[index] ?? null;
        }
        return (
          elements.find((value) =>
            ["dynamic", "process", "reflect"].includes(value?.kind),
          ) ?? (elements.length > 0
            ? { kind: "unknown" }
            : null)
        );
      }
    }
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      propertyName(callee, environment, bindings) === "bind"
    ) {
      return directAliasForExpression(
        callee.expression,
        bindings,
        environment,
        depth + 1,
      );
    }
    const functionValue = directAliasForExpression(
      callee,
      bindings,
      environment,
      depth + 1,
    );
    if (functionValue?.kind === "function") {
      const captured = new Map(functionValue.captured);
      functionValue.node.parameters.forEach((parameter, index) => {
        const name = bindingName(parameter.name);
        if (!name) {
          return;
        }
        const value = directAliasForExpression(
          node.arguments[index],
          bindings,
          environment,
          depth + 1,
        );
        if (value) {
          captured.set(name, value);
        }
      });
      for (const returnExpression of functionReturnExpressions(
        functionValue.node,
      )) {
        const returned = directAliasForExpression(
          returnExpression,
          bindings,
          new Map([...environment, ...captured]),
          depth + 1,
        );
        if (returned) {
          return returned.kind === "function"
            ? {
                ...returned,
                captured: new Map([
                  ...returned.captured,
                  ...captured,
                ]),
              }
            : returned;
        }
      }
    }
  }
  return null;
}

function valueText(value) {
  if (!value) {
    return null;
  }
  if (value.kind === "string" || value.kind === "execpath") {
    return value.value;
  }
  return value.kind === "array" &&
    Array.isArray(value.values)
    ? value.values.join(" ")
    : null;
}

function scanJavaScriptAst(
  relativePath,
  content,
  findings,
  analysisState = {
    depth: 0,
    dynamicBodies: new Set(),
  },
) {
  const scriptType = "javascript";
  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(relativePath),
  );
  const diagnostics = sourceFile.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    findings.push(
      finding(
        "SCRIPT_PARSE_ERROR",
        relativePath,
        "JavaScript/TypeScript source could not be parsed completely.",
        "ERROR",
        scriptType,
        sourceFile.getLineAndCharacterOfPosition(
          diagnostics[0].start ?? 0,
        ).line + 1,
      ),
    );
  }

  const bindings = collectJavaScriptBindings(sourceFile);
  const seen = new Set();
  const activeFunctions = new Set();
  const budget =
    analysisState.budget ?? {
      abstractStates: 0,
      astNodes: 0,
      deadline:
        Date.now() + JAVASCRIPT_ANALYSIS_LIMITS.maxMilliseconds,
      exhausted: false,
      onExhausted() {
        pushOnce(
          finding(
            "SCRIPT_ANALYSIS_BUDGET_EXHAUSTED",
            relativePath,
            "JavaScript analysis budget was exhausted.",
            "ERROR",
            scriptType,
          ),
        );
      },
    };
  bindings.analysisBudget = budget;

  function analyzeDynamicBody(body, node) {
    if (analysisState.depth >= 8) {
      pushOnce(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          relativePath,
          "Dynamic execution nesting exceeds the static analysis limit.",
          "UNKNOWN",
          scriptType,
          astLine(sourceFile, node),
        ),
      );
      return;
    }
    if (analysisState.dynamicBodies.has(body)) {
      return;
    }
    analysisState.dynamicBodies.add(body);
    scanJavaScriptAst(relativePath, body, findings, {
      budget,
      depth: analysisState.depth + 1,
      dynamicBodies: analysisState.dynamicBodies,
    });
  }

  function pushOnce(value) {
    const key = [
      value.code,
      value.file,
      value.line ?? "",
      value.message,
    ].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      findings.push(value);
    }
  }

  function cloneAliasValue(value, depth = 0) {
    if (!value || depth > JAVASCRIPT_ANALYSIS_LIMITS.maxDepth) {
      return value;
    }
    if (value.kind === "array") {
      return {
        ...value,
        elements: (value.elements ?? []).map((element) =>
          cloneAliasValue(element, depth + 1),
        ),
        ...(Array.isArray(value.values)
          ? { values: [...value.values] }
          : {}),
      };
    }
    if (value.kind === "object") {
      return {
        ...value,
        properties: new Map(
          [...value.properties].map(([name, alias]) => [
            name,
            cloneAliasValue(alias, depth + 1),
          ]),
        ),
      };
    }
    if (value.kind === "function") {
      return {
        ...value,
        captured: new Map(
          [...value.captured].map(([name, alias]) => [
            name,
            cloneAliasValue(alias, depth + 1),
          ]),
        ),
      };
    }
    return { ...value };
  }

  function mergeAliasValues(left, right) {
    if (!left) {
      return cloneAliasValue(right);
    }
    if (!right) {
      return cloneAliasValue(left);
    }
    for (const kind of ["dynamic", "process", "reflect"]) {
      if (left.kind === kind) {
        return left;
      }
      if (right.kind === kind) {
        return right;
      }
    }
    if (left.kind === "unknown" || right.kind === "unknown") {
      return { kind: "unknown" };
    }
    if (left.kind === "array" && right.kind === "array") {
      const length = Math.max(
        left.elements?.length ?? 0,
        right.elements?.length ?? 0,
      );
      return {
        kind: "array",
        elementsUnknown:
          Boolean(left.elementsUnknown) ||
          Boolean(right.elementsUnknown),
        elements: Array.from({ length }, (_, index) =>
          mergeAliasValues(
            left.elements?.[index] ?? null,
            right.elements?.[index] ?? null,
          ),
        ),
        ...(Array.isArray(left.values) && Array.isArray(right.values)
          ? {
              values:
                left.values.length === right.values.length &&
                left.values.every(
                  (value, index) => value === right.values[index],
                )
                  ? [...left.values]
                  : [],
              partial: true,
            }
          : {}),
        partial: Boolean(left.partial) || Boolean(right.partial),
      };
    }
    if (left.kind === "object" && right.kind === "object") {
      const properties = new Map();
      for (const name of new Set([
        ...left.properties.keys(),
        ...right.properties.keys(),
      ])) {
        properties.set(
          name,
          mergeAliasValues(
            left.properties.get(name) ?? null,
            right.properties.get(name) ?? null,
          ),
        );
      }
      return { kind: "object", properties };
    }
    return left.kind === right.kind
      ? cloneAliasValue(left)
      : { kind: "unknown" };
  }

  function mergeEnvironments(left, right) {
    const merged = new Map(
      [...left].map(([name, value]) => [
        name,
        cloneAliasValue(value),
      ]),
    );
    for (const [name, value] of right) {
      merged.set(
        name,
        mergeAliasValues(left.get(name), value),
      );
    }
    return merged;
  }

  function mergeAliasAndConstant(aliasValue, constantValue) {
    if (
      aliasValue?.kind === "array" &&
      constantValue?.kind === "array"
    ) {
      return {
        ...aliasValue,
        values: constantValue.values,
        partial:
          Boolean(aliasValue.partial) ||
          Boolean(constantValue.partial),
      };
    }
    return aliasValue ?? constantValue ?? null;
  }

  function assignAliasToTarget(target, value, environmentMap) {
    if (ts.isIdentifier(target)) {
      environmentMap.set(target.text, value ?? { kind: "safe" });
      return;
    }
    if (ts.isElementAccessExpression(target)) {
      const base = directAliasForExpression(
        target.expression,
        bindings,
        environmentMap,
      );
      if (base?.kind === "array") {
        if (!Array.isArray(base.elements)) {
          base.elements = [];
        }
        const index = staticJavaScriptIndex(
          target.argumentExpression,
          environmentMap,
          bindings,
        );
        if (index === null) {
          base.elementsUnknown = true;
        } else {
          base.elements[index] = value ?? null;
        }
      } else if (base?.kind === "object") {
        const property = propertyName(
          target,
          environmentMap,
          bindings,
        );
        if (property) {
          base.properties.set(property, value ?? null);
        } else {
          base.kind = "unknown";
        }
      } else if (base) {
        base.kind = "unknown";
      }
      return;
    }
    if (ts.isPropertyAccessExpression(target)) {
      const base = directAliasForExpression(
        target.expression,
        bindings,
        environmentMap,
      );
      if (base?.kind === "object") {
        base.properties.set(
          target.name.text,
          value ?? null,
        );
      } else if (base) {
        base.kind = "unknown";
      }
      return;
    }
    if (
      ts.isArrayLiteralExpression(target) &&
      value?.kind === "array"
    ) {
      const elements = Array.isArray(value.elements)
        ? value.elements
        : [];
      target.elements.forEach((element, index) => {
        assignAliasToTarget(
          element,
          elements[index] ?? null,
          environmentMap,
        );
      });
      return;
    }
    if (
      ts.isObjectLiteralExpression(target) &&
      value?.kind === "object"
    ) {
      for (const property of target.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
          assignAliasToTarget(
            property.name,
            value.properties.get(property.name.text) ?? null,
            environmentMap,
          );
        } else if (ts.isPropertyAssignment(property)) {
          let candidate = null;
          if (ts.isComputedPropertyName(property.name)) {
            const keyValue =
              literalString(property.name.expression) ??
              (() => {
                const resolved = staticJavaScriptValue(
                  property.name.expression,
                  environmentMap,
                  bindings,
                );
                return resolved?.kind === "string"
                  ? resolved.value
                  : null;
              })();
            candidate =
              keyValue === null
                ? dangerousCandidateFromObject(value) ??
                  safeCallableCandidateFromObject(value)
                : value.properties.get(keyValue) ?? null;
          } else if (ts.isIdentifier(property.name)) {
            candidate =
              value.properties.get(property.name.text) ?? null;
          }
          assignAliasToTarget(
            property.initializer,
            candidate,
            environmentMap,
          );
        }
      }
    }
  }

  function scanNode(node, environment) {
    if (!consumeJavaScriptAnalysisBudget(bindings)) {
      return;
    }
    if (ts.isVariableDeclaration(node)) {
      const name = bindingName(node.name);
      if (name) {
        const aliasValue = node.initializer
          ? directAliasForExpression(
              node.initializer,
              bindings,
              environment,
            )
          : null;
        const constantValue = node.initializer
          ? staticJavaScriptValue(
              node.initializer,
              environment,
              bindings,
            )
          : null;
        environment.set(
          name,
          mergeAliasAndConstant(aliasValue, constantValue) ??
            (node.initializer &&
            isUnresolvedRuntimeValueExpression(node.initializer)
              ? { kind: "unknown" }
              : { kind: "safe" }),
        );
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(node.operatorToken.kind) &&
      (ts.isIdentifier(node.left) ||
        ts.isElementAccessExpression(node.left) ||
        ts.isPropertyAccessExpression(node.left) ||
        ts.isArrayLiteralExpression(node.left) ||
        ts.isObjectLiteralExpression(node.left))
    ) {
      const aliasValue = directAliasForExpression(
        node.right,
        bindings,
        environment,
      );
      const constantValue = staticJavaScriptValue(
        node.right,
        environment,
        bindings,
      );
      assignAliasToTarget(
        node.left,
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ? aliasValue ??
              constantValue ??
              (isUnresolvedRuntimeValueExpression(node.right)
                ? { kind: "unknown" }
                : null)
          : mergePotentialAliasValues(
              directAliasForExpression(
                node.left,
                bindings,
                environment,
              ),
              aliasValue ?? constantValue,
            ),
        environment,
      );
    }
    if (ts.isConditionalExpression(node)) {
      scanNode(node.condition, environment);
      const whenTrueEnvironment = new Map(
        [...environment].map(([name, value]) => [
          name,
          cloneAliasValue(value),
        ]),
      );
      const whenFalseEnvironment = new Map(
        [...environment].map(([name, value]) => [
          name,
          cloneAliasValue(value),
        ]),
      );
      scanNode(node.whenTrue, whenTrueEnvironment);
      scanNode(node.whenFalse, whenFalseEnvironment);
      const merged = mergeEnvironments(
        whenTrueEnvironment,
        whenFalseEnvironment,
      );
      environment.clear();
      for (const [name, value] of merged) {
        environment.set(name, value);
      }
      return;
    }
    if (ts.isIfStatement(node)) {
      scanNode(node.expression, environment);
      const thenEnvironment = new Map(environment);
      const elseEnvironment = new Map(environment);
      scanNode(node.thenStatement, thenEnvironment);
      if (node.elseStatement) {
        scanNode(node.elseStatement, elseEnvironment);
      }
      const merged = mergeEnvironments(
        thenEnvironment,
        elseEnvironment,
      );
      environment.clear();
      for (const [name, value] of merged) {
        environment.set(name, value);
      }
      return;
    }
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node)
    ) {
      const specifier = moduleSpecifier(node.moduleSpecifier);
      if (specifier && SUSPICIOUS_RUNTIME_PATH.test(specifier)) {
        pushOnce(
          finding(
            "SCRIPT_WORKER_ENTRY_IMPORT_FORBIDDEN",
            relativePath,
            "Script imports or re-exports a Worker runtime entry.",
            "DANGEROUS",
            scriptType,
            astLine(sourceFile, node),
          ),
        );
      }
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bindings.childProcessNamespaces.has(node.expression.text) &&
      propertyName(node, environment, bindings) === null
    ) {
      pushOnce(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          relativePath,
          "Computed child-process API name cannot be resolved.",
          "UNKNOWN",
          scriptType,
          astLine(sourceFile, node),
        ),
      );
    }

    if (ts.isNewExpression(node)) {
      const target = dynamicExecutionTarget(
        node.expression,
        bindings,
        environment,
      );
      if (target === "Function") {
        const argumentsList = node.arguments ?? [];
        const values = argumentsList.map((argument) =>
          staticJavaScriptValue(argument, environment, bindings),
        );
        const body = values.at(-1);
        if (body?.kind !== "string") {
          pushOnce(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
              relativePath,
              "Function constructor body cannot be resolved statically.",
              "UNKNOWN",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        } else {
          analyzeDynamicBody(body.value, node);
        }
      }
    }

    if (ts.isTaggedTemplateExpression(node)) {
      const target = dynamicExecutionTarget(
        node.tag,
        bindings,
        environment,
      );
      if (target === "eval" || target === "Function") {
        const templateValue = staticJavaScriptValue(
          node.template,
          environment,
          bindings,
        );
        if (templateValue?.kind === "string") {
          analyzeDynamicBody(templateValue.value, node);
        } else {
          pushOnce(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
              relativePath,
              "Tagged dynamic execution body cannot be resolved statically.",
              "UNKNOWN",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = unwrapExpression(node.expression);
      const callableAlias = directAliasForExpression(
        callee,
        bindings,
        environment,
      );
      let dynamicTarget = dynamicExecutionTarget(
        callee,
        bindings,
        environment,
      );
      if (!dynamicTarget && callableAlias?.kind === "dynamic") {
        dynamicTarget = callableAlias.target;
      }
      if (callableAlias?.kind === "unknown") {
        pushOnce(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "JavaScript call target exceeds static analysis limits.",
            "UNKNOWN",
            scriptType,
            astLine(sourceFile, node),
          ),
        );
      }
      let dynamicArguments = node.arguments;
      if (
        !dynamicTarget &&
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee))
      ) {
        const invocation = propertyName(
          callee,
          environment,
          bindings,
        );
        if (invocation === "call" || invocation === "apply") {
          const target = dynamicExecutionTarget(
            callee.expression,
            bindings,
            environment,
          );
          if (target) {
            dynamicTarget = target;
            if (invocation === "call") {
              dynamicArguments = node.arguments.slice(1);
            } else {
              const applied = staticJavaScriptValue(
                node.arguments[1],
                environment,
                bindings,
              );
              dynamicArguments =
                applied?.kind === "array"
                  ? [
                      ...applied.values.map((value) => ({
                        kind: "string",
                        value,
                      })),
                      ...(applied.partial ? [null] : []),
                    ]
                  : [null];
            }
          }
        }
      }
      if (dynamicTarget === "eval" || dynamicTarget === "Function") {
        const values = dynamicArguments.map((argument) =>
          argument &&
          ["array", "execpath", "string"].includes(argument.kind)
            ? argument
            : staticJavaScriptValue(argument, environment, bindings),
        );
        const body = values.at(-1);
        if (body?.kind !== "string") {
          pushOnce(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
              relativePath,
              "Dynamic execution body cannot be resolved statically.",
              "UNKNOWN",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        } else {
          analyzeDynamicBody(body.value, node);
        }
      }
      let reflection = null;
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        ts.isIdentifier(callee.expression) &&
        bindings.reflectNamespaces.has(callee.expression.text)
      ) {
        reflection = propertyName(
          callee,
          environment,
          bindings,
        );
      } else {
        if (callableAlias?.kind === "reflect") {
          reflection = callableAlias.operation;
        }
      }
      if (reflection === "apply" || reflection === "construct") {
          const targetAlias = directAliasForExpression(
            node.arguments[0],
            bindings,
            environment,
          );
          const argumentsArray = staticJavaScriptValue(
            node.arguments[reflection === "apply" ? 2 : 1],
            environment,
            bindings,
          );
          if (
            argumentsArray?.kind !== "array" ||
            argumentsArray.partial
          ) {
            pushOnce(
              finding(
                "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
                relativePath,
                "Reflect invocation cannot be resolved statically.",
                "UNKNOWN",
                scriptType,
                astLine(sourceFile, node),
              ),
            );
          } else if (targetAlias?.kind === "process") {
            const text = argumentsArray.values.join(" ");
            if (
              /\bnext\s+start\b/i.test(text) ||
              /\bdist[\\/]index\.js\b/i.test(text)
            ) {
              pushOnce(
                finding(
                  /\bnext\s+start\b/i.test(text)
                    ? "SCRIPT_DIRECT_NEXT_START"
                    : "SCRIPT_DIRECT_WORKER_DIST",
                  relativePath,
                  "Reflect invocation reaches a forbidden startup entry.",
                  "DANGEROUS",
                  scriptType,
                  astLine(sourceFile, node),
                ),
              );
            }
          } else if (
            targetAlias?.kind === "dynamic" &&
            targetAlias.target === "eval"
          ) {
            const body = argumentsArray.values[0];
            if (body) {
              analyzeDynamicBody(body, node);
            } else {
              pushOnce(
                finding(
                  "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
                  relativePath,
                  "Reflect eval body cannot be resolved statically.",
                  "UNKNOWN",
                  scriptType,
                  astLine(sourceFile, node),
                ),
              );
            }
          } else if (
            targetAlias?.kind === "dynamic" &&
            targetAlias.target === "Function"
          ) {
            const body = argumentsArray.values.at(-1);
            if (body) {
              analyzeDynamicBody(body, node);
            } else {
              pushOnce(
                finding(
                  "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
                  relativePath,
                  "Reflect Function body cannot be resolved statically.",
                  "UNKNOWN",
                  scriptType,
                  astLine(sourceFile, node),
                ),
              );
            }
          }
      }
      const dynamicImport =
        callee.kind === ts.SyntaxKind.ImportKeyword;
      const requireAlias =
        ts.isIdentifier(callee) &&
        (callee.text === "require" ||
          bindings.requireAliases.has(callee.text));
      if (dynamicImport || requireAlias) {
        const specifier = staticJavaScriptValue(
          node.arguments[0],
          environment,
          bindings,
        );
        if (specifier?.kind !== "string") {
          pushOnce(
            finding(
              dynamicImport
                ? "SCRIPT_UNKNOWN_DYNAMIC_IMPORT"
                : "SCRIPT_UNKNOWN_DYNAMIC_REQUIRE",
              relativePath,
              "Dynamic module target cannot be resolved statically.",
              "UNKNOWN",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        } else if (SUSPICIOUS_RUNTIME_PATH.test(specifier.value)) {
          pushOnce(
            finding(
              "SCRIPT_WORKER_ENTRY_IMPORT_FORBIDDEN",
              relativePath,
              "Script imports a Worker runtime entry.",
              "DANGEROUS",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
      }

      let api = processApiForExpression(
        callee,
        bindings,
        environment,
      );
      if (!api && callableAlias?.kind === "process") {
        api = callableAlias.api;
      }
      let argumentExpressions = node.arguments;
      let calculatedValues = null;
      if (
        !api &&
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee))
      ) {
        const invocationName = propertyName(
          callee,
          environment,
          bindings,
        );
        if (invocationName === "call" || invocationName === "apply") {
          const targetApi = processApiForExpression(
            callee.expression,
            bindings,
            environment,
          );
          if (targetApi) {
            api = targetApi;
            if (invocationName === "call") {
              argumentExpressions = node.arguments.slice(1);
            } else {
              const applied = staticJavaScriptValue(
                node.arguments[1],
                environment,
                bindings,
              );
              calculatedValues =
                applied?.kind === "array"
                  ? [
                      ...applied.values.map((value) => ({
                        kind: "string",
                        value,
                      })),
                      ...(applied.partial ? [null] : []),
                    ]
                  : [null];
            }
          }
        }
      }
      if (api) {
        const values =
          calculatedValues ??
          argumentExpressions.map((argument) =>
            staticJavaScriptValue(argument, environment, bindings),
          );
        const text = values
          .map((value) => valueText(value))
          .filter((value) => value !== null)
          .join(" ");
        const directNextStart =
          /\bnext\s+start\b/i.test(text) ||
          (/\bnext\b/i.test(text) && /\bstart\b/i.test(text));
        const directWorkerDist =
          /\bnode(?:\.exe)?\b[\s\S]{0,500}\bdist[\\/]index\.js\b/i.test(
            text,
          ) ||
          /\bdist[\\/]index\.js\b/i.test(text);
        if (directNextStart) {
          pushOnce(
            finding(
              "SCRIPT_DIRECT_NEXT_START",
              relativePath,
              "JavaScript wrapper invokes next start.",
              "DANGEROUS",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
        if (directWorkerDist) {
          pushOnce(
            finding(
              "SCRIPT_DIRECT_WORKER_DIST",
              relativePath,
              "JavaScript wrapper invokes a Worker dist entry.",
              "DANGEROUS",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
        if (
          api === "fork" &&
          /\bworker-entry(?:\.[cm]?js|\.ts)?\b/i.test(text)
        ) {
          pushOnce(
            finding(
              "SCRIPT_WORKER_ENTRY_FORK_FORBIDDEN",
              relativePath,
              "JavaScript wrapper forks a Worker runtime entry.",
              "DANGEROUS",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
        const command = values[0];
        const firstArgument =
          command?.kind === "string"
            ? command.value.trim().toLowerCase()
            : null;
        const nodeCommand =
          command?.kind === "execpath" ||
          firstArgument === "node" ||
          firstArgument === "node.exe";
        const packageManagerCommand = [
          "bunx",
          "corepack",
          "npm",
          "npx",
          "pnpm",
          "yarn",
        ].includes(firstArgument ?? "");
        const argumentArray =
          values[1]?.kind === "array" ? values[1] : null;
        const resolvedNodeTarget =
          nodeCommand &&
          argumentArray &&
          argumentArray.values.length > 0;
        const unresolvedExecution =
          command === null ||
          (api === "fork" && values[0] === null) ||
          (node.arguments.length > 1 &&
            argumentArray === null &&
            !nodeCommand) ||
          (argumentArray?.partial &&
            !resolvedNodeTarget &&
            (packageManagerCommand || !nodeCommand));
        if (
          !directNextStart &&
          !directWorkerDist &&
          unresolvedExecution
        ) {
          pushOnce(
            finding(
              "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
              relativePath,
              "JavaScript child-process arguments cannot be resolved statically.",
              "UNKNOWN",
              scriptType,
              astLine(sourceFile, node),
            ),
          );
        }
      }

      const functionNode = ts.isIdentifier(callee)
        ? bindings.functions.get(callee.text)
        : null;
      if (functionNode && !activeFunctions.has(functionNode)) {
        const functionEnvironment = new Map([
          ...environment,
          ...(ts.isIdentifier(callee)
            ? bindings.functionCaptures.get(callee.text) ?? []
            : []),
        ]);
        functionNode.parameters.forEach((parameter, index) => {
          const name = bindingName(parameter.name);
          if (!name) {
            return;
          }
          const value = staticJavaScriptValue(
            node.arguments[index],
            environment,
            bindings,
          );
          if (value) {
            functionEnvironment.set(name, value);
          }
          const aliasValue = directAliasForExpression(
            node.arguments[index],
            bindings,
            environment,
          );
          const propagated = mergeAliasAndConstant(
            aliasValue,
            value,
          );
          if (propagated) {
            functionEnvironment.set(name, propagated);
          } else if (
            isUnresolvedRuntimeValueExpression(node.arguments[index])
          ) {
            functionEnvironment.set(name, { kind: "unknown" });
          }
        });
        activeFunctions.add(functionNode);
        if (functionNode.body) {
          scanNode(functionNode.body, functionEnvironment);
        }
        activeFunctions.delete(functionNode);
      }
    }

    ts.forEachChild(node, (child) => scanNode(child, environment));
  }
  scanNode(
    sourceFile,
    new Map(
      [...bindings.constants].map(([name, value]) => [
        name,
        cloneAliasValue(value),
      ]),
    ),
  );

  for (const functionNode of bindings.functions.values()) {
    if (!functionNode.body || activeFunctions.has(functionNode)) {
      continue;
    }
    activeFunctions.add(functionNode);
    scanNode(
      functionNode.body,
      new Map(
        [...bindings.constants].map(([name, value]) => [
          name,
          cloneAliasValue(value),
        ]),
      ),
    );
    activeFunctions.delete(functionNode);
  }
}

function scanJavaScript(
  relativePath,
  content,
  findings,
) {
  const scriptType = "javascript";
  const withoutComments = stripJavaScriptComments(content);
  const assignments = literalAssignments(withoutComments);
  const aliases = childProcessAliases(withoutComments);
  const aliasPattern = [...aliases]
    .join("|");
  if (aliasPattern) {
    const calls = new RegExp(
      `\\b(${aliasPattern})\\s*\\(([\\s\\S]{0,1200}?)\\)`,
      "g",
    );
    for (const match of withoutComments.matchAll(calls)) {
      const callName = match[1];
      const callBody = expandJavaScriptIdentifiers(
        match[2],
        assignments,
      );
      const line = lineNumberAt(withoutComments, match.index ?? 0);
      const directNextStartCall =
        /\bnext\b[\s\S]{0,300}\bstart\b/i.test(callBody) ||
        /["'`][^"'`]*\bnext\s+start\b[^"'`]*["'`]/i.test(callBody);
      const directWorkerDistCall =
        /\bnode(?:\.exe)?\b[\s\S]{0,500}\bdist[\\/]index\.js\b/i.test(
          callBody,
        );
      if (directNextStartCall) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_NEXT_START",
            relativePath,
            "JavaScript wrapper invokes next start.",
            "DANGEROUS",
            scriptType,
            line,
          ),
        );
      }
      if (directWorkerDistCall) {
        findings.push(
          finding(
            "SCRIPT_DIRECT_WORKER_DIST",
            relativePath,
            "JavaScript wrapper invokes a Worker dist entry.",
            "DANGEROUS",
            scriptType,
            line,
          ),
        );
      }
      if (callName === "fork" && SUSPICIOUS_RUNTIME_PATH.test(callBody)) {
        findings.push(
          finding(
            "SCRIPT_WORKER_ENTRY_FORK_FORBIDDEN",
            relativePath,
            "JavaScript wrapper forks a Worker runtime entry.",
            "DANGEROUS",
            scriptType,
            line,
          ),
        );
      }
      const firstArgument = firstJavaScriptCallArgument(match[2]);
      if (
        !directNextStartCall &&
        !directWorkerDistCall &&
        firstArgument &&
        !SAFE_JS_COMMANDS.has(firstArgument) &&
        firstArgument !== "process.execPath" &&
        ![...assignments.keys()].includes(firstArgument)
      ) {
        findings.push(
          finding(
            "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
            relativePath,
            "JavaScript child-process command cannot be resolved statically.",
            "UNKNOWN",
            scriptType,
            line,
          ),
        );
      }
    }
  }

  const dynamicImportPattern =
    /\bimport\s*\(\s*([^)]+?)\s*\)/g;
  for (const match of withoutComments.matchAll(
    dynamicImportPattern,
  )) {
    const specifier = match[1].trim();
    if (!/^["'`]/.test(specifier)) {
      findings.push(
        finding(
          "SCRIPT_UNKNOWN_DYNAMIC_IMPORT",
          relativePath,
          "Dynamic import specifier cannot be resolved statically.",
          "UNKNOWN",
          scriptType,
          lineNumberAt(withoutComments, match.index ?? 0),
        ),
      );
    } else {
      const literal = quotedValue(specifier);
      if (SUSPICIOUS_RUNTIME_PATH.test(literal)) {
        findings.push(
          finding(
            "SCRIPT_WORKER_ENTRY_IMPORT_FORBIDDEN",
            relativePath,
            "JavaScript wrapper dynamically imports a Worker runtime entry.",
            "DANGEROUS",
            scriptType,
            lineNumberAt(withoutComments, match.index ?? 0),
          ),
        );
      }
    }
  }

  const runtimeModulePattern =
    /(?:\b(?:import|export)\s+[\s\S]{0,300}?\bfrom\s*|\brequire\s*\(\s*)(["'])([^"']*worker-entry[^"']*)\1/g;
  for (const match of withoutComments.matchAll(runtimeModulePattern)) {
    findings.push(
      finding(
        "SCRIPT_PREGATE_RUNTIME_IMPORT_FORBIDDEN",
        relativePath,
        "Script imports a Worker runtime/business module outside the required Gate-first files.",
        "DANGEROUS",
        scriptType,
        lineNumberAt(withoutComments, match.index ?? 0),
      ),
    );
  }

  if (
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\s*;/.test(
      withoutComments,
    )
  ) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_REQUIRE_ALIAS",
        relativePath,
        "A require alias prevents complete static module analysis.",
        "UNKNOWN",
        scriptType,
      ),
    );
    const aliasMatch = withoutComments.match(
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*;/,
    );
    if (aliasMatch?.[1]) {
      const alias = aliasMatch[1].replaceAll("$", "\\$");
      const runtimeCall = new RegExp(
        `(?<![.\\w$])${alias}\\s*\\(\\s*["'][^"']*worker-entry[^"']*["']`,
      );
      if (runtimeCall.test(withoutComments)) {
        findings.push(
          finding(
            "SCRIPT_PREGATE_RUNTIME_IMPORT_FORBIDDEN",
            relativePath,
            "A require alias imports a Worker runtime entry.",
            "DANGEROUS",
            scriptType,
          ),
        );
      }
    }
  }
  const aliasedProcessCall =
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:(?:exec|execFile|execFileSync|execSync|fork|spawn|spawnSync)|require\(\s*["'](?:node:)?child_process["']\s*\)\.(?:exec|execFile|execFileSync|execSync|fork|spawn|spawnSync))\s*;/;
  if (aliasedProcessCall.test(withoutComments)) {
    findings.push(
      finding(
        "SCRIPT_UNKNOWN_PROCESS_ALIAS",
        relativePath,
        "A child-process function alias prevents complete call resolution.",
        "UNKNOWN",
        scriptType,
      ),
    );
  }
}

export function scanAuxiliaryScript(relativePath, content) {
  const normalizedPath = normalizePath(relativePath);
  const shebang = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/, 1)[0]
    ?.match(
      /^#!\s*(?:\/usr\/bin\/env\s+)?([A-Za-z0-9._-]+)(?:\s|$)/,
    )?.[1]
    ?.toLowerCase();
  const firstLine = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/, 1)[0];
  const scriptType =
    scriptTypeForPath(normalizedPath) ??
    (["bash", "dash", "sh", "zsh"].includes(shebang)
      ? "shell"
      : ["node", "nodejs"].includes(shebang)
        ? "javascript"
        : ["powershell", "pwsh"].includes(shebang)
          ? "powershell"
          : ["cmd"].includes(shebang)
            ? "cmd"
            : null);
  if (!scriptType) {
    if (
      UNVERIFIED_SCRIPT_EXTENSIONS.has(
        fileExtension(normalizedPath),
      ) ||
      /^#!/.test(firstLine ?? "")
    ) {
      return [
        finding(
          "SCRIPT_UNKNOWN_FILE_TYPE",
          normalizedPath,
          "Executable script type cannot be fully analyzed.",
          "UNKNOWN",
          "unknown",
        ),
      ];
    }
    return [];
  }
  const findings = [];
  try {
    if (scriptType === "shell") {
      scanShell(normalizedPath, content, findings);
    } else if (scriptType === "powershell") {
      scanPowerShell(normalizedPath, content, findings);
    } else if (scriptType === "cmd") {
      scanCmd(normalizedPath, content, findings);
    } else {
      scanJavaScriptAst(normalizedPath, content, findings);
    }
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    findings.push(
      finding(
        "SCRIPT_SCANNER_INTERNAL_ERROR",
        normalizedPath,
        `Static analysis failed: ${detail}`,
        "ERROR",
        scriptType,
      ),
    );
  }
  return findings;
}

export function validateScriptSyntax(relativePath, content) {
  const normalizedPath = normalizePath(relativePath);
  if (scriptTypeForPath(normalizedPath) !== "javascript") {
    return [];
  }
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(normalizedPath),
  );
  const diagnostics = sourceFile.parseDiagnostics ?? [];
  if (diagnostics.length === 0) {
    return [];
  }
  return [
    finding(
      "SCRIPT_PARSE_ERROR",
      normalizedPath,
      "JavaScript/TypeScript source could not be parsed completely.",
      "ERROR",
      "javascript",
      sourceFile.getLineAndCharacterOfPosition(
        diagnostics[0].start ?? 0,
      ).line + 1,
    ),
  ];
}
