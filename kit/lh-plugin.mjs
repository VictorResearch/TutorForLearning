// scripts/kit-verificar.ts
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// src/core/semver.ts
function lerVersao(v) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}
function compararVersoes(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
function comparador(c) {
  if (c === "*" || c === "x" || c === "") return () => true;
  const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/.exec(c);
  if (!m) return null;
  const op = m[1] ?? "";
  const partes = [m[2], m[3], m[4]];
  const curinga = partes.findIndex((p) => p === void 0 || p === "x" || p === "*");
  const base = [Number(partes[0]) || 0, Number(partes[1] === "x" || partes[1] === "*" ? 0 : partes[1] ?? 0), Number(partes[2] === "x" || partes[2] === "*" ? 0 : partes[2] ?? 0)];
  const cmp = (v) => compararVersoes(v, base);
  switch (op) {
    case ">=":
      return (v) => cmp(v) >= 0;
    case ">":
      return (v) => cmp(v) > 0;
    case "<=":
      return (v) => cmp(v) <= 0;
    case "<":
      return (v) => cmp(v) < 0;
    case "^": {
      const teto = curinga === 1 || base[0] > 0 ? [base[0] + 1, 0, 0] : base[1] > 0 || curinga === 2 ? [0, base[1] + 1, 0] : [0, 0, base[2] + 1];
      return (v) => cmp(v) >= 0 && compararVersoes(v, teto) < 0;
    }
    case "~": {
      const teto = curinga === 1 ? [base[0] + 1, 0, 0] : [base[0], base[1] + 1, 0];
      return (v) => cmp(v) >= 0 && compararVersoes(v, teto) < 0;
    }
    default: {
      if (curinga === -1) return (v) => cmp(v) === 0;
      return (v) => partes.slice(0, curinga).every((p, i2) => v[i2] === Number(p));
    }
  }
}
function faixaValida(faixa) {
  return faixa.split("||").every((alt) => alt.trim() === "" || alt.trim().split(/\s+/).every((c) => comparador(c) !== null));
}
function satisfaz(versao, faixa) {
  const v = lerVersao(versao);
  if (!v) return false;
  return faixa.split("||").some((alt) => {
    const cs = alt.trim().split(/\s+/).filter(Boolean);
    return cs.every((c) => comparador(c)?.(v) ?? false);
  });
}

// src/core/contracts/plugins.ts
var PLUGIN_ESQUEMA = 2;
var BIBLIOTECAS_WIDGET = ["d3"];
var ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
var VOZ_RE = /^[a-z]{2}_[A-Z]{2}-[\w]+-(x_low|low|medium|high)$/;
var KINDS = ["prober", "teacher", "practice"];
var isRelative = (p) => typeof p === "string" && p.length > 0 && !p.startsWith("/") && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes("..");
function parsePluginManifest(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "plugin.json is not an object" };
  const r = raw;
  if (typeof r.id !== "string" || !ID_RE.test(r.id)) return { ok: false, error: "id must be lowercase letters, digits and hyphens" };
  for (const k of ["name", "version", "description"]) {
    if (typeof r[k] !== "string" || !r[k].trim()) return { ok: false, error: `${k} must be a non-empty string` };
  }
  const esquema = r.esquema === void 0 ? 1 : r.esquema;
  if (typeof esquema !== "number" || !Number.isInteger(esquema) || esquema < 1) return { ok: false, error: "esquema must be a positive integer" };
  if (esquema > PLUGIN_ESQUEMA) return { ok: false, error: `plugin written for contract ${esquema}; this app understands up to ${PLUGIN_ESQUEMA} \u2014 update the app` };
  const manifest = {
    id: r.id,
    name: r.name.trim(),
    version: r.version.trim(),
    description: r.description.trim(),
    esquema: PLUGIN_ESQUEMA
  };
  const v2 = parseV2(r);
  if (typeof v2 === "string") return { ok: false, error: v2 };
  Object.assign(manifest, v2);
  if (r.prompts !== void 0) {
    if (!r.prompts || typeof r.prompts !== "object" || Array.isArray(r.prompts)) return { ok: false, error: "prompts must be an object" };
    const prompts = {};
    for (const [kind, list] of Object.entries(r.prompts)) {
      if (!KINDS.includes(kind)) return { ok: false, error: `prompts: unknown agent "${kind}"` };
      if (!Array.isArray(list) || !list.every(isRelative)) return { ok: false, error: `prompts.${kind} must list relative file paths` };
      prompts[kind] = list;
    }
    manifest.prompts = prompts;
  }
  if (r.base !== void 0) {
    const b = r.base;
    if (!b || typeof b !== "object" || typeof b.path !== "string" || !b.path.trim()) return { ok: false, error: "base.path must be a string" };
    manifest.base = { path: b.path, ...typeof b.description === "string" ? { description: b.description } : {} };
  }
  if (r.memory !== void 0) {
    const m = r.memory;
    if (!m || typeof m !== "object" || typeof m.enabled !== "boolean") return { ok: false, error: "memory.enabled must be a boolean" };
    if (m.doctrine !== void 0 && !isRelative(m.doctrine)) return { ok: false, error: "memory.doctrine must be a relative path" };
    manifest.memory = { enabled: m.enabled, ...m.doctrine ? { doctrine: m.doctrine } : {} };
  }
  if (r.cases !== void 0) {
    const c = r.cases;
    if (!c || typeof c !== "object" || typeof c.enabled !== "boolean") return { ok: false, error: "cases.enabled must be a boolean" };
    if (c.doctrine !== void 0 && !isRelative(c.doctrine)) return { ok: false, error: "cases.doctrine must be a relative path" };
    manifest.cases = { enabled: c.enabled, ...c.doctrine ? { doctrine: c.doctrine } : {} };
  }
  if (r.voz !== void 0) {
    const v = r.voz;
    if (!v || typeof v !== "object" || typeof v.enabled !== "boolean") return { ok: false, error: "voz.enabled must be a boolean" };
    if (v.vozes !== void 0 && (!Array.isArray(v.vozes) || !v.vozes.every((x) => typeof x === "string" && VOZ_RE.test(x)))) {
      return { ok: false, error: "voz.vozes must list Piper voice ids (e.g. pt_BR-faber-medium)" };
    }
    manifest.voz = { enabled: v.enabled, ...v.vozes ? { vozes: v.vozes } : {} };
  }
  if (r.anatomia !== void 0) {
    const a = r.anatomia;
    if (!a || typeof a !== "object" || typeof a.enabled !== "boolean") return { ok: false, error: "anatomia.enabled must be a boolean" };
    const pacotes = [];
    for (const raw2 of Array.isArray(a.pacotes) ? a.pacotes : a.pacotes === void 0 ? [] : [null]) {
      const p = raw2;
      if (!p || typeof p.id !== "string" || !ID_RE.test(p.id) || typeof p.nome !== "string" || typeof p.versao !== "string") {
        return { ok: false, error: "anatomia.pacotes: each needs id, nome, versao" };
      }
      if (p.url !== void 0 && (typeof p.url !== "string" || !/^https:\/\//.test(p.url))) return { ok: false, error: `anatomia.pacotes.${p.id}: url must be https` };
      if (p.sha256 !== void 0 && (typeof p.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(p.sha256))) return { ok: false, error: `anatomia.pacotes.${p.id}: sha256 must be 64 hex chars` };
      pacotes.push({
        id: p.id,
        nome: p.nome,
        versao: p.versao,
        ...p.url ? { url: p.url } : {},
        ...p.sha256 ? { sha256: p.sha256 } : {},
        ...typeof p.tamanhoMB === "number" ? { tamanhoMB: p.tamanhoMB } : {},
        ...p.padrao === true ? { padrao: true } : {}
      });
    }
    manifest.anatomia = { enabled: a.enabled, ...pacotes.length ? { pacotes } : {} };
  }
  if (r.fluxogramas !== void 0) {
    const f = r.fluxogramas;
    if (!f || typeof f !== "object" || typeof f.enabled !== "boolean") return { ok: false, error: "fluxogramas.enabled must be a boolean" };
    if (!Array.isArray(f.arquivos) || !f.arquivos.every(isRelative)) return { ok: false, error: "fluxogramas.arquivos must list relative file paths" };
    manifest.fluxogramas = { enabled: f.enabled, arquivos: f.arquivos };
  }
  if (r.interativos !== void 0) {
    const it = r.interativos;
    if (!it || typeof it !== "object" || typeof it.enabled !== "boolean") return { ok: false, error: "interativos.enabled must be a boolean" };
    const widgets = [];
    for (const raw2 of Array.isArray(it.widgets) ? it.widgets : [null]) {
      const w = raw2;
      if (!w || typeof w.id !== "string" || !ID_RE.test(w.id) || typeof w.nome !== "string" || !isRelative(w.arquivo) || !/\.html?$/i.test(w.arquivo)) {
        return { ok: false, error: "interativos.widgets: each needs id, nome and a relative .html arquivo" };
      }
      const bibs = Array.isArray(w.bibliotecas) ? w.bibliotecas : [];
      const fora = bibs.find((b) => !BIBLIOTECAS_WIDGET.includes(b));
      if (fora !== void 0) return { ok: false, error: `interativos.${w.id}: unknown library "${String(fora)}" (allowed: ${BIBLIOTECAS_WIDGET.join(", ")})` };
      const params = {};
      if (w.parametros && typeof w.parametros === "object" && !Array.isArray(w.parametros)) {
        for (const [k, v] of Object.entries(w.parametros)) {
          if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") params[k] = v;
        }
      }
      widgets.push({
        id: w.id,
        nome: w.nome,
        arquivo: w.arquivo,
        descricao: typeof w.descricao === "string" ? w.descricao : "",
        ...bibs.length ? { bibliotecas: bibs } : {},
        ...Object.keys(params).length ? { parametros: params } : {},
        ...typeof w.area === "string" ? { area: w.area } : {}
      });
    }
    manifest.interativos = { enabled: it.enabled, widgets };
  }
  return { ok: true, manifest };
}
function parseV2(r) {
  const out = {};
  if (r.app !== void 0) {
    if (typeof r.app !== "string" || !faixaValida(r.app)) return `app must be a version range (e.g. ">=0.4 <1")`;
    out.app = r.app;
  }
  if (r.dependencias !== void 0) {
    if (!r.dependencias || typeof r.dependencias !== "object" || Array.isArray(r.dependencias)) return "dependencias must be an object {id: range}";
    const deps = {};
    for (const [id, faixa] of Object.entries(r.dependencias)) {
      if (!ID_RE.test(id) || typeof faixa !== "string" || !faixaValida(faixa)) return `dependencias.${id}: needs a plugin id and a version range`;
      deps[id] = faixa;
    }
    out.dependencias = deps;
  }
  if (r.conflitos !== void 0) {
    if (!Array.isArray(r.conflitos) || !r.conflitos.every((c) => typeof c === "string" && ID_RE.test(c))) return "conflitos must list plugin ids";
    out.conflitos = r.conflitos;
  }
  if (r.permissoes !== void 0) {
    const p = r.permissoes;
    if (!p || typeof p !== "object" || Array.isArray(p)) return "permissoes must be an object";
    const perm = {};
    for (const k of ["microfone", "interativos", "nuvem"]) {
      if (p[k] === void 0) continue;
      if (typeof p[k] !== "boolean") return `permissoes.${k} must be a boolean`;
      perm[k] = p[k];
    }
    if (p.baixar !== void 0) {
      if (!Array.isArray(p.baixar) || !p.baixar.every((h) => typeof h === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h))) return "permissoes.baixar must list host names (e.g. github.com)";
      perm.baixar = p.baixar.map((h) => h.toLowerCase());
    }
    out.permissoes = perm;
  }
  if (r.licenca !== void 0) {
    if (typeof r.licenca !== "string" || !r.licenca.trim()) return "licenca must be a non-empty string";
    out.licenca = r.licenca.trim();
  }
  if (r.autores !== void 0) {
    if (!Array.isArray(r.autores) || !r.autores.every((a) => typeof a === "string")) return "autores must list names";
    out.autores = r.autores;
  }
  if (r.repositorio !== void 0) {
    if (typeof r.repositorio !== "string" || !/^https:\/\//.test(r.repositorio)) return "repositorio must be an https URL";
    out.repositorio = r.repositorio;
  }
  return out;
}

// node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer) return null;
  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== "number") options.indent = 1;
  if (typeof options.linesBefore !== "number") options.linesBefore = 3;
  if (typeof options.linesAfter !== "number") options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result = "", i2, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i2 = 1; i2 <= options.linesBefore; i2++) {
    if (foundLineNo - i2 < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i2],
      lineEnds[foundLineNo - i2],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i2]),
      maxLineLength
    );
    result = common.repeat(" ", options.indent) + padStart((mark.line - i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i2 = 1; i2 <= options.linesAfter; i2++) {
    if (foundLineNo + i2 >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i2],
      lineEnds[foundLineNo + i2],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i2]),
      maxLineLength
    );
    result += common.repeat(" ", options.indent) + padStart((mark.line + i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result = Object.create(Schema$1.prototype);
  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);
  result.compiledImplicit = compileList(result, "implicit");
  result.compiledExplicit = compileList(result, "explicit");
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
  return result;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode(
    (c - 65536 >> 10) + 55296,
    (c - 65536 & 1023) + 56320
  );
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
var i;
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      destination[key] = source[key];
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    if (keyNode === "__proto__") {
      Object.defineProperty(_result, keyNode, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: valueNode
      });
    } else {
      _result[keyNode] = valueNode;
    }
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str3) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str3)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i2;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i2;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  })();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = (function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += "\n";
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
    char = codePointAt(string, i2);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i2];
      if (char >= 65536) result += string[i2 + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var Type = type;
var Schema = schema;
var FAILSAFE_SCHEMA = failsafe;
var JSON_SCHEMA = json;
var CORE_SCHEMA = core;
var DEFAULT_SCHEMA = _default;
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var YAMLException = exception;
var types = {
  binary,
  float,
  map,
  null: _null,
  pairs,
  set,
  timestamp,
  bool,
  int,
  merge,
  omap,
  seq,
  str
};
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");
var jsYaml = {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
};
var js_yaml_default = jsYaml;

// src/core/nota-formato.ts
function lerYaml(texto) {
  return js_yaml_default.load(texto, { schema: js_yaml_default.CORE_SCHEMA });
}

// src/core/fluxograma.ts
var TIPOS_NO = ["inicio", "decisao", "conduta", "exame", "desfecho"];
var ID = /^[a-z0-9][a-z0-9_-]{0,60}$/;
var str2 = (x) => typeof x === "string" ? x.trim() : "";
function lerFluxograma(texto) {
  let raw;
  try {
    raw = lerYaml(texto);
  } catch (err) {
    return { ok: false, erro: `YAML ileg\xEDvel: ${err.message.split("\n")[0]}` };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, erro: "o fluxograma n\xE3o \xE9 um objeto" };
  const r = raw;
  if (!ID.test(str2(r.id))) return { ok: false, erro: "id ausente ou inv\xE1lido (min\xFAsculas, d\xEDgitos, - e _)" };
  if (!str2(r.titulo)) return { ok: false, erro: "titulo ausente" };
  if (!Array.isArray(r.nos) || !r.nos.length) return { ok: false, erro: "nos: lista vazia" };
  const nos = [];
  const ids = /* @__PURE__ */ new Set();
  for (const x of r.nos) {
    const n = x ?? {};
    const id = str2(n.id);
    if (!ID.test(id)) return { ok: false, erro: `n\xF3 com id inv\xE1lido: "${id}"` };
    if (ids.has(id)) return { ok: false, erro: `id repetido: ${id}` };
    ids.add(id);
    const tipo = str2(n.tipo);
    if (!TIPOS_NO.includes(tipo)) return { ok: false, erro: `n\xF3 ${id}: tipo deve ser ${TIPOS_NO.join(" | ")}` };
    if (!str2(n.texto)) return { ok: false, erro: `n\xF3 ${id}: texto ausente` };
    const vai = [];
    for (const s of Array.isArray(n.vai) ? n.vai : []) {
      const v = typeof s === "string" ? { para: s } : s ?? {};
      if (!str2(v.para)) return { ok: false, erro: `n\xF3 ${id}: sa\xEDda sem "para"` };
      vai.push({ para: str2(v.para), ...str2(v.se) ? { se: str2(v.se) } : {}, ...str2(v.nota) ? { nota: str2(v.nota) } : {} });
    }
    nos.push({
      id,
      tipo,
      texto: str2(n.texto),
      ...str2(n.nota) ? { nota: str2(n.nota) } : {},
      ...str2(n.porque) ? { porque: str2(n.porque) } : {},
      ...Array.isArray(n.erros_comuns) ? { erros_comuns: n.erros_comuns.map(str2).filter(Boolean) } : {},
      vai
    });
  }
  for (const n of nos) for (const s of n.vai) if (!ids.has(s.para)) return { ok: false, erro: `n\xF3 ${n.id}: vai para "${s.para}", que n\xE3o existe` };
  const inicio = str2(r.inicio) || nos[0].id;
  if (!ids.has(inicio)) return { ok: false, erro: `inicio "${inicio}" n\xE3o existe` };
  const fluxo = {
    id: str2(r.id),
    titulo: str2(r.titulo),
    ...str2(r.area) ? { area: str2(r.area) } : {},
    ...str2(r.descricao) ? { descricao: str2(r.descricao) } : {},
    ...str2(r.referencia) ? { referencia: str2(r.referencia) } : {},
    inicio,
    nos
  };
  const avisos = [];
  const alcancados = alcance(fluxo);
  const soltos = nos.filter((n) => !alcancados.has(n.id)).map((n) => n.id);
  if (soltos.length) avisos.push(`${fluxo.id}: n\xF3s que n\xE3o se alcan\xE7am a partir do in\xEDcio: ${soltos.join(", ")}`);
  for (const n of nos) {
    if (n.tipo === "decisao" && n.vai.length < 2) avisos.push(`${fluxo.id}: a decis\xE3o "${n.id}" tem menos de 2 sa\xEDdas`);
    if (n.vai.length > 1 && n.vai.some((s) => !s.se)) avisos.push(`${fluxo.id}: "${n.id}" tem v\xE1rias sa\xEDdas e alguma sem condi\xE7\xE3o (se)`);
  }
  const semNota = nos.filter((n) => !n.nota && n.tipo !== "inicio").length;
  if (semNota) avisos.push(`${fluxo.id}: ${semNota} n\xF3(s) sem nota que os sustente`);
  return { ok: true, fluxo, avisos };
}
function alcance(f) {
  const vistos = /* @__PURE__ */ new Set([f.inicio]);
  const fila = [f.inicio];
  while (fila.length) {
    const atual = fila.shift();
    const n = f.nos.find((x) => x.id === atual);
    for (const s of n?.vai ?? []) if (!vistos.has(s.para)) vistos.add(s.para), fila.push(s.para);
  }
  return vistos;
}

// src/core/pacote.ts
function ehSegredo(caminho) {
  const nome = caminho.split("/").pop().toLowerCase();
  return nome === "auth.json" || nome.startsWith(".env") || nome.endsWith("credentials.json") || nome.endsWith(".pem") || nome.endsWith(".key") || /(^|[-_.])(token|tokens|secret|secrets)([-_.]|$)/.test(nome);
}

// src/core/plugin-verificador.ts
var EXTENSOES_PERMITIDAS = /* @__PURE__ */ new Set(["md", "txt", "yaml", "yml", "json", "html", "htm", "csv", "tsv", "glb", "gltf", "swc", "png", "jpg", "jpeg", "webp", "gif", "svg", "mp3", "ogg", "wav", "pdf"]);
var EXECUTAVEIS = /* @__PURE__ */ new Set(["exe", "dll", "bat", "cmd", "ps1", "psm1", "sh", "bash", "zsh", "js", "mjs", "cjs", "ts", "py", "pyc", "jar", "msi", "com", "scr", "vbs", "wsf", "app", "dmg", "so", "dylib", "node", "wasm", "lnk", "reg", "hta", "cpl", "apk"]);
var TEXTO = /* @__PURE__ */ new Set(["md", "txt", "yaml", "yml", "json", "html", "htm", "csv", "tsv", "svg", "gltf", "swc"]);
var LIMITE_ARQUIVO = 25 * 1024 * 1024;
var LIMITE_TOTAL = 60 * 1024 * 1024;
var RECURSO_DESDE = {
  prompts: "0.1.0",
  base: "0.1.0",
  memory: "0.2.0",
  cases: "0.3.0",
  voz: "0.3.9",
  anatomia: "0.3.9",
  fluxogramas: "0.4.0",
  interativos: "0.4.0"
};
var PADROES_WIDGET = [
  [/\beval\s*\(/, "eval()"],
  [/\bnew\s+Function\s*\(|(?<![\w.])Function\s*\(/, "Function() (c\xF3digo gerado em tempo de execu\xE7\xE3o)"],
  [/\bfetch\s*\(/, "fetch() (rede)"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest (rede)"],
  [/\bWebSocket\b/, "WebSocket (rede)"],
  [/\bEventSource\b/, "EventSource (rede)"],
  [/\bsendBeacon\b/, "sendBeacon (rede)"],
  [/\bimportScripts\s*\(/, "importScripts (script externo)"],
  [/\bimport\s*\(/, "import() din\xE2mico"],
  [/\b(window\.)?(parent|top|opener)\s*\.(?!postMessage)/, "acesso \xE0 janela do app (parent/top/opener)"],
  [/\bwindow\.open\s*\(/, "window.open"],
  [/\bdocument\.cookie\b/, "cookies"],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, "armazenamento do navegador"],
  [/<script[^>]*\bsrc\s*=/i, "<script src> (script externo)"],
  [/<(link|img|iframe|embed|object|video|audio|source)[^>]*\b(href|src|data)\s*=\s*["']?\s*(https?:)?\/\//i, "recurso externo (link/img/iframe com URL)"],
  [/<iframe\b/i, "<iframe> dentro do widget"],
  [/<base\b/i, "<base>"],
  [/<meta[^>]*http-equiv/i, "<meta http-equiv>"],
  [/url\(\s*["']?\s*(https?:)?\/\//i, "CSS url() externo"],
  [/@import\b/i, "CSS @import"],
  [/\bnavigator\.(geolocation|mediaDevices|clipboard|serviceWorker)\b/, "API sens\xEDvel do navegador"],
  [/\bWorker\s*\(\s*["'`]/, "Worker com script externo"]
];
var PADROES_PROMPT = [
  [/ignor(e|ar|e todas as|e as)\s+(all\s+|as\s+|todas\s+as\s+)?(previous|prior|above|anteriores|instru)/i, "tenta anular instru\xE7\xF5es anteriores"],
  [/(disregard|desconsidere|esqueça)\s+(the|as|todas|suas|your)?\s*(rules|regras|instru|system)/i, "tenta desligar regras do app"],
  [/(system prompt|prompt do sistema)/i, "fala do prompt do sistema"],
  [/(\bapi[\s_-]?key|\bchaves? d[ae] api\b|_API_KEY\b|\btokens? de acesso\b|\bsenhas?\b|\bpasswords?\b)/i, "menciona chaves, tokens ou senhas"],
  [/(envie|mande|send|post|upload)\b[^.\n]{0,60}\b(https?:\/\/|e-?mail|webhook|servidor externo|external server)/i, "pede para mandar dados para fora"],
  [/(exfiltr|bypass|jailbreak|developer mode|modo desenvolvedor)/i, "linguagem de burlar regras"]
];
var ext = (c) => c.includes(".") ? c.split(".").pop().toLowerCase() : "";
var ehTexto = (c) => TEXTO.has(ext(c));
function citados(m) {
  const out = [...Object.values(m.prompts ?? {}).flat()];
  if (m.memory?.doctrine) out.push(m.memory.doctrine);
  if (m.cases?.doctrine) out.push(m.cases.doctrine);
  out.push(...m.fluxogramas?.arquivos ?? []);
  out.push(...m.interativos?.widgets.map((w) => w.arquivo) ?? []);
  return out;
}
function recursosUsados(m) {
  const r = [];
  if (m.prompts && Object.keys(m.prompts).length) r.push("prompts");
  for (const k of ["base", "memory", "cases", "voz", "anatomia", "fluxogramas", "interativos"]) if (m[k]) r.push(k);
  return r;
}
function menorVersaoAdmitida(faixa, ate) {
  const teto = lerVersao(ate) ?? [1, 0, 0];
  for (let a = 0; a <= teto[0]; a++) for (let b = 0; b <= 20; b++) for (const c of [0, 9]) if (satisfaz(`${a}.${b}.${c}`, faixa)) return `${a}.${b}.${c}`;
  return null;
}
function urlsDoManifesto(raw) {
  const out = [];
  const visitar = (v) => {
    if (typeof v === "string" && /^[a-z]+:\/\//i.test(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach(visitar);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => k !== "repositorio" && visitar(x));
  };
  visitar(raw);
  return out;
}
function verificarPlugin(raw, arquivos, ctx) {
  const bloqueios = [];
  const avisos = [];
  const falhou = /* @__PURE__ */ new Set();
  const bloq = (verificacao, mensagem, arquivo) => {
    bloqueios.push({ verificacao, mensagem, ...arquivo ? { arquivo } : {} });
    falhou.add(verificacao);
  };
  const avis = (verificacao, mensagem, arquivo) => {
    avisos.push({ verificacao, mensagem, ...arquivo ? { arquivo } : {} });
    falhou.add(verificacao);
  };
  const r = raw && typeof raw === "object" ? raw : {};
  const declarouV2 = typeof r.esquema === "number" && r.esquema >= 2;
  const urls = urlsDoManifesto(raw);
  for (const u of urls) {
    if (!/^https:\/\//i.test(u)) bloq("rede", `URL sem https: ${u} \u2014 s\xF3 https \xE9 aceito`, "plugin.json");
  }
  if (typeof r.repositorio === "string" && !/^https:\/\//.test(r.repositorio)) bloq("rede", `reposit\xF3rio sem https: ${r.repositorio}`, "plugin.json");
  const parsed = parsePluginManifest(raw);
  const m = parsed.ok ? parsed.manifest : null;
  if (!parsed.ok) {
    if (!(falhou.has("rede") && /https/.test(parsed.error))) bloq("esquema", `plugin.json inv\xE1lido: ${parsed.error}`, "plugin.json");
  }
  const presentes = new Set(arquivos.map((a) => a.caminho));
  if (m) {
    if (!declarouV2) avis("esquema", `manifesto no contrato 1: declare "esquema": ${PLUGIN_ESQUEMA}, "app", "licenca" e "permissoes" (o app l\xEA assim mesmo)`, "plugin.json");
    for (const c of citados(m)) if (!presentes.has(c)) bloq("esquema", `arquivo citado no manifesto n\xE3o existe: ${c}`, c);
    if (m.base && /^[a-zA-Z]:|^\//.test(m.base.path)) avis("esquema", `base.path \xE9 um caminho do disco do autor (${m.base.path}): em outro computador o app usa o banco em uso do perfil`, "plugin.json");
    if (!m.licenca) avis("esquema", "sem licen\xE7a declarada (ex.: CC-BY-SA-4.0)", "plugin.json");
  }
  if (m) {
    if (m.app && !satisfaz(ctx.appVersao, m.app)) bloq("app", `pede o app ${m.app}; este \xE9 ${ctx.appVersao}`, "plugin.json");
    const appAtual = lerVersao(ctx.appVersao);
    for (const rec of recursosUsados(m)) {
      const desde = lerVersao(RECURSO_DESDE[rec] ?? "0.0.0");
      if (appAtual && compararVersoes(appAtual, desde) < 0) bloq("app", `usa "${rec}", que s\xF3 existe a partir do app ${RECURSO_DESDE[rec]} (este \xE9 ${ctx.appVersao})`);
      if (m.app) {
        const menor = menorVersaoAdmitida(m.app, ctx.appVersao);
        const v = menor ? lerVersao(menor) : null;
        if (v && compararVersoes(v, desde) < 0) avis("app", `a faixa "app": "${m.app}" admite vers\xF5es sem "${rec}" (desde ${RECURSO_DESDE[rec]}): use ">=${RECURSO_DESDE[rec]}"`, "plugin.json");
      }
    }
  }
  if (m) {
    const outros = ctx.outros.filter((o) => o.id !== m.id || o.version !== m.version);
    const mesmoId = outros.find((o) => o.id === m.id);
    if (mesmoId) avis("plugins", `j\xE1 existe o plugin "${m.id}" (vers\xE3o ${mesmoId.version}): os dois ficam lado a lado e vale o primeiro encontrado`);
    for (const [dep, faixa] of Object.entries(m.dependencias ?? {})) {
      const d = outros.find((o) => o.id === dep);
      const msg = !d ? `depende de "${dep}" ${faixa}, que n\xE3o est\xE1 instalado` : !satisfaz(d.version, faixa) ? `depende de "${dep}" ${faixa}, mas o instalado \xE9 ${d.version}` : null;
      if (msg) (ctx.dependenciaComoAviso ? avis : bloq)("plugins", msg);
    }
    for (const c of m.conflitos ?? []) if (outros.some((o) => o.id === c)) bloq("plugins", `declara conflito com "${c}", que est\xE1 instalado`);
    for (const o of outros) if (o.conflitos?.includes(m.id)) bloq("plugins", `o plugin "${o.id}" declara conflito com este`);
    const ids = (x) => ({
      pacotes: new Set(x.anatomia?.pacotes?.map((p) => p.id) ?? []),
      widgets: new Set(x.interativos?.widgets.map((w) => w.id) ?? [])
    });
    const meus = ids(m);
    for (const o of outros.filter((o2) => o2.id !== m.id)) {
      const deles = ids(o);
      for (const p of meus.pacotes) if (deles.pacotes.has(p)) avis("plugins", `o pacote de modelos "${p}" tamb\xE9m \xE9 oferecido por "${o.id}"`);
      for (const w of meus.widgets) if (deles.widgets.has(w)) avis("plugins", `o interativo "${w}" tamb\xE9m existe em "${o.id}": o tutor usar\xE1 "${m.id}/${w}"`);
    }
  }
  let total = 0;
  for (const a of arquivos) {
    total += a.tamanho;
    const e = ext(a.caminho);
    if (a.caminho.startsWith("/") || /^[a-zA-Z]:/.test(a.caminho) || a.caminho.split("/").includes("..") || a.caminho.includes("\\")) bloq("arquivos", "caminho absoluto ou com '..'", a.caminho);
    if (ehSegredo(a.caminho)) bloq("arquivos", "parece um segredo (credencial, token, .env): nunca vai em plugin", a.caminho);
    else if (EXECUTAVEIS.has(e)) bloq("arquivos", `arquivo execut\xE1vel ou de script (.${e}): plugins levam s\xF3 dados, texto e widgets .html`, a.caminho);
    else if (a.caminho !== "plugin.json" && !EXTENSOES_PERMITIDAS.has(e)) bloq("arquivos", `extens\xE3o n\xE3o permitida (.${e || "sem extens\xE3o"})`, a.caminho);
    if (a.tamanho > LIMITE_ARQUIVO) bloq("arquivos", `arquivo maior que ${LIMITE_ARQUIVO / 1024 / 1024} MB: pacotes grandes v\xE3o como pacote de dados (url + sha256)`, a.caminho);
    if ((e === "html" || e === "htm") && m && !m.interativos?.widgets.some((w) => w.arquivo === a.caminho)) avis("arquivos", "HTML que n\xE3o \xE9 widget declarado: o app n\xE3o o executa", a.caminho);
  }
  if (total > LIMITE_TOTAL) bloq("arquivos", `plugin com ${(total / 1024 / 1024).toFixed(1)} MB (limite ${LIMITE_TOTAL / 1024 / 1024} MB)`);
  if (m) {
    const hosts = new Set(m.permissoes?.baixar ?? []);
    for (const p of m.anatomia?.pacotes ?? []) {
      if (!p.url) continue;
      if (!p.sha256) bloq("rede", `pacote "${p.id}": url sem sha256`, "plugin.json");
      let host = "";
      try {
        host = new URL(p.url).hostname.toLowerCase();
      } catch {
        bloq("rede", `pacote "${p.id}": url inv\xE1lida`, "plugin.json");
        continue;
      }
      if (!hosts.has(host)) (declarouV2 ? bloq : avis)("rede", `pacote "${p.id}" baixa de ${host}, que n\xE3o est\xE1 em permissoes.baixar`, "plugin.json");
    }
  }
  if (m?.interativos) {
    if (!m.permissoes?.interativos) bloq("widgets", 'tem interativos mas n\xE3o declara "permissoes": {"interativos": true}', "plugin.json");
    for (const w of m.interativos.widgets) {
      const f = arquivos.find((a) => a.caminho === w.arquivo);
      if (!f?.texto) continue;
      const codigo = f.texto;
      for (const [re, nome] of PADROES_WIDGET) if (re.test(codigo)) bloq("widgets", `widget "${w.id}" usa ${nome}`, w.arquivo);
      if (!/<script\b/i.test(codigo) && !/<svg\b|<canvas\b/i.test(codigo)) avis("widgets", `widget "${w.id}" n\xE3o tem script nem desenho`, w.arquivo);
      if (!/lh\.(enviar|estado|aoReceber)|postMessage/.test(codigo)) avis("widgets", `widget "${w.id}" n\xE3o devolve estado (lh.enviar): o app n\xE3o consegue corrigir quest\xF5es de intera\xE7\xE3o com ele`, w.arquivo);
      for (const b of w.bibliotecas ?? []) if (!BIBLIOTECAS_WIDGET.includes(b)) bloq("widgets", `biblioteca n\xE3o oferecida pelo app: ${b}`, w.arquivo);
    }
  }
  for (const a of arquivos.filter((x) => ["md", "txt", "yaml", "yml"].includes(ext(x.caminho)) && x.texto)) {
    for (const [re, nome] of PADROES_PROMPT) if (re.test(a.texto)) avis("prompts", `texto que ${nome} \u2014 revise antes de publicar`, a.caminho);
  }
  if (m) {
    const texto = (c) => arquivos.find((a) => a.caminho === c)?.texto ?? "";
    for (const c of citados(m)) {
      const f = arquivos.find((a) => a.caminho === c);
      if (f && ehTexto(c) && !(f.texto ?? "").trim()) bloq("funcionamento", "arquivo citado est\xE1 vazio", c);
    }
    if (!recursosUsados(m).length) avis("funcionamento", "o plugin n\xE3o liga nenhum recurso (prompts, base, mem\xF3ria, fluxogramas, interativos\u2026)");
    for (const kind of ["prober", "teacher", "practice"]) {
      const total2 = (m.prompts?.[kind] ?? []).map(texto).join("\n\n").length;
      if (total2 > 6e4) avis("funcionamento", `o prompt do agente "${kind}" fica com ${Math.round(total2 / 1e3)} mil caracteres: pesa em toda resposta (ideal < 20 mil)`);
    }
    for (const f of m.fluxogramas?.arquivos ?? []) {
      if (!presentes.has(f)) continue;
      const lido = lerFluxograma(texto(f));
      if (!lido.ok) bloq("funcionamento", `fluxograma inv\xE1lido: ${lido.erro}`, f);
      else for (const a of lido.avisos) avis("funcionamento", a, f);
    }
  }
  const todas = ["esquema", "app", "plugins", "arquivos", "rede", "widgets", "prompts", "funcionamento"];
  return {
    id: m?.id ?? (typeof r.id === "string" ? r.id : null),
    versao: m?.version ?? (typeof r.version === "string" ? r.version : null),
    passou: bloqueios.length === 0,
    bloqueios,
    avisos,
    ok: todas.filter((v) => !falhou.has(v))
  };
}
function relatorioEmTexto(r) {
  const linhas = [`${r.passou ? "PASSOU" : "BARRADO"} \u2014 ${r.id ?? "?"}@${r.versao ?? "?"}`];
  for (const b of r.bloqueios) linhas.push(`  \u2717 [${b.verificacao}] ${b.mensagem}${b.arquivo ? ` (${b.arquivo})` : ""}`);
  for (const a of r.avisos) linhas.push(`  ! [${a.verificacao}] ${a.mensagem}${a.arquivo ? ` (${a.arquivo})` : ""}`);
  if (r.ok.length) linhas.push(`  \u2713 ${r.ok.join(", ")}`);
  return linhas.join("\n");
}

// src/server/plugin-arquivos.ts
import fs from "node:fs";
import path from "node:path";
function arquivosDaPasta(dir) {
  const out = [];
  const andar = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) andar(path.join(d, e.name), r);
      else if (e.isFile()) {
        const tamanho = fs.statSync(path.join(d, e.name)).size;
        out.push({ caminho: r, tamanho, ...ehTexto(r) && tamanho < 5e6 ? { texto: fs.readFileSync(path.join(d, e.name), "utf-8") } : {} });
      }
    }
  };
  andar(dir, "");
  return out;
}
function verificarPastaCom(dir, ctx) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf-8"));
  } catch (err) {
    return { id: null, versao: null, passou: false, bloqueios: [{ verificacao: "esquema", mensagem: `plugin.json ausente ou ileg\xEDvel: ${err.message}` }], avisos: [], ok: [] };
  }
  return verificarPlugin(raw, arquivosDaPasta(dir), ctx);
}
function manifestosDaPasta(raiz) {
  const out = [];
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    const f = path.join(raiz, e.name, "plugin.json");
    if (!e.isDirectory() || !fs.existsSync(f)) continue;
    try {
      const p = parsePluginManifest(JSON.parse(fs.readFileSync(f, "utf-8")));
      if (p.ok) out.push(p.manifest);
    } catch {
    }
  }
  return out;
}

// package.json
var package_default = {
  name: "learnharness",
  version: "0.4.0",
  license: "AGPL-3.0-only",
  author: {
    name: "Amos Blomqvist",
    email: "255718537+amosblomqvist@users.noreply.github.com"
  },
  homepage: "https://github.com/amosblomqvist/learnharness",
  desktopName: "learnharness.desktop",
  description: "An agent harness for learning: adaptive teaching, practice, and a persistent knowledge graph.",
  type: "module",
  private: true,
  main: "electron/main.cjs",
  scripts: {
    dev: "next dev",
    build: "next build",
    start: "next start",
    test: "NODE_ENV=test tsx --test tests/*.test.ts tests/*.test.tsx",
    lint: "eslint .",
    typecheck: "tsc --noEmit",
    "desktop:dev": 'concurrently -k "next dev" "LH_DEV_URL=http://localhost:3000 electron ."',
    "dev:fresh": "bash scripts/dev-fresh.sh",
    "desktop:dist:win": "rm -rf dist .next/standalone && next build && node scripts/smoke-provider-runtime.mjs && node scripts/build-server.mjs && node scripts/smoke-server.mjs && electron-builder --win --x64 --publish never",
    "desktop:dist": "rm -rf dist .next/standalone && next build && node scripts/smoke-provider-runtime.mjs && node scripts/build-server.mjs && node scripts/smoke-server.mjs && DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer} APPLE_KEYCHAIN_PROFILE=LH_NOTARY APPLE_TEAM_ID=JS6XN22HY6 electron-builder --mac --arm64",
    "plugin:verificar": "tsx scripts/plugin-verificar.ts",
    "plugin:kit": "esbuild scripts/kit-verificar.ts --bundle --platform=node --format=esm --target=node20 --outfile=../TutorForLearning/kit/lh-plugin.mjs --log-level=warning"
  },
  dependencies: {
    "@earendil-works/pi-agent-core": "1.4.0",
    "@earendil-works/pi-ai": "1.4.0",
    "@mozilla/readability": "^0.6.0",
    "@radix-ui/react-use-controllable-state": "^1.2.6",
    "@resvg/resvg-js": "^2.6.2",
    "@rive-app/react-webgl2": "^4.32.1",
    "@streamdown/cjk": "^1.0.3",
    "@streamdown/code": "^1.1.1",
    "@streamdown/math": "^1.0.2",
    "@streamdown/mermaid": "^1.0.2",
    "@supabase/supabase-js": "^2.45.4",
    "@types/js-yaml": "^4.0.9",
    "@types/three": "^0.170.0",
    "@xyflow/react": "^12.11.3",
    "ansi-to-react": "^6.2.6",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    cmdk: "^1.1.1",
    d3: "^7.9.0",
    "d3-force": "^3.0.0",
    "d3-selection": "^3.0.0",
    "d3-shape": "^3.2.0",
    "d3-zoom": "^3.0.0",
    "dagre-d3-es": "7.0.14",
    "electron-updater": "^6.8.9",
    "embla-carousel-react": "^8.6.0",
    fflate: "^0.8.2",
    jose: "^6.2.12",
    "js-yaml": "^4.1.0",
    katex: "0.18.2",
    linkedom: "^0.18.13",
    "lucide-react": "^1.33.0",
    "mdast-util-from-markdown": "2.0.3",
    "mdast-util-math": "3.0.0",
    "media-chrome": "^4.19.2",
    mermaid: "^11.17.0",
    "micromark-extension-math": "3.1.0",
    motion: "^13.1.1",
    nanoid: "^6.0.1",
    next: "^16.3.2",
    "next-themes": "^0.4.6",
    "pdfjs-dist": "^6.3.289",
    "puppeteer-core": "^25.8.0",
    "radix-ui": "^1.6.7",
    react: "^19.2.8",
    "react-dom": "^19.2.8",
    "react-jsx-parser": "^2.4.1",
    "remark-breaks": "^4.0.0",
    streamdown: "^2.5.0",
    "tailwind-merge": "^3.6.0",
    three: "^0.170.0",
    tokenlens: "^1.3.1",
    turndown: "^7.2.4",
    typebox: "^1.3.27",
    "use-stick-to-bottom": "^1.1.6",
    zod: "^4.4.3"
  },
  overrides: {
    katex: "$katex"
  },
  devDependencies: {
    "@next/eslint-plugin-next": "^16.3.3",
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@types/turndown": "^5.0.6",
    "@typescript-eslint/parser": "^8.68.0",
    concurrently: "^10.0.5",
    electron: "^44.9.3",
    "electron-builder": "26.16.1",
    eslint: "^9.39.5",
    "eslint-import-resolver-typescript": "^4.4.5",
    "eslint-plugin-import": "^2.32.0",
    tailwindcss: "^4.3.3",
    tsx: "^4.19.0",
    typescript: "^5.6.0"
  }
};

// scripts/kit-verificar.ts
var [cmd, ...resto] = process.argv.slice(2);
var opc = (nome) => {
  const i2 = resto.indexOf(nome);
  return i2 >= 0 ? resto[i2 + 1] : void 0;
};
var posicionais = resto.filter((a, i2) => !a.startsWith("--") && !(resto[i2 - 1] ?? "").startsWith("--"));
var app = opc("--app") ?? package_default.version;
function pastasDePlugin(alvos) {
  const out = [];
  for (const a of alvos) {
    if (fs2.existsSync(path2.join(a, "plugin.json"))) out.push(a);
    else if (fs2.existsSync(a) && fs2.statSync(a).isDirectory()) {
      for (const d of fs2.readdirSync(a)) if (fs2.existsSync(path2.join(a, d, "plugin.json"))) out.push(path2.join(a, d));
    }
  }
  return out;
}
if (cmd === "verificar") {
  const registro = opc("--registro");
  const pastas = pastasDePlugin(posicionais);
  if (!pastas.length) {
    console.error("nenhuma pasta de plugin (com plugin.json) encontrada");
    process.exit(2);
  }
  const outros = registro ? manifestosDaPasta(registro) : pastas.flatMap((p) => manifestosDaPasta(path2.dirname(p)));
  const rels = pastas.map((p) => verificarPastaCom(p, { appVersao: app, outros }));
  console.log(resto.includes("--json") ? JSON.stringify(rels, null, 2) : rels.map(relatorioEmTexto).join("\n\n"));
  process.exit(rels.every((r) => r.passou) ? 0 : 1);
} else if (cmd === "registro") {
  const raiz = posicionais[0] ?? "plugins";
  const saida = opc("--saida") ?? "registro.json";
  const base = opc("--base") ?? "";
  const outros = manifestosDaPasta(raiz);
  const entradas = [];
  let falhas = 0;
  for (const dir of pastasDePlugin([raiz]).sort()) {
    const rel = verificarPastaCom(dir, { appVersao: app, outros });
    if (!rel.passou) {
      console.error(relatorioEmTexto(rel));
      falhas++;
      continue;
    }
    const m = outros.find((x) => x.id === rel.id);
    const arquivos = arquivosDaPasta(dir).map((a) => ({
      caminho: a.caminho,
      tamanho: a.tamanho,
      sha256: crypto.createHash("sha256").update(fs2.readFileSync(path2.join(dir, ...a.caminho.split("/")))).digest("hex")
    }));
    entradas.push({
      tipo: "plugin",
      id: m.id,
      nome: m.name,
      versao: m.version,
      descricao: m.description,
      ...m.app ? { app: m.app } : {},
      ...m.licenca ? { licenca: m.licenca } : {},
      ...m.autores ? { autores: m.autores } : {},
      ...m.dependencias ? { dependencias: m.dependencias } : {},
      recursos: ["prompts", "base", "memory", "cases", "voz", "anatomia", "fluxogramas", "interativos"].filter((k) => m[k]),
      caminho: path2.relative(path2.dirname(path2.resolve(raiz)), path2.resolve(dir)).split(path2.sep).join("/"),
      arquivos,
      avisos: rel.avisos.length
    });
  }
  const kit = opc("--kit") ?? "kit";
  if (fs2.existsSync(path2.join(kit, "lh-plugin.mjs"))) {
    const arquivos = arquivosDaPasta(kit).map((a) => ({
      caminho: a.caminho,
      tamanho: a.tamanho,
      sha256: crypto.createHash("sha256").update(fs2.readFileSync(path2.join(kit, ...a.caminho.split("/")))).digest("hex")
    }));
    entradas.push({ tipo: "kit", id: "kit-criar-plugin", nome: "Kit para criar plugins", versao: package_default.version, descricao: "Skill do Claude Code, instru\xE7\xF5es do OpenCode, modelo, esquema e verificador.", caminho: path2.relative(path2.dirname(path2.resolve(raiz)), path2.resolve(kit)).split(path2.sep).join("/"), arquivos });
  }
  const extra = fs2.existsSync(opc("--pacotes") ?? "pacotes.json") ? JSON.parse(fs2.readFileSync(opc("--pacotes") ?? "pacotes.json", "utf-8")) : [];
  const registro = { formato: "lh-registro", esquema: 1, atualizado: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), base, entradas: [...entradas, ...extra] };
  fs2.writeFileSync(saida, JSON.stringify(registro, null, "	") + "\n");
  console.log(`${entradas.length} plugin(s) no registro${falhas ? `; ${falhas} barrado(s)` : ""} \u2192 ${saida}`);
  process.exit(falhas ? 1 : 0);
} else {
  console.error("uso:\n  lh-plugin verificar <pasta> [...] [--json] [--app X] [--registro <pasta>]\n  lh-plugin registro <pasta-de-plugins> --saida registro.json [--base <url>] [--pacotes pacotes.json]");
  process.exit(2);
}
/*! Bundled license information:

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT *)
*/
